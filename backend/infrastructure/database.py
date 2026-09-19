
import psycopg
from psycopg.rows import dict_row

from langgraph.checkpoint.postgres import PostgresSaver

from backend.config import get_settings


class Database:
    def __init__(self):
        self.connection = None
        self.checkpointer = None

    def connect(self):
        settings = get_settings()

        self.connection = psycopg.connect(
            settings.postgres_url,
            autocommit=True,
            row_factory=dict_row,
            connect_timeout=10,
        )

        self.checkpointer = PostgresSaver(
            self.connection
        )

        # Run migrations/setup as a deployment step
        # in production, not on every application boot.
        return self.checkpointer

    def close(self):
        if self.connection is not None:
            self.connection.close()
            self.connection = None
            self.checkpointer = None