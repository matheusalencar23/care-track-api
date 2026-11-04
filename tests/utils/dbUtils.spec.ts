import pg from "pg";
import { describe, expect, it } from "vitest";

import { isDuplicateKeyError } from "../../src/utils/db.utils.js";
import { uniqueViolation } from "../helpers/dbMock.js";

describe("isDuplicateKeyError", () => {
  it("should return true for a unique violation wrapped by Drizzle", () => {
    expect(isDuplicateKeyError(uniqueViolation())).toBe(true);
  });

  it("should return true for a unique violation straight from pg", () => {
    expect(isDuplicateKeyError(uniqueViolation().cause)).toBe(true);
  });

  it("should return false for other database errors", () => {
    const err = new pg.DatabaseError("permission denied", 0, "error");
    err.code = "42501";

    expect(isDuplicateKeyError(err)).toBe(false);
  });

  it("should return false for errors that are not from the database", () => {
    expect(isDuplicateKeyError(new Error("23505"))).toBe(false);
    expect(isDuplicateKeyError({ code: "23505" })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});
