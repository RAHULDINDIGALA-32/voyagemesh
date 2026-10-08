import asyncio
from copy import deepcopy
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from langgraph.graph.state import CompiledStateGraph

from graph.workflow import build_graph
from hitl.contracts import HumanResponseRequest, create_intervention, validate_human_response
from hitl.errors import (
    AlreadyResolved,
    ResumeInProgress,
    InvalidResponse,
    StaleIntervention,
)
from agents.structured import (
    budget_card_from,
    flight_card_from,
    hotel_card_from,
    itinerary_card_from,
    itinerary_is_valid,
    weather_card_from,
)
from infrastructure.database import Database
from infrastructure.product_repository import ProductRepository
from langgraph.types import Command

log = logging.getLogger(__name__)


def is_complete(values: dict[str, Any]) -> bool:
    document = values.get("trip_document") or {}
    if not document or not values.get("final_answer"):
        return False
    if "itinerary_agent" in values.get("selected_agents", []):
        if not (document.get("itinerary") or {}).get("days"):
            return False
    return (values.get("output_validation") or {}).get("allowed", True) is not False


def derive_status(values: dict[str, Any], next_nodes: tuple | list) -> str:
    intervention = values.get("human_intervention") or {}
    if values.get("request_blocked"):
        return "blocked"
    if values.get("execution_status") == "failed":
        return "failed"
    if values.get("execution_status") == "aborted":
        return "aborted"
    if intervention.get("status") == "pending":
        return "awaiting_human"
    if values.get("execution_status") == "resuming":
        return "resuming"
    if next_nodes:
        return "running"
    if is_complete(values):
        return "completed"
    return "incomplete"


