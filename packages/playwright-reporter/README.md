# testops-hub-playwright-reporter

A minimal [Playwright reporter](https://playwright.dev/docs/api/class-reporter) that posts a
run's results to a TestOps Hub project as a single batch `POST` from the `onEnd` hook, matching
the ingestion contract from issue #5 (`POST /projects/{project_id}/runs`).

## Usage

Add it to `playwright.config.ts` alongside any other reporter you want (e.g. `list`):

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    [
      "testops-hub-playwright-reporter",
      {
        baseUrl: "http://localhost:8000",
        projectId: "<your-project-id>",
        apiToken: "<your-project-api-token>",
        // optional: attached to the run as-is, per the ingestion contract's run_metadata field
        runMetadata: { ci: "github-actions", commit: process.env.GITHUB_SHA },
      },
    ],
  ],
});
```

Configuration can also come from environment variables instead of reporter options — handy for
CI, where the token shouldn't be committed to `playwright.config.ts`:

```ts
reporter: [["testops-hub-playwright-reporter"]],
```

```bash
TESTOPS_BASE_URL=http://localhost:8000 \
TESTOPS_PROJECT_ID=<your-project-id> \
TESTOPS_API_TOKEN=<your-project-api-token> \
npx playwright test
```

Reporter options take precedence over the environment variables when both are set. If neither
supplies `baseUrl`, `projectId`, or `apiToken`, the reporter throws immediately (before any tests
run) rather than silently skipping the upload.

Generate a project's API token from TestOps Hub with:

```
POST /projects/{project_id}/token
```

(see issue #5 / `app/api/routes/projects.py`).

## What gets reported

For every test, `onTestEnd` records:

- `file_path` — the test file, relative to Playwright's `rootDir`
- `test_title` — the test's title, prefixed with any enclosing `describe` titles (`"describe > test"`)
- `status` — `passed` / `failed` / `skipped` (`timedOut` and `interrupted` map to `failed`)
- `duration_ms`
- `error_message` — all of the test's error messages, ANSI color codes stripped and joined with
  newlines, or `null` if it had none

`onEnd` batches all of the above into one `POST` to `{baseUrl}/projects/{projectId}/runs`. If the
request fails — invalid/missing token, unreachable server, non-2xx response — the reporter throws,
which fails the Playwright run with a clear error message instead of dropping results silently. A
suite with zero tests results in no request being sent.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build        # emits dist/ for consumption as a built package
```

### Manual end-to-end check

`example/` is a tiny Playwright suite (one pass, one intentional fail, one skip) wired to this
reporter via a relative path, for exercising it against a real backend:

```bash
# from repo root — start Postgres, Redis, the API, and the worker
docker compose up -d --build

# register a user, create a project, and mint a project token (see docs, or Swagger at /docs),
# then from packages/playwright-reporter/example:
TESTOPS_BASE_URL=http://localhost:8000 \
TESTOPS_PROJECT_ID=<project-id> \
TESTOPS_API_TOKEN=<project-token> \
npx playwright test
```

A new run should show up under `GET /projects/{project_id}/runs` with a 33% pass rate and all
three results faithfully reported. Omitting or corrupting `TESTOPS_API_TOKEN` should make the
reporter fail loudly instead of quietly dropping the run.
