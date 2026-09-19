import time

from langgraph.checkpoint.postgres import PostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import get_settings


class Database:
    def __init__(self):
        self.pool: ConnectionPool | None = None
        self.checkpointer: PostgresSaver | None = None

    def connect(self) -> PostgresSaver:
        settings = get_settings()
        last_error: Exception | None = None

        for attempt in range(3):
            try:
                self.pool = ConnectionPool(
                    conninfo=settings.postgres_url,
                    min_size=1,
                    max_size=5,
                    kwargs={
                        "autocommit": True,
                        "prepare_threshold": 0,
                        "row_factory": dict_row,
                        "connect_timeout": 10,
                    },
                    open=True,
                )

                self.checkpointer = PostgresSaver(self.pool)
                self.checkpointer.setup()
                return self.checkpointer
            except Exception as exc:
                last_error = exc
                if self.pool is not None:
                    self.pool.close()
                    self.pool = None
                if attempt < 2:
                    time.sleep(2 ** attempt)

        raise RuntimeError("Unable to initialize Postgres checkpointer") from last_error

    def close(self) -> None:
        if self.pool is not None:
            self.pool.close()

        self.pool = None
        self.checkpointer = None