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
import { comparePassword } from "../../src/utils/crypt.utils.js";
import { withTransaction } from "../../src/db/db.js";

vi.mock("../../src/modules/audit/auditLog.service.js", () => ({
  record: vi.fn(),
}));

vi.mock("../../src/modules/user/user.repository.js", () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock("../../src/utils/crypt.utils.js", () => ({
  comparePassword: vi.fn(),
}));

vi.mock(
  "../../src/db/db.js",
  async () => (await import("../helpers/dbMock.js")).dbModuleMock,
);

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
        passwordHash: "hash",
      } as never);

      await expect(login("john@example.com", "password123")).rejects.toThrow(
        messages.INVALID_CREDENTIALS,
      );

      expect(tokenUtils.generateToken).not.toHaveBeenCalled();
    });

    it("should throw when the password does not match", async () => {
      vi.mocked(comparePassword).mockResolvedValue(false);

      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        emailVerifiedAt: new Date(),
        passwordHash: "hash",
      } as never);

      await expect(login("john@example.com", "wrong-password")).rejects.toThrow(
        messages.INVALID_CREDENTIALS,
      );

      expect(comparePassword).toHaveBeenCalledWith("wrong-password", "hash");
      expect(tokenUtils.generateToken).not.toHaveBeenCalled();
    });

    it("should return a token when credentials are valid", async () => {
      vi.mocked(comparePassword).mockResolvedValue(true);

      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        id: "123",
        emailVerifiedAt: new Date(),
        passwordHash: "hash",
      } as never);

      vi.mocked(tokenUtils.generateToken).mockReturnValue("jwt-token");

      const token = await login("john@example.com", "password123");

      expect(token).toBe("jwt-token");
      expect(tokenUtils.generateToken).toHaveBeenCalledWith({ sub: "123" });
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "123",
        action: "auth.signin",
        resourceType: "user",
        resourceId: "123",
      });
    });

    it("should not return a token when the audit log cannot be written", async () => {
      vi.mocked(comparePassword).mockResolvedValue(true);
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        id: "123",
        emailVerifiedAt: new Date(),
        passwordHash: "hash",
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
          expect.objectContaining({ userId: "123", message: "Resend is down" }),
        );
      });
    });
  });

  describe("resetPassword", () => {
    const tokenRecord = { userId: "123" };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should set the new password, invalidate the user's tokens and audit in one transaction", async () => {
      vi.mocked(passwordResetTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );
      const verifiedAt = new Date("2026-01-01");
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: "123",
        emailVerifiedAt: verifiedAt,
      } as never);

      await resetPassword("valid-token", "new-password");

      expect(userRepository.findById).toHaveBeenCalledWith("123");
      expect(userRepository.updatePassword).toHaveBeenCalledWith(
        "123",
        "new-password",
        { passwordChangedAt: expect.any(Date), emailVerifiedAt: verifiedAt },
      );
      expect(
        passwordResetTokenService.invalidateUserTokens,
      ).toHaveBeenCalledWith("123");
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "123",
        action: "auth.password_reset",
        resourceType: "user",
        resourceId: "123",
      });
      expect(withTransaction).toHaveBeenCalledOnce();
      expect(
        vi.mocked(passwordResetTokenService.invalidateUserTokens).mock
          .invocationCallOrder[0],
      ).toBeGreaterThan(
        vi.mocked(userRepository.updatePassword).mock.invocationCallOrder[0]!,
      );
    });

    it("should also confirm the email of an unverified user", async () => {
      vi.mocked(passwordResetTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: "123",
        emailVerifiedAt: null,
      } as never);

      await resetPassword("valid-token", "new-password");

      const [, , changes] =
        vi.mocked(userRepository.updatePassword).mock.calls[0] ?? [];
      expect(changes?.emailVerifiedAt).toBeInstanceOf(Date);
      expect(changes?.emailVerifiedAt).toBe(changes?.passwordChangedAt);
    });

    it("should keep the tokens when saving the password fails", async () => {
      vi.mocked(passwordResetTokenService.findValidToken).mockResolvedValue(
        tokenRecord as never,
      );
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: "123",
        emailVerifiedAt: null,
      } as never);
      vi.mocked(userRepository.updatePassword).mockRejectedValueOnce(
        new Error("DB is down"),
      );

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
      ).rejects.toThrow(messages.INVALID_LINK_TOKEN);
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