class TravelService:
    def __init__(self):
        self.database = Database()
        self.graph: CompiledStateGraph | None = None
        self._resumes: dict[str, asyncio.Task] = {}
        self._streams: dict[str, asyncio.Task] = {}
        self._reaper_task: asyncio.Task | None = None

    async def startup(self) -> None:
        checkpointer = await self.database.connect()
        self.graph = build_graph(checkpointer=checkpointer)
        self._reaper_task = asyncio.create_task(self._reap_stale_resumes())

    async def shutdown(self) -> None:
        for task in self._resumes.values():
            task.cancel()
        for task in self._streams.values():
            task.cancel()
        if self._reaper_task is not None:
            self._reaper_task.cancel()
            await asyncio.gather(self._reaper_task, return_exceptions=True)
            self._reaper_task = None
        if self._resumes:
            await asyncio.gather(*self._resumes.values(), return_exceptions=True)
        self._resumes.clear()
        self._streams.clear()
        await self.database.close()
        self.graph = None

    async def _reap_stale_resumes(self) -> None:
        while True:
            try:
                await asyncio.sleep(60)
                repository = self.database.hitl_repository
                if repository is None:
                    continue
                for row in await repository.stale_resuming():
                    thread_id = row["thread_id"]
                    if thread_id in self._resumes:
                        continue
                    owner = await self._product().get_thread_owner(thread_id)
                    if owner is None:
                        continue
                    snapshot = await self._get_snapshot(thread_id)
                    if not snapshot.next:
                        await repository.finalize(row["intervention_id"])
                        continue
                    response = row.get("response") or {}
                    task = asyncio.create_task(
                        self._run_resume(
                            thread_id,
                            str(owner["user_id"]),
                            row["intervention_id"],
                            response,
                        )
                    )
                    self._resumes[thread_id] = task
                    task.add_done_callback(lambda done, key=thread_id: self._resume_done(key, done))
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("HITL resume reaper failed")

    def _product(self) -> ProductRepository:
        repository = self.database.product_repository
        if repository is None:
            raise RuntimeError("Product repository is not initialized")
        return repository

    def _persistable(self, result: dict) -> dict:
        return dict(result)

    def _assistant_copy(self, result: dict) -> str:
        intervention = result.get("human_intervention") or {}
        if result.get("status") == "awaiting_human":
            return str(
                intervention.get("question") or "I need a decision before I continue."
            )
        if result.get("status") == "blocked":
            return str(result.get("answer") or "I can't process that request.")
        return str(result.get("answer") or result.get("itinerary") or "Plan updated.")

    async def _persist_result(
        self, thread_id: str, user_id: str, result: dict, *, add_message: bool = False
    ) -> None:
        await self._product().sync_from_payload(
            thread_id=thread_id,
            user_id=user_id,
            payload=self._persistable(result),
            assistant_content=self._assistant_copy(result) if add_message else None,
        )

    @staticmethod
    def _is_empty(value: Any) -> bool:
        return value is None or value == "" or value == {} or value == []

    @classmethod
    def _merge_payload(cls, previous: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
        """Preserve completed voyage sections during partial follow-up runs.

        Follow-ups intentionally rerun only the requested work. LangGraph state
        updates can therefore contain empty values for sections that were not
        part of that run. Empty values must not erase a previously persisted
        section, while non-empty current values remain authoritative.
        """
        mergeable = {
            "answer",
            "flight_results",
            "hotel_results",
            "weather_results",
            "budget_analysis",
            "itinerary",
            "trip_document",
            "trip_summary",
            "flight_details",
            "hotel_details",
            "weather_details",
            "budget_details",
            "itinerary_details",
            "packing_list",
            "timeline",
            "trip_constraints",
            "user_preferences",
        }

        def merge_value(old: Any, new: Any) -> Any:
            if isinstance(old, dict) and isinstance(new, dict):
                merged = deepcopy(old)
                for key, value in new.items():
                    if key in merged:
                        merged[key] = merge_value(merged[key], value)
                    elif not cls._is_empty(value):
                        merged[key] = deepcopy(value)
                return merged
            if cls._is_empty(new) and not cls._is_empty(old):
                return deepcopy(old)
            return deepcopy(new)

        merged = deepcopy(previous)
        for key, value in current.items():
            if key in mergeable and key in previous:
                merged[key] = merge_value(previous[key], value)
            else:
                merged[key] = deepcopy(value)
        return merged

    async def _merge_with_latest(
        self, thread_id: str, user_id: str, result: dict[str, Any]
    ) -> dict[str, Any]:
        record = await self._product().require_thread(thread_id, user_id)
        previous = record.get("latest_payload") or {}
        return self._merge_payload(previous, result)

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
        next_nodes: tuple | list = (),
    ) -> dict:
        document = result.get("trip_document")
        if not isinstance(document, dict):
            document = {}

        # A workflow can pause at a review gate before final_agent runs. Keep the
        # trip page useful in that state by exposing the structured specialist
        # cards that already exist, rather than returning an empty document.
        flight_details = result.get("flight_details") or document.get("flights")
        hotel_details = result.get("hotel_details") or document.get("hotels")
        weather_details = result.get("weather_details") or document.get("weather")
        budget_details = result.get("budget_details") or document.get("budget")
        itinerary_details = result.get("itinerary_details") or document.get("itinerary")
        if not flight_details and result.get("flight_results"):
            flight_details = flight_card_from(str(result["flight_results"])).model_dump()
        if not hotel_details and result.get("hotel_results"):
            hotel_details = hotel_card_from(str(result["hotel_results"])).model_dump()
        if not weather_details and result.get("weather_results"):
            weather_details = weather_card_from(str(result["weather_results"])).model_dump()
        if not budget_details and result.get("budget_analysis"):
            budget_details = budget_card_from(str(result["budget_analysis"])).model_dump()
        if not itinerary_details and result.get("itinerary"):
            itinerary_details = itinerary_card_from(str(result["itinerary"])).model_dump()

        # `trip_document` remains the complete portable document. These named
        # fields are the stable API contract for clients that render one trip
        # area at a time, rather than parsing LLM text or JSON strings.
        result_payload = {
            "request_id": request_id,
            "thread_id": thread_id,
            "status": derive_status(result, next_nodes),
            "answer": result.get("final_answer", result.get("answer")),
            "flight_results": result.get("flight_results"),
            "hotel_results": result.get("hotel_results"),
            "weather_results": result.get("weather_results"),
            "budget_analysis": result.get("budget_analysis"),
            "itinerary": result.get("itinerary"),
            "trip_document": result.get("trip_document") or {},
            "trip_summary": result.get("trip_summary")
            or document.get("trip_summary")
            or "",
            "flight_details": flight_details or {},
            "hotel_details": hotel_details or {},
            "weather_details": weather_details or {},
            "budget_details": budget_details or {},
            "itinerary_details": itinerary_details or {},
            "packing_list": result.get("packing_list") or document.get("packing") or {},
            "timeline": result.get("timeline") or document.get("timeline") or {},
            "selected_agents": result.get("selected_agents", []),
            "trip_constraints": result.get("trip_constraints", {}),
            "input_guardrail": result.get("input_guardrail", {}),
            "output_validation": result.get("output_validation", {}),
            "human_intervention": result.get("human_intervention", {}),
            "errors": result.get("errors", []),
        }
        return result_payload

    @staticmethod
    def _initial_state(query: str, request_id: str) -> dict:
        return {
            "user_query": query,
            "request_id": request_id,
            "trip_constraints": {},
            "selected_agents": [],
            "supervisor_reasoning": "",
            "completed_agents": ["__reset__"],
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
            "errors": ["__reset__"],
        }

    @classmethod
    def _continuation_state(
        cls, values: dict[str, Any], query: str, request_id: str
    ) -> dict[str, Any]:
        """Build a new run without discarding the existing voyage document."""
        state = cls._initial_state(query, request_id)
        for key in (
            "trip_constraints",
            "user_preferences",
            "flight_results",
            "hotel_results",
            "weather_results",
            "budget_analysis",
            "itinerary",
            "trip_document",
            "trip_summary",
            "flight_details",
            "hotel_details",
            "weather_details",
            "budget_details",
            "itinerary_details",
            "packing_list",
            "timeline",
        ):
            if key in values:
                state[key] = deepcopy(values[key])
        # A follow-up is a fresh request, but it is still based on this voyage.
        # These fields must not carry a prior pause or terminal status forward.
        state["human_intervention"] = {}
        state["human_response"] = {}
        state["execution_status"] = "running"
        state["failure_reason"] = ""
        return state

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
        owned = await self._product().create_owned_thread(
            user_id=user_id,
            thread_id=thread_id,
            query=query,
        )

        config = self._config(
            thread_id=thread_id,
            request_id=request_id,
        )

        await graph.ainvoke(
            self._initial_state(query, request_id), config=config
        )
        result = await self._project(thread_id, user_id, add_message=True)
        result["conversation_id"] = owned["conversation_id"]
        result["trip_id"] = owned["trip_id"]
        await self._persist_result(thread_id, user_id, result)
        return result

    async def stream_trip(self, query: str, user_id: str):
        request_id = uuid.uuid4().hex
        thread_id = f"trip_{uuid.uuid4().hex}"
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

        initial_state = self._initial_state(query, request_id)

        yield {
            "event": "started",
            "data": {
                "request_id": request_id,
                "thread_id": thread_id,
                "conversation_id": str(owned["conversation_id"]),
                "trip_id": str(owned["trip_id"]),
            },
        }

        queue: asyncio.Queue = asyncio.Queue()
        task = asyncio.create_task(
            self._run_stream(thread_id, user_id, initial_state, config, queue, owned)
        )
        self._streams[thread_id] = task
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            # Closing the HTTP/SSE consumer deliberately does not cancel the
            # tracked workflow. Navigation is not an abort action.
            if task.done():
                self._streams.pop(thread_id, None)

    async def _run_stream(
        self,
        thread_id: str,
        user_id: str,
        initial_state: dict,
        config: dict,
        queue: asyncio.Queue,
        owned: dict,
    ) -> None:
        try:
            async for chunk in self._get_graph().astream(
                initial_state, config=config, stream_mode="updates"
            ):
                for node_name in chunk:
                    await queue.put({
                        "event": "progress",
                        "data": {"node": node_name, "status": "completed"},
                    })
            result = await self._project(thread_id, user_id, add_message=True)
            result["conversation_id"] = str(owned["conversation_id"])
            result["trip_id"] = str(owned["trip_id"])
            await queue.put({
                "event": "awaiting_human" if result["status"] == "awaiting_human" else "completed",
                "data": result,
            })
        except asyncio.CancelledError:
            log.info("stream cancelled thread=%s", thread_id)
            raise
        except Exception as exc:
            log.exception("stream failed thread=%s", thread_id)
            try:
                await self._get_graph().aupdate_state(
                    {"configurable": {"thread_id": thread_id}},
                    {"execution_status": "failed", "failure_reason": type(exc).__name__,
                     "errors": [f"stream: {type(exc).__name__}"]},
                )
                await self._project(thread_id, user_id)
            finally:
                await queue.put({"event": "error", "data": {"detail": "Travel planning workflow failed"}})
        finally:
            await queue.put(None)
            self._streams.pop(thread_id, None)

    async def _get_snapshot(self, thread_id: str):
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
        return snapshot

    async def _get_state_values(self, thread_id: str) -> dict:
        return (await self._get_snapshot(thread_id)).values

    async def _project(
        self, thread_id: str, user_id: str, *, add_message: bool = False
    ) -> dict:
        snapshot = await self._get_snapshot(thread_id)
        result = self._format_result(
            snapshot.values,
            snapshot.values.get("request_id", ""),
            thread_id,
            list(snapshot.next),
        )
        result = await self._merge_with_latest(thread_id, user_id, result)
        await self._sync_pending_intervention(thread_id, snapshot.values)
        await self._persist_result(thread_id, user_id, result, add_message=add_message)
        log.info("projection written thread=%s status=%s", thread_id, result["status"])
        return result

    async def cancel_trip(self, thread_id: str, user_id: str) -> dict:
        owned = await self._product().require_thread(thread_id, user_id)
        await self._get_graph().aupdate_state(
            {"configurable": {"thread_id": thread_id}},
            {
                "execution_status": "aborted",
                "final_answer": "Planning was stopped by you. You can continue this chat whenever you are ready.",
                "failure_reason": "user_aborted",
            },
        )
        task = self._streams.get(thread_id) or self._resumes.get(thread_id)
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        result = await self._project(thread_id, user_id, add_message=True)
        result["conversation_id"] = str(owned["conversation_id"])
        result["trip_id"] = str(owned["trip_id"])
        result["title"] = owned["title"]
        return result

    async def delete_conversation(self, conversation_id: str, user_id: str) -> None:
        record = await self._product().get_conversation(conversation_id, user_id)
        if record is None:
            raise LookupError("Conversation not found")
        await self.cancel_trip(str(record["thread_id"]), user_id)
        await self._product().soft_delete(conversation_id, user_id)

    async def get_trip(
        self,
        thread_id: str,
        user_id: str | None = None,
        *,
        prefer_persisted: bool = True,
    ) -> dict:
        if user_id is not None:
            owned = await self._product().require_thread(thread_id, user_id)
        else:
            owned = None
        snapshot = await self._get_snapshot(thread_id)
        live_status = derive_status(snapshot.values, list(snapshot.next))
        stored_payload = owned.get("latest_payload") if owned is not None else None
        if user_id is not None and live_status in {
            "running", "awaiting_human", "resuming", "incomplete", "failed"
        }:
            result = await self._project(thread_id, user_id)
            result["thread_id"] = thread_id
            result["conversation_id"] = str(owned["conversation_id"])
            result["trip_id"] = str(owned["trip_id"])
            result["title"] = owned["title"]
            return result
        if (not prefer_persisted or not isinstance(stored_payload, dict)
                or not stored_payload or live_status in {
                    "running", "awaiting_human", "resuming", "incomplete", "failed"
                }):
            result = self._format_result(
                snapshot.values,
                snapshot.values.get("request_id", ""),
                thread_id,
                list(snapshot.next),
            )
        else:
            result = self._format_result(
                stored_payload,
                str(stored_payload.get("request_id") or ""),
                thread_id,
                list(snapshot.next),
            )
        if owned is not None:
            result["thread_id"] = thread_id
            result["conversation_id"] = str(owned["conversation_id"])
            result["trip_id"] = str(owned["trip_id"])
            result["title"] = owned["title"]
        return result

    async def respond_to_intervention(
        self, thread_id: str, response: HumanResponseRequest, user_id: str
    ) -> dict:
        await self._product().require_thread(thread_id, user_id)
        snapshot = await self._get_snapshot(thread_id)
        intervention = snapshot.values.get("human_intervention", {})
        if (intervention.get("intervention_id") == response.intervention_id
                and intervention.get("status") != "pending"):
            return await self._project(thread_id, user_id)
        sanitized_response = validate_human_response(intervention, response)
        repository = self.database.hitl_repository
        if repository is None:
            raise RuntimeError("HITL repository is not initialized")
        await repository.ensure_pending(thread_id, intervention)
        try:
            claim = await repository.claim(
                thread_id=thread_id,
                intervention_id=response.intervention_id,
                state_version=response.expected_version,
                response=sanitized_response,
            )
        except LookupError as exc:
            raise StaleIntervention("This review is stale. Please reload the voyage.") from exc
        log.info(
            "HITL decision claimed thread=%s intervention=%s version=%s status=%s",
            thread_id, response.intervention_id, response.expected_version, claim.status,
        )
        if claim.status == "in_progress":
            raise ResumeInProgress("This decision is already being applied")
        if claim.status == "resolved":
            raise AlreadyResolved("This decision has already been applied")

        await self._get_graph().aupdate_state(
            {"configurable": {"thread_id": thread_id}},
            {"execution_status": "resuming"},
        )
        task = asyncio.create_task(
            self._run_resume(thread_id, user_id, response.intervention_id, sanitized_response)
        )
        self._resumes[thread_id] = task
        task.add_done_callback(lambda done: self._resume_done(thread_id, done))
        result = await self._project(thread_id, user_id)
        result["status"] = "resuming"
        return result

    def _resume_done(self, thread_id: str, task: asyncio.Task) -> None:
        self._resumes.pop(thread_id, None)
        if not task.cancelled() and task.exception() is not None:
            log.exception("resume task failed thread=%s", thread_id, exc_info=task.exception())

    async def _run_resume(
        self, thread_id: str, user_id: str, intervention_id: str, resume_payload: dict
    ) -> None:
        repository = self.database.hitl_repository
        if repository is None:
            raise RuntimeError("HITL repository is not initialized")
        try:
            await self._get_graph().ainvoke(
                Command(resume=resume_payload),
                config={"configurable": {"thread_id": thread_id}},
            )
            await repository.finalize(intervention_id)
            log.info("resume finished thread=%s intervention=%s", thread_id, intervention_id)
        except Exception as exc:
            log.exception("resume failed thread=%s intervention=%s", thread_id, intervention_id)
            snapshot = await self._get_snapshot(thread_id)
            consumed = snapshot.values.get("human_intervention", {}).get("status") != "pending"
            if consumed:
                await repository.finalize(intervention_id)
            else:
                await repository.release(intervention_id)
            await self._get_graph().aupdate_state(
                {"configurable": {"thread_id": thread_id}},
                {
                    "execution_status": "failed",
                    "failure_reason": type(exc).__name__,
                    "errors": [f"resume: {type(exc).__name__}"],
                },
            )
        finally:
            # Persist the resumed chart message as well as the latest payload so
            # chat clients do not need a refresh to reconstruct the final turn.
            await self._project(thread_id, user_id, add_message=True)

    async def get_trip_status(self, thread_id: str, user_id: str) -> dict:
        await self._product().require_thread(thread_id, user_id)
        snapshot = await self._get_snapshot(thread_id)
        status = derive_status(snapshot.values, list(snapshot.next))
        return {
            "thread_id": thread_id,
            "status": status,
            "next": list(snapshot.next),
            "failure_reason": snapshot.values.get("failure_reason"),
            "errors": snapshot.values.get("errors", []),
            "human_intervention": snapshot.values.get("human_intervention", {}),
        }

    async def retry_resume(self, thread_id: str, user_id: str) -> dict:
        await self._product().require_thread(thread_id, user_id)
        snapshot = await self._get_snapshot(thread_id)
        if derive_status(snapshot.values, list(snapshot.next)) != "failed":
            raise InvalidResponse("Only failed workflows can be retried")
        if not snapshot.next:
            raise InvalidResponse("This workflow has no resumable work")
        await self._get_graph().aupdate_state(
            {"configurable": {"thread_id": thread_id}},
            {"execution_status": "resuming", "failure_reason": ""},
        )
        task = asyncio.create_task(self._run_retry(thread_id, user_id))
        self._resumes[thread_id] = task
        task.add_done_callback(lambda done: self._resume_done(thread_id, done))
        result = await self._project(thread_id, user_id)
        result["status"] = "resuming"
        return result

    async def _run_retry(self, thread_id: str, user_id: str) -> None:
        try:
            await self._get_graph().ainvoke(
                None, config={"configurable": {"thread_id": thread_id}}
            )
        except Exception as exc:
            log.exception("retry failed thread=%s", thread_id)
            await self._get_graph().aupdate_state(
                {"configurable": {"thread_id": thread_id}},
                {"execution_status": "failed", "failure_reason": type(exc).__name__,
                 "errors": [f"retry: {type(exc).__name__}"]},
            )
        finally:
            await self._project(thread_id, user_id, add_message=True)

    async def reopen_intervention(self, thread_id: str, user_id: str) -> dict:
        await self._product().require_thread(thread_id, user_id)
        snapshot = await self._get_snapshot(thread_id)
        values = snapshot.values
        card = itinerary_card_from(values.get("itinerary", ""))
        if not itinerary_is_valid(card, values.get("trip_constraints", {})):
            raise InvalidResponse("This itinerary is no longer valid for review")
        current = values.get("human_intervention", {})
        expired = False
        if current.get("expires_at"):
            try:
                expired = datetime.fromisoformat(current["expires_at"]) <= datetime.now(UTC)
            except ValueError:
                expired = True
        current_status = derive_status(values, list(snapshot.next))
        if not expired and current_status != "failed":
            raise InvalidResponse("This review cannot be reopened in its current state")
        if current.get("status") == "pending" and not expired:
            raise InvalidResponse("This review is already open")
        version = values.get("hitl_version", 0) + 1
        weather = weather_card_from(values.get("weather_results", ""))
        intervention = create_intervention(
            "itinerary_review",
            version=version,
            allowed_actions=["accept", "modify", "regenerate"],
            context={
                "itinerary_summary": card.summary[:400],
                "itinerary_days": [
                    {"day": day.day, "title": day.title, "summary": day.summary[:240],
                     "stops": [stop.title for stop in day.stops[:5]]}
                    for day in card.days[:14]
                ],
                "weather_preview": " · ".join(
                    part for part in (weather.headline, weather.metric, weather.summary) if part
                )[:500],
            },
            itinerary_version=values.get("itinerary_version", 0),
        )
        await self._get_graph().aupdate_state(
            {"configurable": {"thread_id": thread_id}},
            {"human_intervention": intervention, "hitl_version": version,
             "execution_status": "awaiting_human", "failure_reason": ""},
        )
        return await self._project(thread_id, user_id)

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
        values = self._merge_payload(
            owned.get("latest_payload") or {}, await self._get_state_values(thread_id)
        )
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
        config = self._config(thread_id=thread_id, request_id=request_id)
        state = self._continuation_state(
            values, self._revision_query(values, query), request_id
        )
        await graph.ainvoke(state, config=config)
        return await self._project(thread_id, user_id, add_message=True)

    async def stream_continue(self, thread_id: str, query: str, user_id: str):
        owned = await self._product().require_thread(thread_id, user_id)
        values = self._merge_payload(
            owned.get("latest_payload") or {}, await self._get_state_values(thread_id)
        )
        if values.get("execution_status") == "awaiting_human":
            raise RuntimeError("This voyage is waiting for a chart-room decision")
        await self._product().add_message(
            conversation_id=str(owned["conversation_id"]),
            role="user",
            content=query,
            kind="user",
        )
        request_id = uuid.uuid4().hex
        graph = self._get_graph()
        config = self._config(thread_id=thread_id, request_id=request_id)
        state = self._continuation_state(
            values, self._revision_query(values, query), request_id
        )

        yield {
            "event": "started",
            "data": {
                "request_id": request_id,
                "thread_id": thread_id,
                "conversation_id": str(owned["conversation_id"]),
                "trip_id": str(owned["trip_id"]),
            },
        }

        queue: asyncio.Queue = asyncio.Queue()
        task = asyncio.create_task(
            self._run_stream(thread_id, user_id, state, config, queue, owned)
        )
        self._streams[thread_id] = task
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            if task.done():
                self._streams.pop(thread_id, None)

    async def get_trip_state(self, thread_id: str, user_id: str) -> dict:
        await self._product().require_thread(thread_id, user_id)
        graph = self._get_graph()
        snapshot = await graph.aget_state({"configurable": {"thread_id": thread_id}})
        if not snapshot.values:
            raise LookupError("Trip not found")

        return {
            "thread_id": thread_id,
            "next": list(snapshot.next),
            "checkpoint_id": snapshot.config.get("configurable", {}).get(
                "checkpoint_id"
            ),
        }
