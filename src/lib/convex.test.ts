import { describe, expect, test } from "bun:test";
import { getBlogBySlugPath } from "./convex";

describe("getBlogBySlugPath", () => {
  test("versions an encoded detail path with its article revision", () => {
    expect(
      getBlogBySlugPath("a/b c", undefined, "2026-08-23T10:00:00.000Z")
    ).toBe("/api/blog/a%2Fb%20c?revision=2026-08-23T10%3A00%3A00.000Z");
  });

  test("keeps an optional language before the revision query", () => {
    expect(getBlogBySlugPath("bonjour", "FR", 1_725_000_000_000)).toBe(
      "/api/blog/bonjour?lang=FR&revision=1725000000000"
    );
  });
});
