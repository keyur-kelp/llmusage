# LLM Usage Control Demo

Chat assistant with firm-wide (monthly) and per-user (weekly) spend control. Angular + Express + PostgreSQL, with LiteLLM (Docker) as the only LLM gateway to Anthropic Claude. Spec: `docs/prd.md`, `docs/tech-spec.md`.

## Prerequisites
- Node 22, npm 10
- A PostgreSQL 18 database you can connect to (not run in Docker), plus a second empty database for integration tests
- Docker (for LiteLLM only)
- Google Chrome or Chromium (frontend unit tests run in ChromeHeadless)

## Run
1. `cp .env.example .env` and fill it in (see comments in the file). `.env` is git-ignored.
2. `npm install`
3. LiteLLM (Docker) has its own database and holds the Anthropic key. One-time setup:
   1. Create its database on the same Postgres server (never reuse `llmusage`): `createdb litellm` (or `psql -d postgres -c 'CREATE DATABASE litellm'`).
   2. Give the DB user a password if it has none (`ALTER ROLE <user> PASSWORD '...'`), because the container connects over the network, not as a trusted local client.
   3. In `.env` set `LITELLM_DATABASE_URL=postgres://<user>:<password>@host.docker.internal:5432/litellm` (container's view, so `host.docker.internal`, not `localhost`), plus `LITELLM_MASTER_KEY` and `LITELLM_SALT_KEY`. Set the salt key once and never change it.
   4. Start it: `docker compose --env-file .env -f litellm/docker-compose.yml up -d`. LiteLLM applies its own migrations to the `litellm` DB on startup; the app's `npm run migrate` does not touch it.
   5. Open http://localhost:4000/ui, log in with the master key, and add a credential named exactly `anthropic` holding your Anthropic API key (Models/Credentials). The key is stored encrypted in LiteLLM's DB and never appears in `.env` or the app.
   Models come from `litellm/config.yaml` (and any added in the UI); the picker default is `DEFAULT_MODEL` (default `claude-sonnet-5-5`).
4. Create the schema: `npm run migrate` (safe to re-run)
5. Backend: `npm run dev:backend` (http://localhost:3000). On first start it creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
6. Frontend: `npm run dev:frontend` (http://localhost:4200, proxies `/api` to the backend)

## Other commands
- Lint: `npm run lint`
- Unit + integration tests: `npm test` (backend integration tests need `DATABASE_URL_TEST`; without it they are reported as skipped, with a warning)
- Manual rollup: `npm run rollup -- --date=YYYY-MM-DD` (default: yesterday IST). A scheduled rollup also runs at 00:05 IST while the backend is up.
- Acceptance tests (QA-owned): `npx playwright test tests/acceptance`

## Notes
- All quota periods and displayed times use Asia/Kolkata; timestamps are stored in UTC.
- Cost is always the per-request cost reported by LiteLLM. The app never prices tokens itself.
- Migrations live in `backend/migrations` (TypeScript, compiled to `backend/dist-migrations` by `npm run migrate`).

- Frontend initial-bundle warning budget is 550 kB (error budget 1 MB; `frontend/angular.json`). Raised from 500 kB for the theme menu plus the v3 global styles (initial total about 519 kB).
