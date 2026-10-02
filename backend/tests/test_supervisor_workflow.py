import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from langgraph.checkpoint.memory import MemorySaver

from agents.supervisor import _parse_plan
from graph.workflow import build_graph, select_next_agent


class FakeLlm:
    def __init__(self, content: str):
        self.content = content

    async def ainvoke(self, *_args, **_kwargs):
        return SimpleNamespace(content=self.content)


class SupervisorWorkflowTests(unittest.IsolatedAsyncioTestCase):
    def test_supervisor_plan_is_validated_and_dependency_ordered(self):
        plan = _parse_plan(
            '{"selected_agents":["budget_agent","hotel_agent","hotel_agent"],'
            '"trip_constraints":{"destination":"Tokyo"},"reasoning":"test"}'
        )
        self.assertEqual(plan.selected_agents, ["hotel_agent", "budget_agent"])
        self.assertEqual(
            select_next_agent(
                {"selected_agents": plan.selected_agents, "completed_agents": []}
            ),
            "hotel_agent",
        )

    async def test_async_dynamic_workflow_persists_state(self):
        supervisor_llm = FakeLlm(
            '{"selected_agents":["itinerary_agent","budget_agent","hotel_agent"],'
            '"trip_constraints":{"destination":"Tokyo","duration":"4 days"},'
            '"reasoning":"Accommodation, budget, and plan requested."}'
        )
        specialist_llm = FakeLlm("Generated planning content")
        state = {
            "user_query": "Plan four days in Tokyo with hotel and budget options",
            "request_id": "test-request",
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
        config = {"configurable": {"thread_id": "test-v3-workflow"}}

        with (
            patch("agents.supervisor.get_llm", return_value=supervisor_llm),
            patch("agents.hotel.run_mcp_agent", new=AsyncMock(return_value="Hotel evidence")),
            patch("agents.budget.get_llm", return_value=specialist_llm),
            patch("agents.itinerary.get_llm", return_value=specialist_llm),
            patch("agents.final.get_llm", return_value=specialist_llm),
        ):
            graph = build_graph(MemorySaver())
            result = await graph.ainvoke(state, config=config)
            snapshot = await graph.aget_state(config)

        self.assertEqual(
            result["completed_agents"],
            ["hotel_agent", "budget_agent", "itinerary_agent"],
        )
        self.assertEqual(result["hotel_results"], "Hotel evidence")
        self.assertEqual(result["budget_analysis"], "Generated planning content")
        self.assertEqual(snapshot.values["final_answer"], "Generated planning content")


if __name__ == "__main__":
    unittest.main()
