import { describe, expect, it } from "vitest";

import {
  escapeLike,
  normalizeForSearch,
} from "../../src/utils/string.utils.js";

describe("normalizeForSearch", () => {
  it("should remove accents, lowercase and collapse spaces", () => {
    expect(normalizeForSearch("  João   da CONCEIÇÃO ")).toBe(
      "joao da conceicao",
    );
  });
});

describe("escapeLike", () => {
  it("should escape the LIKE wildcards and the escape character", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });

  it("should keep regex characters as they are", () => {
    expect(escapeLike(".*")).toBe(".*");
  });
});
