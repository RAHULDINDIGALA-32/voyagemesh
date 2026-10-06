import unittest
from types import SimpleNamespace

from mcp_integrations.agent_runner import (
    answer_from_messages,
    recover_failed_generation,
    recover_json_tool_payload,
)


class AgentRunnerRecoveryTests(unittest.TestCase):
    def test_recovers_gpt_oss_json_tool_envelope(self):
        raw = {
            "name": "json",
            "arguments": {
                "headline": "Stay in Bali",
                "summary": "Beach and jungle mix.",
                "options": [{"name": "Alila Ubud"}],
            },
        }
        payload = recover_json_tool_payload(raw)
        self.assertIn("Stay in Bali", payload)
        self.assertIn("Alila Ubud", payload)

    def test_recovers_failed_generation_from_groq_error_body(self):
        exc = SimpleNamespace(
            body={
                "error": {
                    "code": "tool_use_failed",
                    "failed_generation": (
                        '{"name":"json","arguments":{"headline":"HYD → DPS",'
                        '"summary":"Typical 10-12h hop."}}'
                    ),
                }
            }
        )
        recovered = recover_failed_generation(exc)
        self.assertIn("HYD → DPS", recovered)

    def test_answer_prefers_json_tool_calls_over_empty_text(self):
        message = SimpleNamespace(
            content="",
            tool_calls=[{"name": "json", "args": {"headline": "November in Bali", "metric": "23–30°C"}}],
            additional_kwargs={},
        )
        self.assertIn("November in Bali", answer_from_messages([message]))


if __name__ == "__main__":
    unittest.main()
