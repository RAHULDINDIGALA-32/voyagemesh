"""PostgreSQL-backed HITL idempotency and audit records."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Literal

from psycopg_pool import AsyncConnectionPool


@dataclass(frozen=True)
class InterventionClaim:
    status: Literal["claimed", "resolved", "in_progress"]


class HitlInterventionRepository:
    def __init__(self, pool: AsyncConnectionPool):
        self.pool = pool

    async def setup(self) -> None:
        async with self.pool.connection() as connection:
            await connection.execute("""
                CREATE TABLE IF NOT EXISTS hitl_interventions (
                    intervention_id TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL,
                    intervention_type TEXT NOT NULL,
                    state_version INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    context JSONB NOT NULL DEFAULT '{}'::jsonb,
                    response JSONB,
                    created_at TIMESTAMPTZ NOT NULL,
                    resolved_at TIMESTAMPTZ
                )
                """)
            await connection.execute("""
                CREATE INDEX IF NOT EXISTS voyagemesh_hitl_thread_status_idx
                ON hitl_interventions (thread_id, status)
                """)

    async def ensure_pending(
        self, thread_id: str, intervention: dict[str, Any]
    ) -> None:
        async with self.pool.connection() as connection:
            await connection.execute(
                """
                INSERT INTO hitl_interventions
                    (intervention_id, thread_id, intervention_type, state_version, status, context, created_at)
                VALUES (%s, %s, %s, %s, 'pending', %s::jsonb, %s)
                ON CONFLICT (intervention_id) DO NOTHING
                """,
                (
                    intervention["intervention_id"],
                    thread_id,
                    intervention["type"],
                    intervention["version"],
                    json.dumps(intervention.get("context", {})),
                    intervention["created_at"],
                ),
            )

    async def claim(
        self,
        *,
        thread_id: str,
        intervention_id: str,
        state_version: int,
        response: dict[str, Any],
    ) -> InterventionClaim:
        """Atomically claim one pending response across all application instances."""
        async with self.pool.connection() as connection, connection.transaction():
            result = await connection.execute(
                """
                SELECT status, thread_id, state_version
                FROM hitl_interventions
                WHERE intervention_id = %s
                FOR UPDATE
                """,
                (intervention_id,),
            )
            row = await result.fetchone()
            if (
                row is None
                or row["thread_id"] != thread_id
                or row["state_version"] != state_version
            ):
                raise LookupError("HITL intervention was not found")
            if row["status"] == "resolved":
                return InterventionClaim("resolved")
            if row["status"] == "resuming":
                return InterventionClaim("in_progress")
            if row["status"] != "pending":
                raise RuntimeError("HITL intervention is not resumable")
            await connection.execute(
                """
                UPDATE hitl_interventions
                SET status = 'resuming', response = %s::jsonb
                WHERE intervention_id = %s
                """,
                (json.dumps(response), intervention_id),
            )
        return InterventionClaim("claimed")

    async def finalize(self, intervention_id: str) -> None:
        async with self.pool.connection() as connection:
            await connection.execute(
                """
                UPDATE hitl_interventions
                SET status = 'resolved', resolved_at = NOW()
                WHERE intervention_id = %s AND status = 'resuming'
                """,
                (intervention_id,),
            )

    async def release(self, intervention_id: str) -> None:
        """Allow a retry if graph resumption failed before a checkpoint advanced."""
        async with self.pool.connection() as connection:
            await connection.execute(
                """
                UPDATE hitl_interventions
                SET status = 'pending', response = NULL
                WHERE intervention_id = %s AND status = 'resuming'
                """,
                (intervention_id,),
            )
