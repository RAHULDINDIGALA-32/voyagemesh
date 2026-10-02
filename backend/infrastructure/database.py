import asyncio

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from config import get_settings


class Database:
    def __init__(self):
        self.pool: AsyncConnectionPool | None = None
        self.checkpointer: AsyncPostgresSaver | None = None

    async def connect(self) -> AsyncPostgresSaver:
        settings = get_settings()
        last_error: Exception | None = None

        for attempt in range(3):
            try:
                self.pool = AsyncConnectionPool(
                    conninfo=settings.postgres_url,
                    min_size=1,
                    max_size=5,
                    kwargs={
                        "autocommit": True,
                        "prepare_threshold": 0,
                        "row_factory": dict_row,
                        "connect_timeout": 10,
                    },
                    open=False,
                )

                await self.pool.open()
                self.checkpointer = AsyncPostgresSaver(self.pool)
                await self.checkpointer.setup()
                return self.checkpointer
            except Exception as exc:
                last_error = exc
                if self.pool is not None:
                    await self.pool.close()
                    self.pool = None
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)

        raise RuntimeError("Unable to initialize Postgres checkpointer") from last_error

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()

        self.pool = None
        self.checkpointer = None
