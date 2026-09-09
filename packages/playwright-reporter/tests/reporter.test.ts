import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TestOpsReporter } from "../src/index";

const ROOT_DIR = path.join("d:", "sample-project");

function makeSuite(type: "describe", title: string, parent: any): any {
  return { type, title, parent };
}

function makeTest(options: {
  title: string;
  file: string;
  parent: any;
}): any {
  return {
    title: options.title,
    location: { file: path.join(ROOT_DIR, options.file), line: 1, column: 1 },
    parent: options.parent,
  };
}

function makeFileTest(title: string, file: string): any {
  const fileSuite = { type: "file", title: file, parent: undefined };
  return makeTest({ title, file, parent: fileSuite });
}

function makeResult(options: {
  status: string;
  duration: number;
  errors?: Array<{ message?: string; value?: string }>;
}): any {
  return {
    status: options.status,
    duration: options.duration,
    errors: options.errors ?? [],
  };
}

function makeReporter(overrides: Partial<Record<string, string>> = {}) {
  const reporter = new TestOpsReporter({
    baseUrl: "http://localhost:8000",
    projectId: "project-1",
    apiToken: "tth_test-token",
    ...overrides,
  });
  reporter.onBegin({ rootDir: ROOT_DIR } as any, {} as any);
  return reporter;
}

describe("TestOpsReporter configuration", () => {
  const envKeys = ["TESTOPS_BASE_URL", "TESTOPS_PROJECT_ID", "TESTOPS_API_TOKEN"] as const;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it("throws when baseUrl, projectId, or apiToken are missing", () => {
    expect(() => new TestOpsReporter({ projectId: "p", apiToken: "t" })).toThrow(/missing configuration/);
    expect(() => new TestOpsReporter({ baseUrl: "http://x", apiToken: "t" })).toThrow(/missing configuration/);
    expect(() => new TestOpsReporter({ baseUrl: "http://x", projectId: "p" })).toThrow(/missing configuration/);
  });

  it("falls back to environment variables", () => {
    process.env.TESTOPS_BASE_URL = "http://localhost:8000";
    process.env.TESTOPS_PROJECT_ID = "project-1";
    process.env.TESTOPS_API_TOKEN = "tth_env-token";

    expect(() => new TestOpsReporter()).not.toThrow();
  });
});

describe("TestOpsReporter result collection and reporting", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, statusText: "Created" });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a batch of results to the run ingestion endpoint", async () => {
    const reporter = makeReporter();
    const test = makeFileTest("logs in", "tests/login.spec.ts");

    reporter.onTestEnd(test, makeResult({ status: "passed", duration: 123.6 }));
    await reporter.onEnd({ status: "passed" } as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/projects/project-1/runs");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer tth_test-token",
    });
    expect(JSON.parse(init.body)).toEqual({
      results: [
        {
          file_path: "tests/login.spec.ts",
          test_title: "logs in",
          status: "passed",
          duration_ms: 124,
          error_message: null,
        },
      ],
      run_metadata: null,
    });
  });

  it("includes run_metadata when provided", async () => {
    const reporter = new TestOpsReporter({
      baseUrl: "http://localhost:8000",
      projectId: "project-1",
      apiToken: "tth_test-token",
      runMetadata: { ci: "github-actions", commit: "abc123" },
    });
    reporter.onBegin({ rootDir: ROOT_DIR } as any, {} as any);
    const test = makeFileTest("t", "tests/a.spec.ts");

    reporter.onTestEnd(test, makeResult({ status: "passed", duration: 1 }));
    await reporter.onEnd({ status: "passed" } as any);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.run_metadata).toEqual({ ci: "github-actions", commit: "abc123" });
  });

  it("joins nested describe titles into the test title", async () => {
    const reporter = makeReporter();
    const fileSuite = { type: "file", title: "checkout.spec.ts", parent: undefined };
    const describeSuite = makeSuite("describe", "checkout flow", fileSuite);
    const test = makeTest({
      title: "completes checkout",
      file: "tests/checkout.spec.ts",
      parent: describeSuite,
    });

    reporter.onTestEnd(test, makeResult({ status: "passed", duration: 10 }));
    await reporter.onEnd({ status: "passed" } as any);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.results[0].test_title).toBe("checkout flow > completes checkout");
  });

  it.each([
    ["passed", "passed"],
    ["failed", "failed"],
    ["timedOut", "failed"],
    ["interrupted", "failed"],
    ["skipped", "skipped"],
  ])("maps Playwright status %s to %s", async (playwrightStatus, expected) => {
    const reporter = makeReporter();
    const test = makeFileTest("t", "tests/a.spec.ts");

    reporter.onTestEnd(test, makeResult({ status: playwrightStatus, duration: 1 }));
    await reporter.onEnd({ status: "passed" } as any);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.results[0].status).toBe(expected);
  });

  it("captures the error message when a test fails", async () => {
    const reporter = makeReporter();
    const test = makeFileTest("fails", "tests/a.spec.ts");

    reporter.onTestEnd(
      test,
      makeResult({
        status: "failed",
        duration: 5,
        errors: [{ message: "expect(received).toBe(expected)" }],
      }),
    );
    await reporter.onEnd({ status: "failed" } as any);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.results[0].error_message).toBe("expect(received).toBe(expected)");
  });

  it("strips ANSI color codes from error messages", async () => {
    const reporter = makeReporter();
    const test = makeFileTest("fails", "tests/a.spec.ts");

    reporter.onTestEnd(
      test,
      makeResult({
        status: "failed",
        duration: 5,
        errors: [{ message: "Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe" }],
      }),
    );
    await reporter.onEnd({ status: "failed" } as any);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.results[0].error_message).toBe("Error: expect(received).toBe");
  });

  it("does not call fetch when there are no results", async () => {
    const reporter = makeReporter();
    await reporter.onEnd({ status: "passed" } as any);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws clearly when the API rejects the token", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: () => Promise.resolve('{"detail":"INVALID_PROJECT_TOKEN"}'),
    });

    const reporter = makeReporter();
    const test = makeFileTest("t", "tests/a.spec.ts");
    reporter.onTestEnd(test, makeResult({ status: "passed", duration: 1 }));

    await expect(reporter.onEnd({ status: "passed" } as any)).rejects.toThrow(
      /401 Unauthorized.*INVALID_PROJECT_TOKEN/s,
    );
  });

  it("throws clearly when the network request fails outright", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const reporter = makeReporter();
    const test = makeFileTest("t", "tests/a.spec.ts");
    reporter.onTestEnd(test, makeResult({ status: "passed", duration: 1 }));

    await expect(reporter.onEnd({ status: "passed" } as any)).rejects.toThrow(/failed to reach.*ECONNREFUSED/s);
  });
});
