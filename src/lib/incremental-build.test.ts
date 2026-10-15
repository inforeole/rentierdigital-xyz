import { describe, expect, test } from "bun:test";
import { buildArticleCacheKey } from "./incremental-build";

const article = {
  _creationTime: 1_725_000_000_000,
  updated_at: "2026-08-23T10:00:00.000Z",
  tags: ["astro", "build"],
  word_count: 900,
};

const related = [
  {
    slug: "first-related",
    title: "First related article",
    hook_first_lines: "The first hook.",
    tags: ["astro"],
  },
  {
    slug: "second-related",
    title: "Second related article",
    hook_first_lines: null,
    read_time_minutes: 4,
  },
];

describe("buildArticleCacheKey", () => {
  test("returns a deterministic key for the same rendered inputs", () => {
    expect(buildArticleCacheKey(article, related)).toBe(
      '{"revision":"2026-08-23T10:00:00.000Z","related":[{"slug":"first-related","title":"First related article","hook_first_lines":"The first hook."},{"slug":"second-related","title":"Second related article","hook_first_lines":null}]}'
    );
  });

  test("changes when the article revision changes", () => {
    expect(
      buildArticleCacheKey({ ...article, updated_at: "2026-08-24T10:00:00.000Z" }, related)
    ).not.toBe(
      '{"revision":"2026-08-23T10:00:00.000Z","related":[{"slug":"first-related","title":"First related article","hook_first_lines":"The first hook."},{"slug":"second-related","title":"Second related article","hook_first_lines":null}]}'
    );
  });

  test("uses creation time when a legacy article has no update timestamp", () => {
    expect(
      buildArticleCacheKey({ ...article, updated_at: null, _creationTime: 1_700_000_000_000 }, [])
    ).toBe('{"revision":1700000000000,"related":[]}');
  });

  test("changes when a rendered related-card field changes", () => {
    expect(
      buildArticleCacheKey(article, [{ ...related[0], title: "Renamed related article" }, related[1]])
    ).not.toBe(
      '{"revision":"2026-08-23T10:00:00.000Z","related":[{"slug":"first-related","title":"First related article","hook_first_lines":"The first hook."},{"slug":"second-related","title":"Second related article","hook_first_lines":null}]}'
    );
  });

  test("ignores related fields that do not render in a card", () => {
    expect(
      buildArticleCacheKey(
        { ...article, tags: ["unrelated"], word_count: 12 },
        [{ ...related[0], tags: ["different"], read_time_minutes: 99 }, related[1]]
      )
    ).toBe(
      '{"revision":"2026-08-23T10:00:00.000Z","related":[{"slug":"first-related","title":"First related article","hook_first_lines":"The first hook."},{"slug":"second-related","title":"Second related article","hook_first_lines":null}]}'
    );
  });
});
