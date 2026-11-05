# Project: LLM Usage Control Demo

<!-- Every agent reads this. Rules, not essays. PRD: docs/prd.md -->

## Stack (tech-lead enforces this)
- Runtime: Node 22, npm 10, TypeScript strict everywhere
- Backend: Express 5 + TypeScript, Sequelize v6 ORM (`sequelize` + `pg`) for DB access, `sequelize-cli` for migrations and seeders
- Frontend: Angular 20 (standalone components, signals), Angular Material for UI; `marked` + `DOMPurify` for rendering assistant Markdown (always sanitise before binding HTML). Visual design source of truth: docs/ux/ui-design.md
- LLM: LiteLLM proxy (Docker) → Anthropic Claude. LiteLLM has its own Postgres database (`LITELLM_DATABASE_URL`, a separate DB on the same user-provided server, never the app's DB) for its keys/models/spend logs; the app never reads it. Models are still defined in `litellm/config.yaml`. The app calls LiteLLM's OpenAI-compatible API via the `openai` npm client pointed at `LITELLM_BASE_URL`
- DB: PostgreSQL (user-provided, connection from `.env`; not run in Docker). App DB = `DATABASE_URL`; LiteLLM DB = `LITELLM_DATABASE_URL` (same server, separate database)
- Auth: email/password, bcrypt hashes, JWT bearer tokens
- Tests: Jest + supertest (backend unit/integration), Angular default test runner (frontend unit), Playwright (acceptance, `tests/acceptance/`)
- Not allowed: no other ORMs/query builders (Prisma/TypeORM/Knex), no `sequelize.sync()` for schema changes (migrations only), no direct Anthropic SDK calls (always via LiteLLM), no `any`, no float math for money (use `numeric` in DB, decimal strings/`decimal.js` in code), no Docker for app or Postgres, no Langfuse

## Layout
- backend/ — Express API (`backend/src`, models in `backend/src/models`, migrations in `backend/migrations`, seeders in `backend/seeders`)
- frontend/ — Angular app (`frontend/src`)
- litellm/ — `docker-compose.yml` + `config.yaml` (the only Docker component)
- package.json (root) — npm workspaces `backend`, `frontend`; root scripts below run both
- tests/acceptance/ — QA-owned Playwright tests (engineer doesn't edit)
- docs/prd.md — PRD (PM-owned)
- docs/tech-spec.md — tech spec (tech-lead-owned)
- docs/reviews/ — review verdicts
- docs/qa/report.md — QA results
- .env (not committed), .env.example (committed)

## Commands (run from repo root)
- Install: `npm install`
- LiteLLM: `docker compose --env-file .env -f litellm/docker-compose.yml up -d`
- Migrate DB: `npm run migrate`
- Run backend: `npm run dev:backend`
- Run frontend: `npm run dev:frontend`
- Lint: `npm run lint`
- Unit tests: `npm test`
- Acceptance tests: `npx playwright test tests/acceptance`

## Conventions
- Timezone: store timestamps as UTC `timestamptz`; all quota periods and displayed times use `Asia/Kolkata`
- Money: USD, `DECIMAL(14,6)` (Sequelize returns it as a string — keep it a string/`decimal.js`, never `parseFloat`); cost always taken from LiteLLM's per-request cost, never recomputed in app
- Config/secrets only via env (`.env` loaded with dotenv); never log secrets, tokens or passwords
- API: REST under `/api`, JSON; errors as `{ "error": { "code": "UPPER_SNAKE", "message": "..." } }` (e.g. `USER_QUOTA_EXCEEDED`, `SYSTEM_QUOTA_EXCEEDED`)
- Chat streaming via Server-Sent Events
- Validate all request bodies at the route boundary (zod)
- Backend layering: routes → services → repositories (Sequelize model queries live in repositories only; raw SQL via `sequelize.query` only for aggregates, with replacements — never string concatenation)
- Quota check + ledger writes that must be consistent use a Sequelize transaction
- Names: files kebab-case, classes PascalCase, DB tables/columns snake_case

## Delivery pipeline
- /prd → interview + docs/prd.md
- /ship → tech-lead design + ux-designer design review → engineer → tech-lead review (score ≥ 90) → qa (100% ACs, coverage ≥ 80%) → ux-designer audit (UX score ≥ 85) → pm-acceptance; loops end on threshold or stall guard
