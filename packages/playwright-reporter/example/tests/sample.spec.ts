import { expect, test } from "@playwright/test";

test.describe("sample checks", () => {
  test("adds numbers correctly", () => {
    expect(1 + 1).toBe(2);
  });

  test("fails on purpose", () => {
    expect(1 + 1).toBe(3);
  });

  test.skip("not yet implemented", () => {
    expect(true).toBe(true);
  });
});
