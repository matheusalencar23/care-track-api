import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  login,
  requestPasswordReset,
  resetPassword,
} from "../../src/modules/auth/auth.service.js";
import * as userRepository from "../../src/modules/user/user.repository.js";
import * as passwordResetTokenService from "../../src/modules/auth/passwordResetToken.service.js";
import { sendPasswordResetEmail } from "../../src/services/email/email.service.js";
import * as tokenUtils from "../../src/utils/token.utils.js";
import { messages } from "../../src/shared/messages.js";
import { AppLogger } from "../../src/shared/appLogger.js";
import * as auditLogService from "../../src/modules/audit/auditLog.service.js";

vi.mock("../../src/modules/audit/auditLog.service.js", () => ({
  record: vi.fn(),
}));

vi.mock("../../src/modules/user/user.repository.js", () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("../../src/modules/auth/passwordResetToken.service.js", () => ({
  createPasswordResetToken: vi.fn(),
  findValidToken: vi.fn(),
  invalidateUserTokens: vi.fn(),
  isOnResendCooldown: vi.fn(),
}));

vi.mock("../../src/services/email/email.service.js", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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

      await expect(login("ghost@example.com", "password123")).rejects.toThrow(
        messages.INVALID_CREDENTIALS,
      );

      expect(tokenUtils.generateToken).not.toHaveBeenCalled();
    });

    it("should throw when the user's email has not been verified yet", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        emailVerifiedAt: null,
        authenticate: vi.fn(),
      } as never);

      await expect(login("john@example.com", "password123")).rejects.toThrow(
        messages.INVALID_CREDENTIALS,
      );

      expect(tokenUtils.generateToken).not.toHaveBeenCalled();
    });

    it("should throw when the password does not match", async () => {
      const authenticate = vi.fn().mockResolvedValue(false);

      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        emailVerifiedAt: new Date(),
        authenticate,
      } as never);

      await expect(login("john@example.com", "wrong-password")).rejects.toThrow(
        messages.INVALID_CREDENTIALS,
      );

      expect(authenticate).toHaveBeenCalledWith("wrong-password");
      expect(tokenUtils.generateToken).not.toHaveBeenCalled();
    });

    it("should return a token when credentials are valid", async () => {
      const authenticate = vi.fn().mockResolvedValue(true);

      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        _id: "123",
        id: "123",
        emailVerifiedAt: new Date(),
        authenticate,
      } as never);

      vi.mocked(tokenUtils.generateToken).mockReturnValue("jwt-token");

      const token = await login("john@example.com", "password123");

      expect(token).toBe("jwt-token");
      expect(tokenUtils.generateToken).toHaveBeenCalledWith({ _id: "123" });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "123",
        action: "auth.signin",
        resourceType: "user",
        resourceId: "123",
      });
    });

    it("should not return a token when the audit log cannot be written", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        _id: "123",
        id: "123",
        emailVerifiedAt: new Date(),
        authenticate: vi.fn().mockResolvedValue(true),
      } as never);
      vi.mocked(auditLogService.record).mockRejectedValueOnce(
        new Error("DB is down"),
      );

      await expect(login("john@example.com", "password123")).rejects.toThrow(
        "DB is down",
      );
      expect(tokenUtils.generateToken).not.toHaveBeenCalled();
    });
  });

  describe("requestPasswordReset", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should do nothing when there is no user for the email", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      await requestPasswordReset("ghost@example.com");

      expect(
        passwordResetTokenService.createPasswordResetToken,
      ).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("should not send another email while the previous one is on cooldown", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        id: "123",
        name: "John Doe",
      } as never);
      vi.mocked(passwordResetTokenService.isOnResendCooldown).mockResolvedValue(
        true,
      );

      await requestPasswordReset("john@example.com");

      expect(passwordResetTokenService.isOnResendCooldown).toHaveBeenCalledWith(
        "123",
      );
      expect(
        passwordResetTokenService.createPasswordResetToken,
      ).not.toHaveBeenCalled();
    });

    it("should create a token and send the reset link", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        id: "123",
        name: "John Doe",
      } as never);
      vi.mocked(passwordResetTokenService.isOnResendCooldown).mockResolvedValue(
        false,
      );
      vi.mocked(
        passwordResetTokenService.createPasswordResetToken,
      ).mockResolvedValue("reset-token");

      await requestPasswordReset("john@example.com");

      await vi.waitFor(() => {
        expect(sendPasswordResetEmail).toHaveBeenCalledWith(
          "john@example.com",
          "John Doe",
          expect.stringMatching(/\?token=reset-token$/),
        );
      });
    });

    it("should not fail when sending the email fails", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        id: "123",
        name: "John Doe",
      } as never);
      vi.mocked(passwordResetTokenService.isOnResendCooldown).mockResolvedValue(
        false,
      );
      vi.mocked(
        passwordResetTokenService.createPasswordResetToken,
      ).mockResolvedValue("reset-token");
      vi.mocked(sendPasswordResetEmail).mockRejectedValue(
        new Error("Resend is down"),
      );

      await expect(
        requestPasswordReset("john@example.com"),
      ).resolves.toBeUndefined();

      await vi.waitFor(() => {
        expect(AppLogger.error).toHaveBeenCalledWith(
          "Error sending password reset email",
          { userId: "123" },
        );
      });
    });
  });

  describe("resetPassword", () => {
    const tokenRecord = { userId: { toString: () => "123" } };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should set the new password and then invalidate the user's tokens", async () => {
      vi.mocked(passwordResetTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );
      const verifiedAt = new Date("2026-01-01");
      const user = {
        id: "123",
        password: "old-hash",
        passwordChangedAt: null as Date | null,
        emailVerifiedAt: verifiedAt,
        save: vi.fn(),
      };
      vi.mocked(userRepository.findById).mockResolvedValue(user as never);

      await resetPassword("valid-token", "new-password");

      expect(userRepository.findById).toHaveBeenCalledWith("123");
      expect(user.password).toBe("new-password");
      expect(user.passwordChangedAt).toBeInstanceOf(Date);
      expect(user.emailVerifiedAt).toBe(verifiedAt);
      expect(user.save).toHaveBeenCalledOnce();
      expect(
        passwordResetTokenService.invalidateUserTokens,
      ).toHaveBeenCalledWith("123");
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "123",
        action: "auth.password_reset",
        resourceType: "user",
        resourceId: "123",
      });
      expect(
        vi.mocked(passwordResetTokenService.invalidateUserTokens).mock
          .invocationCallOrder[0],
      ).toBeGreaterThan(user.save.mock.invocationCallOrder[0]!);
    });

    it("should also confirm the email of an unverified user", async () => {
      vi.mocked(passwordResetTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );
      const user = {
        id: "123",
        emailVerifiedAt: null as Date | null,
        save: vi.fn(),
      };
      vi.mocked(userRepository.findById).mockResolvedValue(user as never);

      await resetPassword("valid-token", "new-password");

      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it("should keep the tokens when saving the user fails", async () => {
      vi.mocked(passwordResetTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: "123",
        save: vi.fn().mockRejectedValue(new Error("DB is down")),
      } as never);

      await expect(
        resetPassword("valid-token", "new-password"),
      ).rejects.toThrow("DB is down");
      expect(
        passwordResetTokenService.invalidateUserTokens,
      ).not.toHaveBeenCalled();
    });

    it("should throw when the user no longer exists", async () => {
      vi.mocked(passwordResetTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      await expect(
        resetPassword("valid-token", "new-password"),
      ).rejects.toThrow("Invalid token!");
    });

    it("should propagate the error when the token is invalid", async () => {
      const error = new Error("Invalid token!");
      vi.mocked(passwordResetTokenService.findValidToken).mockRejectedValue(
        error,
      );

      await expect(resetPassword("bad-token", "new-password")).rejects.toThrow(
        error,
      );
      expect(userRepository.findById).not.toHaveBeenCalled();
    });
  });
});
