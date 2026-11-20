from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from psycopg_pool import AsyncConnectionPool
from hitl.errors import NotOwner, WorkflowNotFound


def utc_now() -> datetime:
    return datetime.now(UTC)


def derive_title(constraints: dict[str, str], query: str) -> str:
    destination = (constraints or {}).get("destination", "").strip()
    dates = (constraints or {}).get("travel_dates", "").strip()
    if destination and dates:
        return f"{destination} · {dates}"
    if destination:
        return destination
    cleaned = " ".join(query.split())
    return cleaned[:72] if cleaned else "Untitled voyage"


def map_status(execution_status: str) -> str:
    return {
        "running": "draft",
        "awaiting_human": "awaiting_you",
        "resuming": "resuming",
        "incomplete": "draft",
        "completed": "ready",
        "blocked": "blocked",
        "failed": "failed",
        "aborted": "aborted",
    }.get(execution_status, "draft")


class ProductRepository:
    def __init__(self, pool: AsyncConnectionPool):
        self.pool = pool

    async def setup(self) -> None:
        async with self.pool.connection() as connection:
            await connection.execute("""
                CREATE TABLE IF NOT EXISTS voyagemesh_conversations (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL,
                    thread_id TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL DEFAULT 'Untitled voyage',
                    status TEXT NOT NULL DEFAULT 'draft',
                    deleted_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """)
            await connection.execute("""
                CREATE TABLE IF NOT EXISTS voyagemesh_messages (
                    id UUID PRIMARY KEY,
                    conversation_id UUID NOT NULL
                        REFERENCES voyagemesh_conversations(id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    kind TEXT NOT NULL DEFAULT 'user',
                    created_at TIMESTAMPTZ NOT NULL
                )
                """)
            await connection.execute("""
                CREATE TABLE IF NOT EXISTS voyagemesh_trips (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL,
                    conversation_id UUID NOT NULL
                        REFERENCES voyagemesh_conversations(id) ON DELETE CASCADE,
                    thread_id TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL DEFAULT 'Untitled voyage',
                    status TEXT NOT NULL DEFAULT 'draft',
                    cover JSONB NOT NULL DEFAULT '{}'::jsonb,
                    latest_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                    deleted_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """)
            await connection.execute("ALTER TABLE voyagemesh_trips ADD COLUMN IF NOT EXISTS trace_id TEXT")
            await connection.execute("""
                CREATE INDEX IF NOT EXISTS voyagemesh_trips_user_status_updated_idx
                ON voyagemesh_trips (user_id, status, updated_at)
                WHERE deleted_at IS NULL
            """)
            await connection.execute("""
                CREATE INDEX IF NOT EXISTS voyagemesh_conversations_user_updated_idx
                ON voyagemesh_conversations (user_id, updated_at DESC)
                WHERE deleted_at IS NULL
                """)
            await connection.execute("""
                CREATE INDEX IF NOT EXISTS voyagemesh_trips_user_updated_idx
                ON voyagemesh_trips (user_id, updated_at DESC)
                WHERE deleted_at IS NULL
                """)
            await connection.execute("""
                CREATE INDEX IF NOT EXISTS voyagemesh_messages_conversation_idx
                ON voyagemesh_messages (conversation_id, created_at)
                """)

    async def create_owned_thread(
        self,
        *,
        user_id: str,
        thread_id: str,
        query: str,
    ) -> dict[str, Any]:
        now = utc_now()
        conversation_id = uuid.uuid4()
        trip_id = uuid.uuid4()
        title = derive_title({}, query)
        async with self.pool.connection() as connection, connection.transaction():
            await connection.execute(
                """
                INSERT INTO voyagemesh_conversations
                    (id, user_id, thread_id, title, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, 'draft', %s, %s)
                """,
                (conversation_id, user_id, thread_id, title, now, now),
            )
            await connection.execute(
                """
                INSERT INTO voyagemesh_trips
                    (id, user_id, conversation_id, thread_id, title, status, cover, latest_payload, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, 'draft', '{}'::jsonb, '{}'::jsonb, %s, %s)
                """,
                (trip_id, user_id, conversation_id, thread_id, title, now, now),
            )
        await self.add_message(
            conversation_id=str(conversation_id),
            role="user",
            content=query,
            kind="user",
        )
        return {
            "conversation_id": str(conversation_id),
            "trip_id": str(trip_id),
            "thread_id": thread_id,
            "title": title,
            "status": "draft",
        }

    async def cleanup_stale_workflows(self, ttl_seconds: int, hitl_expiry_hours: int) -> None:
        now = utc_now()
        async with self.pool.connection() as connection, connection.transaction():
            await connection.execute(
                """UPDATE voyagemesh_trips SET status='failed', updated_at=%s,
                   latest_payload = jsonb_set(COALESCE(latest_payload, '{}'::jsonb), '{failure_reason}', '"stale"')
                   WHERE status IN ('draft','resuming') AND updated_at < %s AND deleted_at IS NULL""",
                (now, now - __import__('datetime').timedelta(seconds=ttl_seconds)),
            )
            await connection.execute(
                """UPDATE voyagemesh_trips SET status='failed', updated_at=%s,
                   latest_payload = jsonb_set(COALESCE(latest_payload, '{}'::jsonb), '{failure_reason}', '"expired"')
                   WHERE status='awaiting_you' AND updated_at < %s AND deleted_at IS NULL""",
                (now, now - __import__('datetime').timedelta(hours=hitl_expiry_hours)),
            )

    async def reserve_workflow(self, user_id: str, *, max_active: int, daily_limit: int, running_ttl_seconds: int) -> None:
        now = utc_now()
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        async with self.pool.connection() as connection, connection.transaction():
            result = await connection.execute(
                "SELECT COUNT(*) AS count FROM voyagemesh_trips WHERE user_id=%s AND created_at >= %s AND status <> 'blocked' AND deleted_at IS NULL",
                (user_id, day_start),
            )
            if (await result.fetchone())["count"] >= daily_limit:
                from rate_limit.store import seconds_until_midnight
                raise __import__('rate_limit.limits', fromlist=['RateLimitError']).RateLimitError('user_daily', "You've reached today's planning limit.", seconds_until_midnight())
            result = await connection.execute(
                "SELECT COUNT(*) AS count FROM voyagemesh_trips WHERE user_id=%s AND status IN ('draft','resuming') AND updated_at >= %s AND deleted_at IS NULL",
                (user_id, now - __import__('datetime').timedelta(seconds=running_ttl_seconds)),
            )
            if (await result.fetchone())["count"] >= max_active:
                raise __import__('rate_limit.limits', fromlist=['RateLimitError']).RateLimitError('user_active', "You already have a planning workflow in progress.", 30)

    async def update_trace_id(self, thread_id: str, user_id: str, trace_id: str) -> None:
        async with self.pool.connection() as connection:
            await connection.execute("UPDATE voyagemesh_trips SET trace_id=%s WHERE thread_id=%s AND user_id=%s", (trace_id, thread_id, user_id))

    async def require_thread(self, thread_id: str, user_id: str) -> dict[str, Any]:
        record = await self.get_thread(thread_id, user_id)
        if record is not None:
            return record
        async with self.pool.connection() as connection:
            result = await connection.execute(
                "SELECT 1 FROM voyagemesh_conversations WHERE thread_id = %s AND deleted_at IS NULL",
                (thread_id,),
            )
            if await result.fetchone():
                raise NotOwner("You do not have access to this voyage")
        raise WorkflowNotFound("Trip not found")

    async def get_thread(self, thread_id: str, user_id: str) -> dict[str, Any] | None:
        async with self.pool.connection() as connection:
            result = await connection.execute(
                """
                SELECT c.id AS conversation_id, t.id AS trip_id, c.thread_id, c.title, c.status,
                       t.latest_payload
                FROM voyagemesh_conversations c
                JOIN voyagemesh_trips t ON t.conversation_id = c.id
                WHERE c.thread_id = %s AND c.user_id = %s AND c.deleted_at IS NULL
                """,
                (thread_id, user_id),
            )
            return await result.fetchone()

    async def get_thread_owner(self, thread_id: str) -> dict[str, Any] | None:
        async with self.pool.connection() as connection:
            result = await connection.execute(
                """
                SELECT c.thread_id, c.user_id, c.id AS conversation_id
                FROM voyagemesh_conversations c
                WHERE c.thread_id = %s AND c.deleted_at IS NULL
                """,
                (thread_id,),
            )
            return await result.fetchone()

    async def get_conversation(self, conversation_id: str, user_id: str) -> dict[str, Any] | None:
        async with self.pool.connection() as connection:
            result = await connection.execute(
                """
                SELECT c.id AS conversation_id, t.id AS trip_id, c.thread_id, c.title, c.status,
                       c.updated_at, t.cover
                FROM voyagemesh_conversations c
                JOIN voyagemesh_trips t ON t.conversation_id = c.id
                WHERE c.id = %s AND c.user_id = %s AND c.deleted_at IS NULL
                """,
                (conversation_id, user_id),
            )
            return await result.fetchone()

    async def list_conversations(self, user_id: str) -> list[dict[str, Any]]:
        async with self.pool.connection() as connection:
            result = await connection.execute(
                """
                SELECT c.id AS conversation_id, t.id AS trip_id, c.thread_id, c.title, c.status,
                       c.updated_at, t.cover
                FROM voyagemesh_conversations c
                JOIN voyagemesh_trips t ON t.conversation_id = c.id
                WHERE c.user_id = %s AND c.deleted_at IS NULL
                ORDER BY
                    CASE WHEN c.status = 'awaiting_you' THEN 0 ELSE 1 END,
                    c.updated_at DESC
                """,
                (user_id,),
            )
            return await result.fetchall()

    async def list_trips(self, user_id: str) -> list[dict[str, Any]]:
        async with self.pool.connection() as connection:
            result = await connection.execute(
                """
                SELECT t.id AS trip_id, t.conversation_id, t.thread_id, t.title, t.status,
                       t.updated_at, t.cover, t.latest_payload
                FROM voyagemesh_trips t
                WHERE t.user_id = %s AND t.deleted_at IS NULL
                ORDER BY t.updated_at DESC
                """,
                (user_id,),
            )
            return await result.fetchall()

    async def list_messages(self, conversation_id: str) -> list[dict[str, Any]]:
        async with self.pool.connection() as connection:
            result = await connection.execute(
                """
                SELECT id, conversation_id, role, content, kind, created_at
                FROM voyagemesh_messages
                WHERE conversation_id = %s
                ORDER BY created_at ASC
                """,
                (conversation_id,),
            )
            return await result.fetchall()

    async def add_message(
        self,
        *,
        conversation_id: str,
        role: str,
        content: str,
        kind: str,
    ) -> dict[str, Any]:
        message_id = uuid.uuid4()
        now = utc_now()
        async with self.pool.connection() as connection, connection.transaction():
            await connection.execute(
                """
                INSERT INTO voyagemesh_messages
                    (id, conversation_id, role, content, kind, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (message_id, conversation_id, role, content, kind, now),
            )
        return {
            "id": str(message_id),
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "kind": kind,
            "created_at": now.isoformat(),
        }

    async def sync_from_payload(
        self,
        *,
        thread_id: str,
        user_id: str,
        payload: dict[str, Any],
        assistant_content: str | None = None,
    ) -> None:
        record = await self.require_thread(thread_id, user_id)
        constraints = payload.get("trip_constraints") or {}
        title = derive_title(constraints, payload.get("answer") or "")
        status = map_status(str(payload.get("status") or "draft"))
        cover = {
            "destination": constraints.get("destination", ""),
            "origin": constraints.get("origin", ""),
            "travel_dates": constraints.get("travel_dates", ""),
            "traveler_count": constraints.get("traveler_count", ""),
            "budget": constraints.get("budget", ""),
        }
        now = utc_now()
        async with self.pool.connection() as connection, connection.transaction():
            await connection.execute(
                """
                UPDATE voyagemesh_conversations
                SET title = %s, status = %s, updated_at = %s
                WHERE thread_id = %s AND user_id = %s AND deleted_at IS NULL
                """,
                (title, status, now, thread_id, user_id),
            )
            await connection.execute(
                """
                UPDATE voyagemesh_trips
                SET title = %s, status = %s, cover = %s::jsonb, latest_payload = %s::jsonb, updated_at = %s
                WHERE thread_id = %s AND user_id = %s AND deleted_at IS NULL
                """,
                (
                    title,
                    status,
                    json.dumps(cover),
                    json.dumps(payload),
                    now,
                    thread_id,
                    user_id,
                ),
            )
        if assistant_content:
            await self.add_message(
                conversation_id=str(record["conversation_id"]),
                role="assistant",
                content=assistant_content,
                kind="assistant",
            )

    async def rename(self, conversation_id: str, user_id: str, title: str) -> dict[str, Any]:
        record = await self.get_conversation(conversation_id, user_id)
        if record is None:
            raise LookupError("Conversation not found")
        now = utc_now()
        async with self.pool.connection() as connection, connection.transaction():
            await connection.execute(
                """
                UPDATE voyagemesh_conversations
                SET title = %s, updated_at = %s
                WHERE id = %s AND user_id = %s
                """,
                (title, now, conversation_id, user_id),
            )
            await connection.execute(
                """
                UPDATE voyagemesh_trips
                SET title = %s, updated_at = %s
                WHERE conversation_id = %s AND user_id = %s
                """,
                (title, now, conversation_id, user_id),
            )
        return {**record, "title": title, "updated_at": now}

    async def soft_delete(self, conversation_id: str, user_id: str) -> None:
        record = await self.get_conversation(conversation_id, user_id)
        if record is None:
            raise LookupError("Conversation not found")
        now = utc_now()
        async with self.pool.connection() as connection, connection.transaction():
            await connection.execute(
                """
                UPDATE voyagemesh_conversations
                SET deleted_at = %s, updated_at = %s
                WHERE id = %s AND user_id = %s
                """,
                (now, now, conversation_id, user_id),
            )
            await connection.execute(
                """
                UPDATE voyagemesh_trips
                SET deleted_at = %s, updated_at = %s
                WHERE conversation_id = %s AND user_id = %s
                """,
                (now, now, conversation_id, user_id),
            )
