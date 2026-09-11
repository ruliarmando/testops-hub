# TestOps Hub

A platform for ingesting, browsing, and analyzing automated E2E test results — think a lightweight
combination of a Playwright dashboard, CI test analytics, and basic test-case management.

A real [Playwright reporter](packages/playwright-reporter) posts actual test results to the API in
a single batch `POST`, so the backend is validated against real data instead of fixtures. See
[PLAN.md](./PLAN.md) for the full project scope and phased roadmap, and [CONTEXT.md](./CONTEXT.md)
for domain terminology.

## Stack

- **Backend**: FastAPI, async SQLAlchemy 2.0, PostgreSQL, Alembic migrations
- **Auth**: [fastapi-users](https://fastapi-users.github.io/fastapi-users/) (register/login/JWT, dual-audience access + refresh tokens)
- **Background jobs**: ARQ + Redis
- **Reporter**: a TypeScript Playwright reporter package (`packages/playwright-reporter`)

## Project layout

```
app/                    FastAPI backend
├── api/routes/         Route modules (auth, projects, runs, suites, cases, users, health)
├── auth/               fastapi-users configuration
├── core/                Settings (pydantic-settings, .env-driven)
├── db/                  Async engine/session setup
├── models/              SQLAlchemy models
├── schemas/             Pydantic request/response schemas
├── services/            Business logic (e.g. catalog auto-discovery)
└── worker/              ARQ worker settings, queue, tasks
alembic/                 DB migrations
tests/                   pytest test suite
packages/playwright-reporter/   Standalone npm package (see its own README)
docs/adr/                Architecture decision records
docs/agents/             Docs for AI coding agents working in this repo
```

## Getting started

### Run everything with Docker

```bash
docker compose up -d --build
```

This starts Postgres (host port `5434`), Redis, the API (runs Alembic migrations on boot, then
serves on port `8000`), and the ARQ worker. Swagger docs are at http://localhost:8000/docs.

### Run the backend locally

```bash
cp .env.example .env   # adjust DATABASE_URL / REDIS_URL if not using Docker for those

pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

### Run tests

```bash
pytest
```

CI (`.github/workflows/ci.yml`) runs the same suite against Postgres and Redis service containers
on every push and pull request.

## API

All resources are scoped under a single-owner `Project`. Once authenticated, the main routes are:

| Prefix                          | Purpose                                   |
| -------------------------------- | ------------------------------------------ |
| `/auth`                          | Register/login/JWT (fastapi-users)         |
| `/users`                         | Current-user endpoints                     |
| `/projects`                      | Project CRUD + project API token issuance  |
| `/projects/{project_id}/runs`    | Ingest and browse test runs/results        |
| `/projects/{project_id}/suites`  | Test suites (auto-discovered from runs)    |
| `/projects/{project_id}/cases`   | Test cases (auto-discovered, manual rename/annotate) |

Full request/response schemas are available via the OpenAPI docs at `/docs` once the API is
running.

## Playwright reporter

[`packages/playwright-reporter`](packages/playwright-reporter) is a minimal Playwright reporter
that posts a run's results to a TestOps Hub project from the `onEnd` hook. See its own README for
usage and configuration.

## Working with agents

This repo is set up for AI coding agents (see [CLAUDE.md](./CLAUDE.md)):

- Issues/specs are tracked as GitHub issues in `ruliarmando/testops-hub` (see [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md))
- Triage uses five canonical labels (see [docs/agents/triage-labels.md](docs/agents/triage-labels.md))
- Domain vocabulary lives in [CONTEXT.md](./CONTEXT.md) and decisions in [docs/adr/](docs/adr/)
