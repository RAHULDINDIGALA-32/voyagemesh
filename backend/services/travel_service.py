import uuid
from typing import Any

from langgraph.graph.state import CompiledStateGraph
from starlette.concurrency import run_in_threadpool

from graph.workflow import build_graph
from infrastructure.database import Database


class TravelService:
    def __init__(self):
        self.database = Database()
        self.graph: CompiledStateGraph | None = None

    def startup(self) -> None:
        checkpointer = self.database.connect()
        self.graph = build_graph(checkpointer=checkpointer)

    def shutdown(self) -> None:
        self.database.close()
        self.graph = None

    def _get_graph(self) -> CompiledStateGraph:
        if self.graph is None:
            raise RuntimeError("Travel service is not initialized")

        return self.graph

    @staticmethod
    def _config(
        thread_id: str,
        request_id: str,
    ) -> dict:
        return {
            "configurable": {
                "thread_id": thread_id,
            },
            "metadata": {
                "request_id": request_id,
                "workflow": "voyagemesh",
                "version": "1",
            },
        }

    def _format_result(
        self,
        result: dict[str, Any],
        request_id: str,
        thread_id: str,
    ) -> dict:
        return {
            "request_id": request_id,
            "thread_id": thread_id,
            "status": "completed",
            "answer": result.get("final_answer"),
            "flight_results": result.get("flight_results"),
            "hotel_results": result.get("hotel_results"),
            "itinerary": result.get("itinerary"),
            "errors": result.get("errors", []),
        }

    def create_trip(self, query: str) -> dict:
        graph = self._get_graph()

        request_id = uuid.uuid4().hex
        thread_id = f"trip_{uuid.uuid4().hex}"

        config = self._config(
            thread_id=thread_id,
            request_id=request_id,
        )

        initial_state = {
            "user_query": query,
            "request_id": request_id,
            "flight_results": "",
            "hotel_results": "",
            "itinerary": "",
            "final_answer": "",
            "errors": [],
        }

        result = graph.invoke(
            initial_state,
            config=config,
        )

        return self._format_result(
            result,
            request_id,
            thread_id,
        )

    async def stream_trip(self, query: str):
        request_id = uuid.uuid4().hex
        thread_id = f"trip_{uuid.uuid4().hex}"

        graph = self._get_graph()

        config = self._config(
            thread_id=thread_id,
            request_id=request_id,
        )

        initial_state = {
            "user_query": query,
            "request_id": request_id,
            "flight_results": "",
            "hotel_results": "",
            "itinerary": "",
            "final_answer": "",
            "errors": [],
        }

        yield {
            "event": "started",
            "data": {
                "request_id": request_id,
                "thread_id": thread_id,
            },
        }

        async for chunk in graph.astream(
            initial_state,
            config=config,
            stream_mode="updates",
        ):
            for node_name in chunk:
                yield {
                    "event": "progress",
                    "data": {
                        "node": node_name,
                        "status": "completed",
                    },
                }

        result = await run_in_threadpool(
            self.get_trip,
            thread_id,
        )

        yield {
            "event": "completed",
            "data": result,
        }

    def get_trip(self, thread_id: str) -> dict:
        graph = self._get_graph()

        snapshot = graph.get_state(
            {
                "configurable": {
                    "thread_id": thread_id,
                }
            }
        )

        if not snapshot.values:
            raise LookupError("Trip not found")

        values = snapshot.values

        return self._format_result(
            values,
            values.get("request_id", ""),
            thread_id,
        )
