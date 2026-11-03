import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createUser,
  resendValidation,
  validateUser,
} from "../../src/modules/user/user.service.js";
import { messages } from "../../src/shared/messages.js";
import { TooManyRequestsException } from "../../src/shared/exceptions/index.js";

import * as userRepository from "../../src/modules/user/user.repository.js";
import * as emailVerificationTokenService from "../../src/modules/email/emailVerificationToken.service.js";

import { sendConfirmationEmail } from "../../src/services/email/email.service.js";
import { AppLogger } from "../../src/shared/appLogger.js";
import { withTransaction } from "../../src/db/db.js";

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../src/modules/user/user.repository.js", () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  save: vi.fn(),
  markEmailVerified: vi.fn(),
}));

vi.mock(
  "../../src/db/db.js",
  async () => (await import("../helpers/dbMock.js")).dbModuleMock,
);

vi.mock("../../src/modules/email/emailVerificationToken.service.js", () => ({
  createEmailVerificationToken: vi.fn(),
  findValidToken: vi.fn(),
  markTokenAsUsed: vi.fn(),
  isOnResendCooldown: vi.fn(),
}));

vi.mock("../../src/services/email/email.service.js", () => ({
  sendConfirmationEmail: vi.fn(),
}));

const userData = {
  name: "John Doe",
  email: "john@example.com",
  password: "password123",
  coren: "123456",
  corenState: "SP" as const,
};

describe("userService", () => {
  describe("createUser", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should throw when user already exists", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        _id: "123",
      } as never);

      await expect(createUser(userData)).rejects.toThrow(
        messages.INVALID_REGISTRATION_CREDENTIALS,
      );

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

      await createUser(userData);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        "john@example.com",
      );

      expect(userRepository.save).toHaveBeenCalledWith(userData);

      expect(
        emailVerificationTokenService.createEmailVerificationToken,
      ).toHaveBeenCalledWith("123");

      expect(sendConfirmationEmail).toHaveBeenCalledOnce();
    });

    // O cadastro não deve ser barrado pelo envio do e-mail: o usuário pode
    // pedir um novo envio em /users/resend. Se o `.catch` do createUser for
    // removido, a rejeição fica sem tratamento e o Vitest falha a execução.
    it("should not fail when sending the confirmation email fails", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(userRepository.save).mockResolvedValue({
        id: "123",
        email: "john@example.com",
        name: "John Doe",
      } as never);
      vi.mocked(
        emailVerificationTokenService.createEmailVerificationToken,
      ).mockResolvedValue("verification-token");
      vi.mocked(sendConfirmationEmail).mockRejectedValue(
        new Error("Resend is down"),
      );

      await expect(createUser(userData)).resolves.toBeUndefined();

      expect(userRepository.save).toHaveBeenCalledOnce();

      await vi.waitFor(() => {
        expect(AppLogger.error).toHaveBeenCalledWith(
          "Error sending confirmation email",
          expect.objectContaining({ userId: "123" }),
        );
      });
    });

    it("should not fail when creating the verification token fails", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(userRepository.save).mockResolvedValue({
        id: "123",
        email: "john@example.com",
        name: "John Doe",
      } as never);
      vi.mocked(
        emailVerificationTokenService.createEmailVerificationToken,
      ).mockRejectedValue(new Error("DB is down"));

      await expect(createUser(userData)).resolves.toBeUndefined();

      await vi.waitFor(() => {
        expect(AppLogger.error).toHaveBeenCalledWith(
          "Error sending confirmation email",
          expect.objectContaining({ userId: "123" }),
        );
      });

      expect(sendConfirmationEmail).not.toHaveBeenCalled();
    });
  });

  describe("validateUser", () => {
    const tokenRecord = { userId: "123" };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should mark the user's email as verified and then consume the token", async () => {
      vi.mocked(emailVerificationTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );

      vi.mocked(userRepository.findById).mockResolvedValue({
        id: "123",
        emailVerifiedAt: null,
      } as never);

      await validateUser("valid-token");

      expect(emailVerificationTokenService.findValidToken).toHaveBeenCalledWith(
        "valid-token",
      );
      expect(userRepository.findById).toHaveBeenCalledWith("123");
      expect(userRepository.markEmailVerified).toHaveBeenCalledWith(
        "123",
        expect.any(Date),
      );
      expect(
        emailVerificationTokenService.markTokenAsUsed,
      ).toHaveBeenCalledWith(tokenRecord);
      expect(withTransaction).toHaveBeenCalledOnce();
      expect(
        vi.mocked(emailVerificationTokenService.markTokenAsUsed).mock
          .invocationCallOrder[0],
      ).toBeGreaterThan(
        vi.mocked(userRepository.markEmailVerified).mock
          .invocationCallOrder[0]!,
      );
    });

    it("should throw and keep the token when the user no longer exists", async () => {
      vi.mocked(emailVerificationTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      await expect(validateUser("valid-token")).rejects.toThrow(
        messages.INVALID_LINK_TOKEN,
      );
      expect(
        emailVerificationTokenService.markTokenAsUsed,
      ).not.toHaveBeenCalled();
    });

    it("should throw and keep the token when the email is already verified", async () => {
      vi.mocked(emailVerificationTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: "123",
        emailVerifiedAt: new Date(),
      } as never);

      await expect(validateUser("valid-token")).rejects.toThrow(
        messages.EMAIL_ALREADY_VERIFIED,
      );
      expect(
        emailVerificationTokenService.markTokenAsUsed,
      ).not.toHaveBeenCalled();
    });

    it("should keep the token when saving the user fails", async () => {
      vi.mocked(emailVerificationTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: "123",
        emailVerifiedAt: null,
      } as never);
      vi.mocked(userRepository.markEmailVerified).mockRejectedValueOnce(
        new Error("DB is down"),
      );

      await expect(validateUser("valid-token")).rejects.toThrow("DB is down");
      expect(
        emailVerificationTokenService.markTokenAsUsed,
      ).not.toHaveBeenCalled();
    });

    it("should propagate the error when the token itself is invalid or expired", async () => {
      const error = new Error("Invalid token!");
      vi.mocked(emailVerificationTokenService.findValidToken).mockRejectedValue(
        error,
      );

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
        messages.USER_NOT_FOUND,
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
        messages.EMAIL_ALREADY_VERIFIED,
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

    it("should not resend the email while the previous one is on cooldown", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        id: "123",
        name: "John Doe",
        emailVerifiedAt: null,
      } as never);

      vi.mocked(
        emailVerificationTokenService.isOnResendCooldown,
      ).mockResolvedValue(true);

      await expect(resendValidation("john@example.com")).rejects.toBeInstanceOf(
        TooManyRequestsException,
      );

      expect(
        emailVerificationTokenService.isOnResendCooldown,
      ).toHaveBeenCalledWith("123");
      expect(
        emailVerificationTokenService.createEmailVerificationToken,
      ).not.toHaveBeenCalled();
      expect(sendConfirmationEmail).not.toHaveBeenCalled();
    });
  });
});
