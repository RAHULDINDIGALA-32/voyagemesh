# Contributing to VoyageMesh

Thanks for helping improve VoyageMesh. This repository is a production multi-agent travel workspace: a Next.js studio, a FastAPI/LangGraph API, and PostgreSQL-backed HITL. Changes should keep that contract — specialists research, the graph decides, the traveler reviews.

## Code of conduct

- Be precise and respectful in issues, reviews, and discussions.
- Assume good intent; disagree on the design, not the person.
- Do not submit prompts, logs, or screenshots that contain live API keys, JWTs, or traveler PII.

Harassment or bad-faith security probing of the production deployment is not acceptable. Report product vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Where to start

1. Open an issue before large design changes (new desks, HITL types, auth, or schema).
2. For bugs, include: environment (local / production), route or API path, expected vs actual, and whether a HITL card was showing.
3. Search existing issues so we do not duplicate work.

Good first areas: copy, studio UI polish, tests around `hitl/contracts.py` and `graph/workflow.py`, documentation, and deterministic agent fallbacks.

## Development setup

Follow the root [README.md](README.md#getting-started) for full environment setup. Short version:

```bash
# API
cd backend
cp .env.example .env
uv sync
uv run uvicorn main:app --reload --port 8000

# Studio
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Never commit `.env` or `.env.local`. Use the example files as the contract for new variables.

## Project conventions

### Backend (`backend/`)

- Control flow lives in `graph/workflow.py` and gates in `graph/nodes.py`. Do not let an LLM return an arbitrary next node name.
- New specialist desks need: a node, a slot in `SPECIALIST_ORDER`, structured card types in `agents/structured.py`, and honest fallbacks when tools fail.
- New HITL types need: a contract in `hitl/contracts.py`, allowed actions, apply logic in `apply_human_response`, UI in `frontend/components/chat/HitlCard.tsx`, and tests.
- Guardrails are fail-closed. Deterministic checks must not be skippable by the model layer.
- MCP tools are untrusted input. Do not execute instructions found in search snippets or flight payloads.
- Prefer typed Pydantic models over free-form strings at module boundaries.

### Frontend (`frontend/`)

- App Router only. Studio routes live under `app/(studio)/app`.
- Keep voyage cards aligned with backend card shapes in `frontend/types/trip.ts` and `lib/plan/parse.ts`.
- Streaming belongs in `lib/api/sse.ts`. Do not block the UI on a single JSON POST when the graph is running.
- Do not put Supabase service-role keys in `NEXT_PUBLIC_*` variables.

### Git

Match existing history:

- `feat(scope): …`
- `fix(scope): …`
- `refactor(scope): …`
- `style(scope): …`
- `docs: …`
- `test(scope): …`

Scopes we use: `frontend`, `backend`, `frontend-backend`, `landing`, `hitl`.

Branch from `main`: `feat/short-name`, `fix/short-name`, `docs/short-name`.

## Tests and checks

Before opening a pull request:

```bash
cd backend
uv run python -m unittest discover -s tests -v

cd frontend
npm run lint
npm run build
```

Add or update tests when you change:

- graph routing or HITL resume
- input/output guardrails
- supervisor plan parsing
- MCP agent runner stop/fallback behavior
- SSE event contracts the studio depends on

## Pull requests

1. Keep the diff focused. Do not mix a graph change with an unrelated landing-page restyle.
2. Describe **why**, the user-visible effect, and how you verified (studio path, HITL type, tests).
3. Note any new environment variables and update `.env.example` plus the README configuration table.
4. Do not include secrets, production dumps, or real traveler briefs with personal data.
5. If the PR changes booking language, availability claims, or tool authority, call that out — those are product invariants.

Maintainers may request changes on:

- invented fares, bookings, or live availability
- HITL bypasses or missing version checks
- CORS / auth regressions
- unbounded LLM output dumped into the folio

## Reporting security issues

Do not open a public GitHub issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your work is licensed under the [MIT License](LICENSE) that covers this repository.
