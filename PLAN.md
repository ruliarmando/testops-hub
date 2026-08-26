# Project idea: TestOps Hub

A web platform for managing and analyzing automated E2E tests.

Think of it as a lightweight combination of Playwright Dashboard + CI test analytics + test management.

# Goal & constraints

- **Primary goal**: portfolio piece for full-stack roles, with a QA/SDET-adjacent angle (leans on existing QA automation background as part of the pitch).
- **Solo project.** No hard deadline — soft compass of ~1 month for Phase 1-2, ~3-4 months total, but not stressed over if it slips (see Phase 1 tension note below).
- **Skill baseline**: strong in React/TanStack already. FastAPI, Alembic, and Celery/ARQ are new. Deliberately using the *real* tools from day one rather than shortcuts, since learning them is part of the portfolio value.

# What it does

Your FastAPI backend provides APIs for:

- 📋 Test suite management
- 🧪 Test case management (auto-discovered from ingested results — see below)
- ▶️ Triggering test runs
- 📊 Storing test results
- 📈 Test success/failure analytics
- 🐌 Detecting slow/flaky tests
- 🔄 Tracking test history
- 🔗 Connecting tests to Git commits / PRs (Phase 5, stretch)
- 🔔 Slack notifications when test suites regress
- 👤 Single-owner projects (no teams/RBAC for now — see Phase 5)

For example:

```text
Project: FlightSG
│
├── E2E Tests
│   ├── Login
│   ├── Search Flight
│   ├── Booking
│   └── Payment
│
├── Test Runs
│   ├── #142  ✅ 98%
│   ├── #141  ❌ 91%
│   └── #140  ✅ 99%
│
└── Analytics
    ├── Pass rate: 97.4%
    ├── Flaky tests: 12
    ├── Avg duration: 4m 32s
    └── Failed tests: 7
```

# Stack decisions

## Backend

- FastAPI
- Plain SQLAlchemy 2.0 + separate Pydantic schemas (not SQLModel) — more explicit DB-model/API-schema separation, closer to how larger real-world FastAPI codebases are structured
- PostgreSQL
- Alembic for migrations, from the start
- Auth via an established library (e.g. `fastapi-users`) — bare register/login/JWT only, no email verification or password-reset flows (avoids needing email infra at all)
- Background tasks: **ARQ** (not Celery) — asyncio-native, pairs naturally with async FastAPI, lighter to operate on a small budget
- Redis (ARQ broker)
- WebSockets — see Phase 5 (redefined)
- Async programming throughout
- OpenAPI documentation

## Frontend

- React
- TanStack Router
- TanStack Query
- TanStack Table
- TanStack Virtual
- Tailwind CSS

# The interesting part

Don't make the API just return manually entered test results.

A minimal Playwright reporter sends real results to the FastAPI backend — pulled into **Phase 1**, not deferred, so every phase after that is validated against real data instead of fixtures.

```text
Playwright
    │
    │ test results (batch POST at end of run)
    ▼
Playwright Reporter
    │
    │ POST /api/test-runs
    ▼
FastAPI
    │
    ├── PostgreSQL
    ├── Redis
    └── ARQ workers
          │
          ├── calculate statistics
          ├── detect flaky tests
          └── send Slack notifications
```

