# LLM Usage Control Demo

A chat assistant that limits LLM spending for a whole firm and for each user. Every message goes through a LiteLLM proxy to Anthropic Claude. Before each call, the app checks two USD quotas: a **system** quota per month and a **user** quota per week. It records the cost LiteLLM reports for each request, and blocks messages once a limit is reached. Admins set the quotas, see usage and manage users.

- Product requirements: [`docs/prd.md`](docs/prd.md). Technical design: [`docs/tech-spec.md`](docs/tech-spec.md). UI design: [`docs/ux/ui-design.md`](docs/ux/ui-design.md).
- Stack: Angular 20 + Angular Material, Express 5 + TypeScript, Sequelize + PostgreSQL, LiteLLM in Docker.

```
Browser (Angular, :4200) ──/api──▶ Backend (Express, :3000) ──OpenAI-compatible API──▶ LiteLLM (Docker, :4000) ──▶ Anthropic
                                        │                                                  │
                                        ▼                                                  ▼
                              Postgres DB "llmusage"                            Postgres DB "litellm"
                         (users, quotas, ledger, usage)                 (LiteLLM's own data + stored API key)
```

---

## 1. Tools you need

| Tool | Version | Used for | Check |
|---|---|---|---|
| **Node.js** | 22 or newer | Backend, frontend, tooling | `node -v` |
| **npm** | 10 or newer (ships with Node 22) | Installing packages, running scripts | `npm -v` |
| **PostgreSQL** | 18 (13 or newer should work) | App database, test database and LiteLLM's database. It runs on your machine or a server, **not in Docker** | `psql --version` |
| **Docker** (Docker Desktop on macOS/Windows) | Any recent version with `docker compose` | Runs LiteLLM, the only container | `docker compose version` |
| **Google Chrome** (or Chromium) | Any recent version | Frontend unit tests (ChromeHeadless) and acceptance tests | — |
| **Anthropic API key** | — | Used by LiteLLM to call Claude. You enter it in LiteLLM's UI, never in a file | — |
| **Git** | Any | Getting the code | `git --version` |

Optional:
- **`psql` / `createdb`** command-line tools, for creating databases. On macOS with Postgres.app, add `/Applications/Postgres.app/Contents/Versions/latest/bin` to your `PATH`.
- **`openssl`**, for generating random secrets.

> **Postgres.app users (macOS):** Postgres.app only lets approved apps connect without a password. If you see `Postgres.app rejected "trust" authentication`, open Postgres.app → Settings → **App Permissions** and allow the app that is connecting. That is your terminal for `npm` commands, and **Docker** (`com.docker.backend`) for LiteLLM. You can also give your database user a password and use it in the URLs below.

---

## 2. Set it up (first time)

All commands run from the repository root.

### 2.1 Get the code and install packages
```bash
git clone git@github.com:keyur-kelp/llmusage.git
cd llmusage
npm install
```

### 2.2 Create the databases
You need three databases on your Postgres server:

| Database | Used by | Notes |
|---|---|---|
| `llmusage` | The app | Created and updated by `npm run migrate` |
| `llmusage_test` | Backend integration tests | **Its tables are wiped by the tests.** Never point it at real data |
| `litellm` | LiteLLM | LiteLLM creates its own tables when it starts. Never reuse `llmusage` |

```bash
createdb llmusage
createdb llmusage_test
createdb litellm
```
LiteLLM connects from inside Docker, so its database user needs a password. If your user has none, set one:
```bash
psql -d postgres -c "ALTER ROLE <your_user> PASSWORD '<a-strong-password>'"
```

### 2.3 Create `.env`
```bash
cp .env.example .env
```
Then fill it in. `.env` is git-ignored, so never commit it.

