import hashlib
import hmac
import secrets
import uuid
from typing import Any

from langgraph.graph.state import CompiledStateGraph

from graph.workflow import build_graph
from hitl.contracts import HumanResponseRequest, validate_human_response
from infrastructure.database import Database
from infrastructure.product_repository import ProductRepository
from langgraph.types import Command


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

    def _product(self) -> ProductRepository:
        repository = self.database.product_repository
        if repository is None:
            raise RuntimeError("Product repository is not initialized")
        return repository

    def _persistable(self, result: dict) -> dict:
        return {key: value for key, value in result.items() if key != "workflow_token"}

    def _assistant_copy(self, result: dict) -> str:
        intervention = result.get("human_intervention") or {}
        if result.get("status") == "awaiting_human":
            return str(intervention.get("question") or "I need a decision before I continue.")
        if result.get("status") == "blocked":
            return str(result.get("answer") or "I can't process that request.")
        return str(result.get("answer") or result.get("itinerary") or "Plan updated.")

    async def _persist_result(self, thread_id: str, user_id: str, result: dict) -> None:
        await self._product().sync_from_payload(
            thread_id=thread_id,
            user_id=user_id,
            payload=self._persistable(result),
            assistant_content=self._assistant_copy(result),
        )

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
        workflow_token: str | None = None,
    ) -> dict:
        result_payload = {
            "request_id": request_id,
            "thread_id": thread_id,
            "status": result.get("execution_status", "completed"),
            "answer": result.get("final_answer"),
            "flight_results": result.get("flight_results"),
            "hotel_results": result.get("hotel_results"),
            "weather_results": result.get("weather_results"),
            "budget_analysis": result.get("budget_analysis"),
            "itinerary": result.get("itinerary"),
            "trip_document": result.get("trip_document") or {},
            "selected_agents": result.get("selected_agents", []),
            "trip_constraints": result.get("trip_constraints", {}),
            "input_guardrail": result.get("input_guardrail", {}),
            "output_validation": result.get("output_validation", {}),
            "human_intervention": result.get("human_intervention", {}),
            "errors": result.get("errors", []),
        }
        if workflow_token is not None:
            result_payload["workflow_token"] = workflow_token
        return result_payload

    @staticmethod
    def _new_workflow_token() -> tuple[str, str]:
        token = secrets.token_urlsafe(32)
        return token, hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _initial_state(query: str, request_id: str, token_hash: str) -> dict:
        return {
            "user_query": query,
            "request_id": request_id,
            "workflow_token_hash": token_hash,
            "trip_constraints": {},
            "selected_agents": [],
            "supervisor_reasoning": "",
            "completed_agents": [],
            "request_blocked": False,
            "blocked_reason": "",
            "execution_status": "running",
            "input_guardrail": {},
            "output_validation": {},
            "human_intervention": {},
            "human_response": {},
            "hitl_version": 0,
            "itinerary_version": 0,
            "user_preferences": {},
            "rerun_agents": [],
            "flight_results": "",
            "hotel_results": "",
            "weather_results": "",
            "budget_analysis": "",
            "itinerary": "",
            "final_answer": "",
            "trip_document": {},
            "errors": [],
        }

    async def _sync_pending_intervention(self, thread_id: str, values: dict) -> None:
        intervention = values.get("human_intervention", {})
        if intervention.get("status") != "pending":
            return
        repository = self.database.hitl_repository
        if repository is None:
            raise RuntimeError("HITL repository is not initialized")
        await repository.ensure_pending(thread_id, intervention)

    async def create_trip(self, query: str, user_id: str) -> dict:
        graph = self._get_graph()

        request_id = uuid.uuid4().hex
        thread_id = f"trip_{uuid.uuid4().hex}"
        workflow_token, token_hash = self._new_workflow_token()
        owned = await self._product().create_owned_thread(
            user_id=user_id,
            thread_id=thread_id,
            query=query,
        )

        config = self._config(
            thread_id=thread_id,
            request_id=request_id,
        )

        await graph.ainvoke(self._initial_state(query, request_id, token_hash), config=config)
        result = await self.get_trip(thread_id, user_id)
        await self._sync_pending_intervention(thread_id, await self._get_state_values(thread_id))
        result["workflow_token"] = workflow_token
        result["conversation_id"] = owned["conversation_id"]
        result["trip_id"] = owned["trip_id"]
        await self._persist_result(thread_id, user_id, result)
        return result

    async def stream_trip(self, query: str, user_id: str):
        request_id = uuid.uuid4().hex
        thread_id = f"trip_{uuid.uuid4().hex}"
        workflow_token, token_hash = self._new_workflow_token()
        owned = await self._product().create_owned_thread(
            user_id=user_id,
            thread_id=thread_id,
            query=query,
        )

        graph = self._get_graph()

        config = self._config(
            thread_id=thread_id,
            request_id=request_id,
        )

        initial_state = self._initial_state(query, request_id, token_hash)

        yield {
            "event": "started",
            "data": {
                "request_id": request_id,
                "thread_id": thread_id,
                "workflow_token": workflow_token,
                "conversation_id": owned["conversation_id"],
                "trip_id": owned["trip_id"],
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

        result = await self.get_trip(thread_id, user_id)
        await self._sync_pending_intervention(thread_id, await self._get_state_values(thread_id))
        result["conversation_id"] = owned["conversation_id"]
        result["trip_id"] = owned["trip_id"]
        await self._persist_result(thread_id, user_id, result)

        yield {
            "event": "awaiting_human" if result["status"] == "awaiting_human" else "completed",
            "data": result,
        }

    async def _get_state_values(self, thread_id: str) -> dict:
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
        return snapshot.values

    async def get_trip(self, thread_id: str, user_id: str | None = None) -> dict:
        if user_id is not None:
            owned = await self._product().require_thread(thread_id, user_id)
        else:
            owned = None
        values = await self._get_state_values(thread_id)
        result = self._format_result(
            values,
            values.get("request_id", ""),
            thread_id,
        )
        if owned is not None:
            result["conversation_id"] = str(owned["conversation_id"])
            result["trip_id"] = str(owned["trip_id"])
            result["title"] = owned["title"]
        return result

    async def respond_to_intervention(
        self, thread_id: str, response: HumanResponseRequest, user_id: str
    ) -> dict:
        await self._product().require_thread(thread_id, user_id)
        values = await self._get_state_values(thread_id)
        expected_hash = values.get("workflow_token_hash", "")
        actual_hash = hashlib.sha256(response.workflow_token.encode("utf-8")).hexdigest()
        if not expected_hash or not hmac.compare_digest(expected_hash, actual_hash):
            raise PermissionError("Invalid workflow token")

        intervention = values.get("human_intervention", {})
        sanitized_response = validate_human_response(intervention, response)
        repository = self.database.hitl_repository
        if repository is None:
            raise RuntimeError("HITL repository is not initialized")
        await repository.ensure_pending(thread_id, intervention)
        claim = await repository.claim(
            thread_id=thread_id,
            intervention_id=response.intervention_id,
            state_version=response.expected_version,
            response=sanitized_response,
        )
        if claim.status != "claimed":
            return await self.get_trip(thread_id, user_id)

        try:
            await self._get_graph().ainvoke(
                Command(resume=sanitized_response),
                config={"configurable": {"thread_id": thread_id}},
            )
        except Exception:
            await repository.release(response.intervention_id)
            raise

        await repository.finalize(response.intervention_id)
        values = await self._get_state_values(thread_id)
        await self._sync_pending_intervention(thread_id, values)
        result = self._format_result(values, values.get("request_id", ""), thread_id)
        await self._persist_result(thread_id, user_id, result)
        return result

    def _revision_query(self, values: dict, query: str) -> str:
        constraints = values.get("trip_constraints") or {}
        itinerary = values.get("itinerary") or ""
        return (
            "Revise the existing voyage using the latest instruction. "
            "Keep confirmed facts unless the traveler asks to change them.\n\n"
            f"Constraints: {constraints}\n\n"
            f"Current itinerary:\n{itinerary[:4000]}\n\n"
            f"Instruction:\n{query}"
        )

    async def continue_trip(self, thread_id: str, query: str, user_id: str) -> dict:
        owned = await self._product().require_thread(thread_id, user_id)
        values = await self._get_state_values(thread_id)
        if values.get("execution_status") == "awaiting_human":
            raise RuntimeError("This voyage is waiting for a chart-room decision")
        await self._product().add_message(
            conversation_id=str(owned["conversation_id"]),
            role="user",
            content=query,
            kind="user",
        )
        graph = self._get_graph()
        request_id = uuid.uuid4().hex
        workflow_token, token_hash = self._new_workflow_token()
        config = self._config(thread_id=thread_id, request_id=request_id)
        state = self._initial_state(self._revision_query(values, query), request_id, token_hash)
        state["trip_constraints"] = values.get("trip_constraints") or {}
        state["user_preferences"] = values.get("user_preferences") or {}
        await graph.ainvoke(state, config=config)
        result = await self.get_trip(thread_id, user_id)
        await self._sync_pending_intervention(thread_id, await self._get_state_values(thread_id))
        result["workflow_token"] = workflow_token
        await self._persist_result(thread_id, user_id, result)
        return result

    async def stream_continue(self, thread_id: str, query: str, user_id: str):
        owned = await self._product().require_thread(thread_id, user_id)
        values = await self._get_state_values(thread_id)
        if values.get("execution_status") == "awaiting_human":
            raise RuntimeError("This voyage is waiting for a chart-room decision")
        await self._product().add_message(
            conversation_id=str(owned["conversation_id"]),
            role="user",
            content=query,
            kind="user",
        )
        request_id = uuid.uuid4().hex
        workflow_token, token_hash = self._new_workflow_token()
        graph = self._get_graph()
        config = self._config(thread_id=thread_id, request_id=request_id)
        state = self._initial_state(self._revision_query(values, query), request_id, token_hash)
        state["trip_constraints"] = values.get("trip_constraints") or {}
        state["user_preferences"] = values.get("user_preferences") or {}

        yield {
            "event": "started",
            "data": {
                "request_id": request_id,
                "thread_id": thread_id,
                "workflow_token": workflow_token,
                "conversation_id": str(owned["conversation_id"]),
                "trip_id": str(owned["trip_id"]),
            },
        }

        async for chunk in graph.astream(state, config=config, stream_mode="updates"):
            for node_name in chunk:
                yield {
                    "event": "progress",
                    "data": {"node": node_name, "status": "completed"},
                }

        result = await self.get_trip(thread_id, user_id)
        await self._sync_pending_intervention(thread_id, await self._get_state_values(thread_id))
        result["workflow_token"] = workflow_token
        await self._persist_result(thread_id, user_id, result)
        yield {
            "event": "awaiting_human" if result["status"] == "awaiting_human" else "completed",
            "data": result,
        }

    async def get_trip_state(self, thread_id: str, user_id: str) -> dict:
        await self._product().require_thread(thread_id, user_id)
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