**Ingestion design**: a single batch POST per run (matches Playwright's own `onEnd` reporter hook), not per-test streaming. Simpler to build and test; live-streaming would be a genuinely separate concern if ever revisited.

**Test case/suite identity**: auto-discovered from incoming results (matched by file + test title). Manual CRUD still exists for organizing/renaming, but is not a prerequisite for ingestion — a reporter can point at the API and just work.

Your GitHub Actions CI (not GitLab — more representative of what a hiring team recognizes) could run the E2E suite and publish results:

```
test:
  script:
    - npm run test:e2e
    - npm run upload-results
```

Your FastAPI service receives the results and updates the dashboard.

# ⭐ A particularly good feature: Flaky Test Detection

This would make the project stand out.

For every test, track something like:

```
checkout.spec.ts
  should complete checkout

Last 30 runs:
✅ ✅ ❌ ✅ ✅ ❌ ✅ ❌ ✅ ✅
```

```
Calculate:

Pass rate:       76.7%
Failure count:   7
Flaky score:     0.42
Avg duration:    8.3s

Then automatically classify:

Stable
Flaky
Frequently failing
Slow
```

**Start with a simple, explainable formula** (e.g. `flaky_score = min(pass_rate, fail_rate) * 2`, peaking at 1.0 for a 50/50 split) and iterate later. A metric you can confidently explain in an interview beats a sophisticated one you can't justify. Exact classification thresholds are a Phase 3 implementation detail, not decided yet.

You could even show a flaky-test leaderboard.

# Notifications

Slack webhook (not email — avoids needing an email service/domain for a portfolio feature). Triggered only on **new/regression failures** — tests that were passing and just started failing — not on every failure and not on a raw pass-rate threshold. Avoids alert fatigue from already-known-flaky tests and doubles as a use of the flaky/history tracking you're already building.

# Suggested architecture
```text
                   ┌─────────────────┐
                   │   React App     │
                   │ TanStack Query  │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │    FastAPI      │
                   │                 │
                   │ REST API        │
                   │ WebSocket       │
                   │ Auth            │
                   └───────┬─────────┘
                           │
             ┌─────────────┼──────────────┐
             ▼             ▼              ▼
        PostgreSQL       Redis        ARQ Workers
                                      │
                                      ▼
                              Analytics / Jobs

             ▲
             │
       Playwright Reporter
             ▲
             │
        GitHub Actions CI
```

# MVP

Built in stages:

## Phase 1 — backend-only

No frontend yet; verify via Swagger/OpenAPI docs, curl, or the reporter's own output. Keeps the FastAPI-learning curve and the ingestion endpoint as the sole focus.

- Auth (register/login/JWT, established library, no email flows)
- Projects (single-owner)
- Test cases/suites (auto-discovered from ingestion)
- Test runs, Test results
- REST API, PostgreSQL, Alembic
- ARQ + Redis wired up (even if jobs are trivial at first)
- **Minimal Playwright reporter + batch-POST ingestion endpoint** (pulled forward from the original Phase 3)

> Soft target: ~1 month for Phase 1-2 combined, but treated as a loose compass, not a commitment — re-check progress after 2-3 weeks and adjust rather than stress over slippage. Full "real tools from day one" scope (Alembic + ARQ + Docker while FastAPI itself is new) is the deliberate tradeoff here over trimming scope to hit the date.

## Phase 2 — React dashboard

- Test-run history
- Charts
- Filtering/search
- TanStack Table

## Phase 3 — Analytics

- Flaky test detection (simple formula first)
- Performance analytics (avg duration, slow-test classification)

## Phase 4 — Notifications

- Slack webhook integration
- Regression-only trigger logic (see above)

## Phase 5 — Stretch goals

- WebSockets, **redefined**: push live dashboard updates when a run completes (no refresh needed), not literal per-test progress — batch-only ingestion doesn't support true per-test streaming without a rework
- Teams/permissions (RBAC) — only tackled if this phase is actually reached; light single-owner model stands until then
- Git commit/PR integration
- (Docker deployment already done in Phase 1, not deferred here — see below)

# Deployment

- **Dockerized from the start** (not deferred to Phase 5) — Dockerfiles for backend/worker, deployed via Docker on the chosen host
- **GitHub Actions** for CI (not GitLab)
- **Live deployed demo**, budget ~$5-8/mo (free tiers don't reliably cover persistent Postgres + Redis + worker anymore)
- Public access via a **one-click, write-protected demo account** — a real account behind the normal auth system, so the auth flow is genuinely exercised, but mutating endpoints reject it. No reset job to maintain, no risk of a visitor leaving the demo defaced for the next one.
- Demo data comes from a **static/periodic seed script** — not wired to a live CI dogfooding pipeline (kept simple; a real E2E suite continuously feeding the public demo was considered and deliberately deferred)

# Why this is a strong portfolio project

It connects frontend + QA automation + CI/CD experience into one project instead of looking like another generic FastAPI CRUD application — and the real Playwright-reporter-to-dashboard pipeline (not manually entered data) is what proves it's not just mocked.
