import uuid
from typing import Any

from langgraph.graph.state import CompiledStateGraph

from graph.workflow import build_graph
from infrastructure.database import Database


class TravelService:
    def __init__(self):
        self.database = Database()
        self.graph: CompiledStateGraph | None = None

    async def startup(self) -> None:
        checkpointer = await self.database.connect()
        self.graph = build_graph(checkpointer=checkpointer)

    async def shutdown(self) -> None:
        await self.database.close()
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
                "version": "3",
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
            "weather_results": result.get("weather_results"),
            "budget_analysis": result.get("budget_analysis"),
            "itinerary": result.get("itinerary"),
            "selected_agents": result.get("selected_agents", []),
            "trip_constraints": result.get("trip_constraints", {}),
            "errors": result.get("errors", []),
        }

    async def create_trip(self, query: str) -> dict:
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
            "trip_constraints": {},
            "selected_agents": [],
            "supervisor_reasoning": "",
            "completed_agents": [],
            "flight_results": "",
            "hotel_results": "",
            "weather_results": "",
            "budget_analysis": "",
            "itinerary": "",
            "final_answer": "",
            "errors": [],
        }

        result = await graph.ainvoke(
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
            "trip_constraints": {},
            "selected_agents": [],
            "supervisor_reasoning": "",
            "completed_agents": [],
            "flight_results": "",
            "hotel_results": "",
            "weather_results": "",
            "budget_analysis": "",
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

        result = await self.get_trip(thread_id)

        yield {
            "event": "completed",
            "data": result,
        }

    async def get_trip(self, thread_id: str) -> dict:
        graph = self._get_graph()

        snapshot = await graph.aget_state(
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

    async def get_trip_state(self, thread_id: str) -> dict:
        """Return checkpoint metadata without blocking the API event loop."""
        graph = self._get_graph()
        snapshot = await graph.aget_state(
            {"configurable": {"thread_id": thread_id}}
        )
        if not snapshot.values:
            raise LookupError("Trip not found")

        return {
            "thread_id": thread_id,
            "next": list(snapshot.next),
            "checkpoint_id": snapshot.config.get("configurable", {}).get(
                "checkpoint_id"
            ),
        }
