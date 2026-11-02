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

const userData = {
  name: "John Doe",
  email: "john@example.com",
  password: "password123",
  coren: "123456",
  corenState: "SP" as const,
};

describe("userRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("save", () => {
    it("should save and return the user", async () => {
      const userDoc = mockUserSave(async () => undefined);

      const result = await save(userData);

      expect(User).toHaveBeenCalledWith(userData);
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

      const promise = save(userData);

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

      await expect(save(userData)).rejects.toBe(error);
    });
  });
});
