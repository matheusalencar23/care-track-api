import { beforeEach, describe, expect, it, vi } from "vitest";

import User from "../../src/models/user.js";
import { createUser } from "../../src/services/userService.js";
import { INVALID_REGISTRATION_CREDENTIALS } from "../../src/shared/messages.js";

vi.spyOn(User, "findOne");

describe("userService", () => {
  describe("createUser", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("should throw when user already exists", async () => {
      const findOneSpy = vi.spyOn(User, "findOne").mockResolvedValue({
        _id: "123",
      } as never);

      await expect(
        createUser("John Doe", "john@example.com", "password123"),
      ).rejects.toThrow(INVALID_REGISTRATION_CREDENTIALS);

      expect(findOneSpy).toHaveBeenCalledWith({
        email: "john@example.com",
      });
    });

    it("should create and save a user when email is not registered", async () => {
      const findOneSpy = vi.spyOn(User, "findOne").mockResolvedValue(null);

      const saveSpy = vi
        .spyOn(User.prototype, "save")
        .mockResolvedValue(undefined as never);

      await createUser("John Doe", "john@example.com", "password123");

      expect(findOneSpy).toHaveBeenCalledWith({
        email: "john@example.com",
      });

      expect(saveSpy).toHaveBeenCalledOnce();
    });
  });
});
