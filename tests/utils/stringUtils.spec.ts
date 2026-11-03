import { describe, expect, it } from "vitest";

import {
  escapeRegex,
  normalizeForSearch,
} from "../../src/utils/string.utils.js";

describe("normalizeForSearch", () => {
  it("should remove accents, lowercase and collapse spaces", () => {
    expect(normalizeForSearch("  João   da CONCEIÇÃO ")).toBe(
      "joao da conceicao",
    );
  });
});

describe("escapeRegex", () => {
  it("should escape regex special characters", () => {
    const pattern = new RegExp(escapeRegex("a.b*(c)"));

    expect(pattern.test("a.b*(c)")).toBe(true);
    expect(pattern.test("axbbc")).toBe(false);
  });
});
