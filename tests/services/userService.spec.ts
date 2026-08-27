import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUser } from "../../src/modules/user/user.service.js";
import { INVALID_REGISTRATION_CREDENTIALS } from "../../src/shared/messages.js";
import { findByEmail, save } from "../../src/modules/user/user.repository.js";

vi.mock("../../src/modules/user/user.repository.js", () => ({
  findByEmail: vi.fn(),
  save: vi.fn(),
}));

describe("userService", () => {
  describe("createUser", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("should throw when user already exists", async () => {
      const findOneSpy = vi.mocked(findByEmail).mockResolvedValue({
        _id: "123",
      } as never);

      await expect(
        createUser("John Doe", "john@example.com", "password123"),
      ).rejects.toThrow(INVALID_REGISTRATION_CREDENTIALS);

      expect(findOneSpy).toHaveBeenCalledWith("john@example.com");
    });

    it("should create and save a user when email is not registered", async () => {
      const findOneSpy = vi.mocked(findByEmail).mockResolvedValue(null);

      const saveSpy = vi.mocked(save).mockResolvedValue(undefined as never);

      await createUser("John Doe", "john@example.com", "password123");

      expect(findOneSpy).toHaveBeenCalledWith("john@example.com");

      expect(saveSpy).toHaveBeenCalledOnce();
    });
  });
});
