# LLM Usage Control Demo

## Problem
- Teams using LLMs have no way to cap spend: one heavy user or a busy month can blow the budget with no warning or stop.
- We need a working demo that shows firm-wide and per-user spend control on top of a chat assistant, and that stays the same when more models/providers are added.

## Users
- **User** — chats with an LLM; needs to know how much quota is left and why they are blocked.
- **Admin** (role `ADMIN`) — sets quotas and reset schedule, sees all usage, manages users and roles. Admins also chat like users.

## Goals / success metrics
- Demo shows a user blocked by their own weekly quota while others continue.
- Demo shows every user blocked once the system quota is spent, including users with personal quota left.
- Cost recorded per request matches the cost LiteLLM reports for that request, to $0.000001.
- Adding a new model needs only a LiteLLM config change — no app code change.

## Scope
### In
- Angular frontend + Node/Express backend, run locally from this folder (npm), not in Docker.
- LiteLLM proxy as the only LLM gateway, run in Docker (the only Docker component), with its own Postgres database (separate from the app's DB, on the same user-provided server); app → LiteLLM → Claude. App uses LiteLLM only for routing and the per-request cost; quotas, ledger and reporting are in the app.
- PostgreSQL provided by the user; connection details in `.env`.
- Email/password login; roles `USER` and `ADMIN`.
- System-wide monthly quota (hard stop) and per-user weekly quota (default + per-user override).
- Reset day-of-week (user quota) and day-of-month (system quota) stored in DB and editable by admin; resets at 00:00 IST.
- Per-request usage ledger in Postgres; daily per-user per-model rollup.
- Chat screen: model picker, streaming answers, saved conversations, remaining-quota display.
- Admin screen: quota settings, reset schedule, usage views, user/role management.
- One admin seeded from `.env` on first start.

### Out
- Langfuse or any other observability/tracing tool.
- SSO / Azure AD.
- Email/Slack alerts or notifications; no in-app warning banner when nearing a quota.
- Using LiteLLM's virtual keys, budgets or spend logs for app features — LiteLLM has its own DB (operator convenience only); the app uses LiteLLM only for routing and per-request cost and never reads LiteLLM's DB.
- Request-rate limits (requests/min, tokens/min).
- File/image uploads in chat.
- Managing the model list from the UI (edited in LiteLLM config).
- Payments, invoicing, multi-tenant.
- Production deployment / Dockerizing the app or Postgres.

## User flows
1. Admin logs in with the seeded account → sets system quota, default user quota, reset day-of-week, reset day-of-month → creates users.
2. User logs in → picks a model → sends a message → sees the answer stream in → sees remaining weekly and system quota update.
3. User reopens a past conversation from the sidebar and continues it.
4. User exhausts weekly quota → next message is blocked with reason "personal quota" and next reset time.
5. Total usage reaches system quota → every user's next message is blocked with reason "system quota" and next reset time.
6. Admin views system month-to-date vs quota, each user's week-to-date vs quota, and a per-user per-day breakdown with date filter.
7. Admin edits a user: change role, set/clear quota override, deactivate, reset password.

## Acceptance criteria
### Setup & auth
- AC-1: Given `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` and no such user in DB, when the backend starts, then a user with role `ADMIN` is created; on a second start no duplicate is created.
- AC-2: Given valid credentials, when a user logs in, then they receive a session token and land on the chat screen; given invalid credentials, then login fails with an error and no token.
- AC-3: Given a deactivated user, when they log in or call any API with an existing token, then the request is rejected (401/403).
- AC-4: Given a user with role `USER`, when they open the admin screen or call any admin API, then they get 403; given role `ADMIN`, then access is allowed.
- AC-5: Passwords are stored only as salted hashes (bcrypt or argon2); no plaintext password appears in DB or logs.

### Chat
- AC-6: Given LiteLLM is configured with N models, when a user opens the chat, then the model picker lists exactly those N models (fetched from LiteLLM).
- AC-7: Given a user with quota available, when they send a message, then the answer is streamed (first tokens shown before the full answer completes) and is sent via LiteLLM, not directly to the provider.
- AC-8: Given a completed message, when the user reloads the page, then the conversation and all its messages (with the model used) appear in the sidebar/history.
- AC-9: Given an existing conversation, when the user sends a new message in it, then previous messages are sent as context and the new pair is appended to the same conversation.
- AC-10: A user can see and open only their own conversations; requesting another user's conversation returns 403/404.

### Usage tracking
- AC-11: Given a completed LLM response, when it is stored, then a ledger row exists with user id, conversation id, model, input tokens, output tokens, cost (USD, from LiteLLM), and timestamp.
- AC-12: Given a ledger row, then its cost equals the cost LiteLLM reports for that request to 6 decimal places.
- AC-13: Given ledger rows for a past IST day, when the daily rollup job runs (scheduled 00:05 IST, also runnable manually), then one rollup row per user per model per day exists with summed tokens, cost and request count; re-running it for the same day does not double-count.
- AC-14: Current-period usage (used for quota checks and display) = sum of rollup rows in the period + ledger rows for today (IST) not yet rolled up; result equals the plain sum of all ledger rows in the period.

### Quotas & resets
- AC-15: Given a user whose week-to-date usage ≥ their effective quota (override if set, else default), when they send a message, then it is rejected before any LLM call with reason `USER_QUOTA_EXCEEDED` and the next reset time (IST); no ledger row is written.
- AC-16: Given system month-to-date usage (all users, including admins) ≥ system quota, when any user sends a message, then it is rejected before any LLM call with reason `SYSTEM_QUOTA_EXCEEDED` and the next reset time (IST), even if that user has personal quota left.
- AC-17: Given usage below both quotas, when a message is sent, then it is allowed even if its cost takes usage over the quota (simple rule); the next message is then blocked.
- AC-18: Given the user reset day-of-week is set to D (default Saturday), then the user period is from D 00:00 IST to the next D 00:00 IST; usage before the period start does not count.
- AC-19: Given the system reset day-of-month is set to M (allowed 1–28, default 1), then the system period is from day M 00:00 IST to day M of the next month 00:00 IST.
- AC-20: Given an admin changes any quota or reset setting, when the next message is sent, then the new value is applied (no restart).
- AC-21: Given a user with an override, when admin clears the override, then the default user quota applies to that user.

### Quota display
- AC-22: The chat screen shows the user's remaining weekly quota (USD and %) and the system's remaining monthly quota (USD and %), refreshed after each message.
- AC-23: When a message is blocked, the chat screen shows which limit was hit (personal or system) and the reset date/time in IST.

### Admin
- AC-24a: Given a fresh database, when migrations/seed run, then settings default to system quota $100, default user quota $10, user reset day Saturday, system reset day-of-month 1.
- AC-24: Admin can set the system quota (USD), default user quota (USD), user reset day-of-week (Mon–Sun) and system reset day-of-month (1–28); invalid values (negative, out of range) are rejected with a validation error.
- AC-25: Admin usage view shows system month-to-date cost vs system quota, and a per-user table with week-to-date cost vs effective quota, sortable by usage.
- AC-26: Admin usage view shows a per-user per-day breakdown (tokens in/out, cost, requests, model) filterable by date range and user; totals match the ledger for that range.
- AC-27: Admin can create a user (name, email, password, role), edit name/role, set/clear quota override, reset password, and deactivate/reactivate; email is unique (duplicate rejected).
- AC-28: An admin cannot deactivate themselves or remove their own `ADMIN` role (prevents lock-out).

### Multi-model
- AC-29: Given a new model is added to the LiteLLM config and LiteLLM is restarted, when a user opens the chat, then the model appears in the picker and its usage is tracked and counted against quotas with no app code change.

## Non-functional requirements
- Only LiteLLM runs in Docker (`docker compose up` for LiteLLM); backend and frontend run with npm from this folder.
- All secrets/config via `.env` (Postgres connections for the app and LiteLLM, LiteLLM URL/master/salt keys, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, JWT secret); `.env.example` committed, `.env` not. The Anthropic provider key is not in `.env`; it is stored as a credential in LiteLLM (entered via its admin UI).
- All period boundaries and displayed times use Asia/Kolkata (IST); timestamps stored in UTC.
- Quota check adds ≤ 100 ms (p95) before the LLM call with 20 users and 30 days of ledger data.
- First streamed token shown within 1 s of LiteLLM sending it.
- Cost stored as numeric with ≥ 6 decimal places (no floating-point money).
- DB schema created/updated via migrations.

## Open questions
- None.
