import { describe, expect, it } from "vitest";

import { errorDetails } from "../../src/shared/errorDetails.js";
import { uniqueViolation } from "../helpers/dbMock.js";

describe("errorDetails", () => {
  it("should not expose the query params nor the Postgres detail of a database error", () => {
    const details = errorDetails(uniqueViolation("52998224725"));

    expect(JSON.stringify(details)).not.toContain("52998224725");
    expect(details).toMatchObject({
      error: "DrizzleQueryError",
      query: 'insert into "users" ("email") values ($1)',
      code: "23505",
      constraint: "users_email_unique",
    });
  });

  it("should keep the message and stack of other errors", () => {
    const details = errorDetails(new Error("Resend is down"));

    expect(details).toMatchObject({
      error: "Error",
      message: "Resend is down",
      stack: expect.stringContaining("Resend is down"),
    });
  });

  it("should describe values that are not errors", () => {
    expect(errorDetails("boom")).toEqual({ error: "boom" });
  });
});
