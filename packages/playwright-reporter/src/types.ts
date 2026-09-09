export interface TestOpsReporterOptions {
  /** Base URL of the TestOps Hub API, e.g. "http://localhost:8000". Falls back to TESTOPS_BASE_URL. */
  baseUrl?: string;
  /** Project ID the run belongs to. Falls back to TESTOPS_PROJECT_ID. */
  projectId?: string;
  /** Project-scoped API token. Falls back to TESTOPS_API_TOKEN. */
  apiToken?: string;
}

export type ResultStatus = "passed" | "failed" | "skipped";

export interface ResultPayload {
  file_path: string;
  test_title: string;
  status: ResultStatus;
  duration_ms: number;
  error_message: string | null;
}
