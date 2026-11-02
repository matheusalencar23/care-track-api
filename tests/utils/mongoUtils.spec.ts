import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { isDuplicateKeyError } from "../../src/utils/mongo.utils.js";

describe("isDuplicateKeyError", () => {
  it("should return true for a MongoServerError with code 11000", () => {
    const err = new mongoose.mongo.MongoServerError({
      message: "E11000 duplicate key error",
      code: 11000,
    });

    expect(isDuplicateKeyError(err)).toBe(true);
  });

  it("should return false for a MongoServerError with another code", () => {
    const err = new mongoose.mongo.MongoServerError({
      message: "Some other error",
      code: 2,
    });

    expect(isDuplicateKeyError(err)).toBe(false);
  });

  it("should return false for errors that are not from Mongo", () => {
    expect(isDuplicateKeyError(new Error("E11000"))).toBe(false);
    expect(isDuplicateKeyError({ code: 11000 })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});
