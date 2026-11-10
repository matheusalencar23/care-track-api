import pg from "pg";
import { describe, expect, it } from "vitest";

import {
  duplicateKeyConstraint,
  isDuplicateKeyError,
} from "../../src/utils/db.utils.js";
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

describe("duplicateKeyConstraint", () => {
  it("should return the violated constraint of a unique violation", () => {
    const err = uniqueViolation("52998224725", "patients_owner_id_cpf_unique");

    expect(duplicateKeyConstraint(err)).toBe("patients_owner_id_cpf_unique");
    expect(duplicateKeyConstraint(err.cause)).toBe(
      "patients_owner_id_cpf_unique",
    );
  });

  it("should return undefined for other errors", () => {
    const err = new pg.DatabaseError("permission denied", 0, "error");
    err.code = "42501";
    err.constraint = "patients_owner_id_cpf_unique";

    expect(duplicateKeyConstraint(err)).toBeUndefined();
    expect(duplicateKeyConstraint(new Error("23505"))).toBeUndefined();
  });
});
