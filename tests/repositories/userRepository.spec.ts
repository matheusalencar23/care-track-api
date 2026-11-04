import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "../../src/db/db.js";
import { save } from "../../src/modules/user/user.repository.js";
import { BadRequestException } from "../../src/shared/exceptions/index.js";
import { messages } from "../../src/shared/messages.js";
import { uniqueViolation } from "../helpers/dbMock.js";

vi.mock(
  "../../src/db/db.js",
  async () => (await import("../helpers/dbMock.js")).dbModuleMock,
);

vi.mock("../../src/utils/crypt.utils.js", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

const mockInsert = (returning: () => Promise<unknown[]>) => {
  const values = vi.fn(() => ({ returning: vi.fn(returning) }));
  vi.mocked(getDb).mockReturnValue({
    insert: vi.fn(() => ({ values })),
  } as never);
  return values;
};

const userData = {
  name: "  John Doe ",
  email: " John@Example.com ",
  password: "password123",
  coren: "123456",
  corenState: "SP" as const,
};

describe("userRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("save", () => {
    it("should store the hashed password and the normalized name and email", async () => {
      const user = { id: "123" };
      const values = mockInsert(async () => [user]);

      await expect(save(userData)).resolves.toBe(user);

      expect(values).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john@example.com",
        passwordHash: "hashed:password123",
        coren: "123456",
        corenState: "SP",
      });
    });

    it("should throw the same error as an already registered email on duplicate key", async () => {
      mockInsert(async () => {
        throw uniqueViolation();
      });

      const promise = save(userData);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(
        messages.INVALID_REGISTRATION_CREDENTIALS,
      );
    });

    it("should rethrow other errors unchanged", async () => {
      const error = new Error("DB is down");
      mockInsert(async () => {
        throw error;
      });

      await expect(save(userData)).rejects.toBe(error);
    });
  });
});