| Variable | What to put |
|---|---|
| `DATABASE_URL` | `postgres://<user>:<password>@localhost:5432/llmusage` |
| `DATABASE_URL_TEST` | `postgres://<user>:<password>@localhost:5432/llmusage_test` (leave empty to skip integration tests) |
| `LITELLM_DATABASE_URL` | `postgres://<user>:<password>@host.docker.internal:5432/litellm`. Use **`host.docker.internal`, not `localhost`**, because the container reads this value |
| `LITELLM_MASTER_KEY` | A long random string (`openssl rand -hex 32`). It is also your login for the LiteLLM UI |
| `LITELLM_API_KEY` | **The same value** as `LITELLM_MASTER_KEY`. The backend uses it to call LiteLLM |
| `LITELLM_SALT_KEY` | A long random string. **Set it once and never change it**, or LiteLLM can no longer read the stored Anthropic key |
| `LITELLM_BASE_URL` | `http://localhost:4000` |
| `JWT_SECRET` | 32 or more random characters (`openssl rand -hex 32`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The first admin account, created when the backend first starts. The password needs at least 8 characters; use a strong one |
| `PORT` | Backend port, default `3000` |
| `DEFAULT_MODEL` | Optional. The model selected by default in the picker (default `claude-sonnet-5-5`) |
| `DISABLE_CRON` / `LOG_LEVEL` | Optional. Set `DISABLE_CRON=true` to turn off the daily rollup job. `LOG_LEVEL` defaults to `info` |

The Anthropic key does **not** go in `.env`. You add it to LiteLLM in step 2.5.

### 2.4 Start LiteLLM (Docker)
Make sure Docker is running, then:
```bash
docker compose --env-file .env -f litellm/docker-compose.yml up -d
```
Check that it's healthy and connected to its database:
```bash
curl -s http://localhost:4000/health/readiness
```
The response should include `"db":"connected"`. If it doesn't, check the logs:
```bash
docker compose --env-file .env -f litellm/docker-compose.yml logs litellm
```

### 2.5 Add your Anthropic key to LiteLLM
1. Open **http://localhost:4000/ui** and log in with your `LITELLM_MASTER_KEY`.
2. Go to **Models → Credentials** and add a credential:
   - Name: **`anthropic`**, lowercase and exact, because `litellm/config.yaml` refers to it by this name
   - Provider: Anthropic
   - API key: your Anthropic key
3. Restart LiteLLM so the configured models pick it up:
   ```bash
   docker compose --env-file .env -f litellm/docker-compose.yml restart
   ```

The models come from `litellm/config.yaml`: `claude-sonnet-5-5` (the default), `claude-haiku-5-5` and `claude-opus-5-5`. Models you add later in the LiteLLM UI show up in the app's picker automatically, with no code change.

### 2.6 Create the app's tables
```bash
npm run migrate
```
It is safe to run again. It also inserts the default settings: system quota $100 per month, user quota $10 per week, user reset on Saturday, system reset on day 1.

---

## 3. Run it

Open two terminals:
```bash
npm run dev:backend     # http://localhost:3000  (creates the admin on first start)
```
```bash
npm run dev:frontend    # http://localhost:4200  (proxies /api to the backend)
```
Open **http://localhost:4200** and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Each time after that, start LiteLLM (`docker compose --env-file .env -f litellm/docker-compose.yml up -d`) and then the two commands above.

### Quick demo
1. **Admin → Users:** create one or two `USER` accounts.
2. **Admin → Settings:** set small quotas so limits are easy to reach, for example a system quota of `0.50` and a user quota of `0.10`.
3. Sign in as a user and chat. The quota panel shows what's left in USD and %.
4. Set a tiny per-user override (for example `0.000001`) on one user. Their next message is blocked with **"Personal quota reached"** and the reset time in IST, while other users can still chat.
5. Lower the system quota below current usage. Every user is now blocked with **"System quota reached"**.
6. **Admin → Usage:** month-to-date spend against the system quota, a per-user weekly table, and a daily breakdown you can filter by date and user.
7. Use the theme button in the top bar to switch between Light, Dark and System.

---

## 4. Ports

| Service | URL |
|---|---|
| Frontend (Angular dev server) | http://localhost:4200 |
| Backend API | http://localhost:3000/api |
| LiteLLM proxy and admin UI | http://localhost:4000 (UI at `/ui`) |
| PostgreSQL | localhost:5432 |

---

## 5. Other commands

| Command | What it does |
|---|---|
| `npm run lint` | ESLint, plus a backend type check |
| `npm test` | Backend unit and integration tests (Jest), then frontend unit tests (Karma, ChromeHeadless). Integration tests need `DATABASE_URL_TEST` and are skipped with a warning without it |
| `npm run rollup -- --date=YYYY-MM-DD` | Builds the daily usage summary for a past day (default: yesterday, IST). Also runs automatically at 00:05 IST while the backend is up. Safe to re-run |
| `npm run build` | Production build of the backend and frontend |
| `npx playwright test -c tests/playwright.qa.config.ts` | Acceptance tests (needs the full stack running; sends a few small real Claude requests). This config uses your installed Chrome. `npx playwright test tests/acceptance` with the root config first needs `npx playwright install` |

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `Postgres.app rejected "trust" authentication` | Allow the connecting app in Postgres.app → Settings → App Permissions (your terminal, or Docker for LiteLLM), or give the DB user a password and use it in the URLs |
| LiteLLM UI says **"Not connected to DB"**, or `/health/readiness` has no `db: connected` | Check `LITELLM_DATABASE_URL` uses `host.docker.internal`, includes the password, and that the `litellm` database exists. Then run `up -d --force-recreate` |
| Chat fails with **"Missing Anthropic API Key"** (401) | The LiteLLM credential must be named exactly `anthropic`. Add it, then restart LiteLLM |
| `docker compose` says `required variable LITELLM_MASTER_KEY is missing` | You left out `--env-file .env`. Run compose from the repo root with that flag |
| `npm test` fails at startup with a DB connection error | `DATABASE_URL_TEST` is wrong or the database is unreachable. Fix it, or leave it empty to skip integration tests |
| The app looks like the mobile layout on a laptop | The layout depends on window width (desktop is 1024 px and up). Widen the window or reset browser zoom (Cmd/Ctrl + 0) |
| Frontend build warns about bundle size | The warning budget is 550 kB (error at 1 MB) in `frontend/angular.json`. It was raised from 500 kB for the theme menu and the v3 styles (about 519 kB) |

---

## 7. How it works

- **Quotas** are checked **before** every LLM call. The system quota is checked first, then the user's quota (their override if set, otherwise the default). A message that starts below both limits is allowed even if its cost goes over; the next one is blocked.
- **Periods** use Asia/Kolkata (IST). The user period runs from the chosen weekday at 00:00 IST. The system period runs from the chosen day of the month (1–28) at 00:00 IST. Timestamps are stored in UTC.
- **Cost** is always the per-request cost LiteLLM reports, stored as `DECIMAL(14,6)` with no float math. The app never prices tokens itself.
- **Usage** = the daily rollup rows for the period, plus today's ledger rows that aren't rolled up yet. That always equals the plain sum of the ledger.
- **Secrets** come only from `.env`, and the Anthropic key lives only in LiteLLM. Passwords are stored as bcrypt hashes.
- **Migrations** are TypeScript files in `backend/migrations`, compiled to `backend/dist-migrations` by `npm run migrate`. The app never uses `sequelize.sync()`.

## Project layout
```
backend/     Express API: src/ (routes → services → repositories), migrations/, test/
frontend/    Angular app: src/app/ (core, shared, features/chat, features/admin, features/login)
litellm/     docker-compose.yml + config.yaml (the only Docker part)
tests/       Playwright acceptance tests (tests/acceptance/)
docs/        PRD, tech spec, reviews, QA reports, UX design and audits, acceptance
```
