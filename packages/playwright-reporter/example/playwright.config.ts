import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  reporter: [
    ["list"],
    [
      "../src/index.ts",
      {
        baseUrl: process.env.TESTOPS_BASE_URL ?? "http://localhost:8000",
        projectId: process.env.TESTOPS_PROJECT_ID,
        apiToken: process.env.TESTOPS_API_TOKEN,
      },
    ],
  ],
});
