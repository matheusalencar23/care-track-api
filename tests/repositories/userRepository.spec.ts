import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

import User from "../../src/modules/user/user.model.js";
import { save } from "../../src/modules/user/user.repository.js";
import { BadRequestException } from "../../src/shared/exceptions/index.js";
import { messages } from "../../src/shared/messages.js";

vi.mock("../../src/modules/user/user.model.js", () => ({
  default: vi.fn(),
}));

const mockUserSave = (saveImpl: () => Promise<unknown>) => {
  const userDoc = { save: vi.fn(saveImpl) };
  vi.mocked(User).mockImplementation(function () {
    return userDoc;
  } as never);
  return userDoc;
};

describe("userRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("save", () => {
    it("should save and return the user", async () => {
      const userDoc = mockUserSave(async () => undefined);

      const result = await save("John Doe", "john@example.com", "password123");

      expect(User).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      });
      expect(userDoc.save).toHaveBeenCalledOnce();
      expect(result).toBe(userDoc);
    });

    it("should throw the same error as an already registered email on duplicate key", async () => {
      mockUserSave(async () => {
        throw new mongoose.mongo.MongoServerError({
          message:
            'E11000 duplicate key error collection: users index: email_1 dup key: { email: "john@example.com" }',
          code: 11000,
        });
      });

      const promise = save("John Doe", "john@example.com", "password123");

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(
        messages.INVALID_REGISTRATION_CREDENTIALS,
      );
    });

    it("should rethrow other errors unchanged", async () => {
      const error = new Error("DB is down");
      mockUserSave(async () => {
        throw error;
      });

      await expect(
        save("John Doe", "john@example.com", "password123"),
      ).rejects.toBe(error);
    });
  });
});
