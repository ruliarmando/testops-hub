import path from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

import type { ResultPayload, ResultStatus, TestOpsReporterOptions } from "./types";

// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_PATTERN = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

const STATUS_MAP: Record<TestResult["status"], ResultStatus> = {
  passed: "passed",
  failed: "failed",
  timedOut: "failed",
  interrupted: "failed",
  skipped: "skipped",
};

export class TestOpsReporter implements Reporter {
  private readonly baseUrl: string;
  private readonly projectId: string;
  private readonly apiToken: string;
  private readonly runMetadata?: Record<string, unknown>;
  private rootDir = "";
  private readonly results: ResultPayload[] = [];

  constructor(options: TestOpsReporterOptions = {}) {
    const baseUrl = options.baseUrl ?? process.env.TESTOPS_BASE_URL;
    const projectId = options.projectId ?? process.env.TESTOPS_PROJECT_ID;
    const apiToken = options.apiToken ?? process.env.TESTOPS_API_TOKEN;

    if (!baseUrl || !projectId || !apiToken) {
      throw new Error(
        "testops-hub-playwright-reporter: missing configuration. Provide baseUrl, projectId, " +
          "and apiToken as reporter options, or TESTOPS_BASE_URL, TESTOPS_PROJECT_ID, and " +
          "TESTOPS_API_TOKEN environment variables.",
      );
    }

    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.projectId = projectId;
    this.apiToken = apiToken;
    this.runMetadata = options.runMetadata;
  }

  onBegin(config: FullConfig, _suite: Suite): void {
    this.rootDir = config.rootDir;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.results.push({
      file_path: this.relativeFilePath(test),
      test_title: this.fullTitle(test),
      status: STATUS_MAP[result.status] ?? "failed",
      duration_ms: Math.round(result.duration),
      error_message: this.errorMessage(result),
    });
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (this.results.length === 0) {
      return;
    }

    const url = `${this.baseUrl}/projects/${this.projectId}/runs`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({ results: this.results, run_metadata: this.runMetadata ?? null }),
      });
    } catch (cause) {
      throw new Error(
        `testops-hub-playwright-reporter: failed to reach ${url}: ${(cause as Error).message}`,
        { cause },
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `testops-hub-playwright-reporter: failed to report results ` +
          `(${response.status} ${response.statusText})${body ? `: ${body}` : ""}`,
      );
    }
  }

  printsToStdio(): boolean {
    return false;
  }

  private relativeFilePath(test: TestCase): string {
    const relative = path.relative(this.rootDir, test.location.file);
    return relative.split(path.sep).join("/");
  }

  private fullTitle(test: TestCase): string {
    const titles: string[] = [];
    let suite: Suite | undefined = test.parent;
    while (suite && suite.type === "describe") {
      titles.unshift(suite.title);
      suite = suite.parent;
    }
    titles.push(test.title);
    return titles.join(" > ");
  }

  private errorMessage(result: TestResult): string | null {
    if (result.errors.length === 0) {
      return null;
    }
    const message = result.errors
      .map((error) => error.message ?? error.value ?? "")
      .filter(Boolean)
      .join("\n")
      .replace(ANSI_ESCAPE_PATTERN, "")
      .trim();
    return message.length > 0 ? message : null;
  }
}

export default TestOpsReporter;
export type { TestOpsReporterOptions } from "./types";
