import { beforeEach, describe, expect, it, vi } from "vitest";

import { login } from "../../src/modules/auth/auth.service.js";
import * as userRepository from "../../src/modules/user/user.repository.js";
import * as tokenUtils from "../../src/utils/token.utils.js";

vi.mock("../../src/modules/user/user.repository.js", () => ({
  findByEmail: vi.fn(),
}));

vi.mock("../../src/utils/token.utils.js", () => ({
  generateToken: vi.fn(),
}));

describe("authService", () => {
  describe("login", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should throw when there is no user for the email", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      await expect(
        login("ghost@example.com", "password123"),
      ).rejects.toThrow("Invalid credentials");

      expect(tokenUtils.generateToken).not.toHaveBeenCalled();
    });

    it("should throw when the user's email has not been verified yet", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        emailVerifiedAt: null,
        authenticate: vi.fn(),
      } as never);

      await expect(
        login("john@example.com", "password123"),
      ).rejects.toThrow("Invalid credentials");

      expect(tokenUtils.generateToken).not.toHaveBeenCalled();
    });

    it("should throw when the password does not match", async () => {
      const authenticate = vi.fn().mockResolvedValue(false);

      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        emailVerifiedAt: new Date(),
        authenticate,
      } as never);

      await expect(
        login("john@example.com", "wrong-password"),
      ).rejects.toThrow("Invalid credentials");

      expect(authenticate).toHaveBeenCalledWith("wrong-password");
      expect(tokenUtils.generateToken).not.toHaveBeenCalled();
    });

    it("should return a token when credentials are valid", async () => {
      const authenticate = vi.fn().mockResolvedValue(true);

      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        _id: "123",
        emailVerifiedAt: new Date(),
        authenticate,
      } as never);

      vi.mocked(tokenUtils.generateToken).mockReturnValue("jwt-token");

      const token = await login("john@example.com", "password123");

      expect(token).toBe("jwt-token");
      expect(tokenUtils.generateToken).toHaveBeenCalledWith({ _id: "123" });
    });
  });
});
