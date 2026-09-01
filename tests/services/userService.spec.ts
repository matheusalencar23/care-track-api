import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createUser,
  resendValidation,
  validateUser,
} from "../../src/modules/user/user.service.js";
import { INVALID_REGISTRATION_CREDENTIALS } from "../../src/shared/messages.js";

import * as userRepository from "../../src/modules/user/user.repository.js";
import * as emailVerificationTokenService from "../../src/modules/email/emailVerificationToken.service.js";

import { sendConfirmationEmail } from "../../src/services/email/email.service.js";

vi.mock("../../src/modules/user/user.repository.js", () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../src/modules/email/emailVerificationToken.service.js", () => ({
  createEmailVerificationToken: vi.fn(),
  validateByToken: vi.fn(),
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

      await createUser("John Doe", "john@example.com", "password123");

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

  describe("validateUser", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should mark the user's email as verified for a valid token", async () => {
      vi.mocked(
        emailVerificationTokenService.validateByToken,
      ).mockResolvedValue({
        userId: { toString: () => "123" },
      } as never);

      const save = vi.fn();
      vi.mocked(userRepository.findById).mockResolvedValue({
        emailVerifiedAt: null,
        save,
      } as never);

      await validateUser("valid-token");

      expect(
        emailVerificationTokenService.validateByToken,
      ).toHaveBeenCalledWith("valid-token");
      expect(userRepository.findById).toHaveBeenCalledWith("123");
      expect(save).toHaveBeenCalledOnce();
    });

    it("should throw when the email is already verified", async () => {
      vi.mocked(
        emailVerificationTokenService.validateByToken,
      ).mockResolvedValue({
        userId: { toString: () => "123" },
      } as never);

      vi.mocked(userRepository.findById).mockResolvedValue({
        emailVerifiedAt: new Date(),
        save: vi.fn(),
      } as never);

      await expect(validateUser("valid-token")).rejects.toThrow(
        "Email already verified!",
      );
    });

    it("should propagate the error when the token itself is invalid or expired", async () => {
      const error = new Error("Invalid token!");
      vi.mocked(
        emailVerificationTokenService.validateByToken,
      ).mockRejectedValue(error);

      await expect(validateUser("bad-token")).rejects.toThrow(error);
      expect(userRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe("resendValidation", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should throw NotFoundException when there is no user for the email", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      await expect(resendValidation("ghost@example.com")).rejects.toThrow(
        "User not found!",
      );

      expect(sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it("should throw when the email is already verified", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        id: "123",
        name: "John Doe",
        emailVerifiedAt: new Date(),
      } as never);

      await expect(resendValidation("john@example.com")).rejects.toThrow(
        "Email already verified!",
      );

      expect(sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it("should create a new verification token and resend the email", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        id: "123",
        name: "John Doe",
        emailVerifiedAt: null,
      } as never);

      vi.mocked(
        emailVerificationTokenService.createEmailVerificationToken,
      ).mockResolvedValue("verification-token");

      vi.mocked(sendConfirmationEmail).mockResolvedValue();

      await resendValidation("john@example.com");

      expect(
        emailVerificationTokenService.createEmailVerificationToken,
      ).toHaveBeenCalledWith("123");

      expect(sendConfirmationEmail).toHaveBeenCalledOnce();
    });
  });
});
