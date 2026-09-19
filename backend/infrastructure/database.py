
from psycopg import Connection
from psycopg.rows import dict_row

from langgraph.checkpoint.postgres import PostgresSaver

from config import get_settings


class Database:
    def __init__(self):
        self.connection: Connection | None = None
        self.checkpointer: PostgresSaver | None = None

    def connect(self) -> PostgresSaver:
        settings = get_settings()

        self.connection = Connection.connect(
            settings.postgres_url,
            autocommit=True,
            row_factory=dict_row,
            connect_timeout=10,
        )

        self.checkpointer = PostgresSaver(
            self.connection
        )

        return self.checkpointer

    def close(self) -> None:
        if self.connection is not None:
            self.connection.close()

        self.connection = None
        self.checkpointer = None