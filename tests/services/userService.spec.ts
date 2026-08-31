import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUser } from "../../src/modules/user/user.service.js";
import { INVALID_REGISTRATION_CREDENTIALS } from "../../src/shared/messages.js";

import * as userRepository from "../../src/modules/user/user.repository.js";
import * as emailVerificationTokenService from "../../src/modules/email/emailVerificationToken.service.js";

import { sendConfirmationEmail } from "../../src/services/email/email.service.js";

vi.mock("../../src/modules/user/user.repository.js", () => ({
  findByEmail: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../src/modules/email/emailVerificationToken.service.js", () => ({
  createEmailVerificationToken: vi.fn(),
}));

vi.mock("../../src/services/email/email.service.js", () => ({
  sendConfirmationEmail: vi.fn(),
}));

describe("userService", () => {
  describe("createUser", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should throw when user already exists", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        _id: "123",
      } as never);

      await expect(
        createUser("John Doe", "john@example.com", "password123"),
      ).rejects.toThrow(INVALID_REGISTRATION_CREDENTIALS);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        "john@example.com",
      );

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it("should create and save a user when email is not registered", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      vi.mocked(userRepository.save).mockResolvedValue({
        id: "123",
        email: "john@example.com",
        name: "John Doe",
      } as never);

      vi.mocked(
        emailVerificationTokenService.createEmailVerificationToken,
      ).mockResolvedValue("verification-token");

      vi.mocked(sendConfirmationEmail).mockResolvedValue();

      await createUser(
        "John Doe",
        "john@example.com",
        "password123",
      );

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        "john@example.com",
      );

      expect(userRepository.save).toHaveBeenCalledWith(
        "John Doe",
        "john@example.com",
        "password123",
      );

      expect(
        emailVerificationTokenService.createEmailVerificationToken,
      ).toHaveBeenCalledWith("123");

      expect(sendConfirmationEmail).toHaveBeenCalledOnce();
    });
  });
});