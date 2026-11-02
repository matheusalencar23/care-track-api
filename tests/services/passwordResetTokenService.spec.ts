import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPasswordResetToken,
  findValidToken,
  invalidateUserTokens,
  isOnResendCooldown,
  PASSWORD_RESET_COOLDOWN_MS,
} from "../../src/modules/auth/passwordResetToken.service.js";
import * as passwordResetTokenRepository from "../../src/modules/auth/passwordResetToken.repository.js";

vi.mock("../../src/modules/auth/passwordResetToken.repository.js", () => ({
  save: vi.fn(),
  findByToken: vi.fn(),
  findLatestByUserId: vi.fn(),
  markAllAsUsedByUserId: vi.fn(),
}));

describe("passwordResetTokenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPasswordResetToken", () => {
    it("should persist a hash of the token, not the token itself", async () => {
      vi.mocked(passwordResetTokenRepository.save).mockResolvedValue(
        {} as never,
      );

      const token = await createPasswordResetToken("user-123");

      const [userId, storedHash, expiresAt] =
        vi.mocked(passwordResetTokenRepository.save).mock.calls[0] ?? [];

      expect(userId).toBe("user-123");
      expect(storedHash).not.toBe(token);
      expect(storedHash).toBe(createHash("sha256").update(token).digest("hex"));
      expect((expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("findValidToken", () => {
    it("should look the token up by its hash", async () => {
      const record = {
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      };
      vi.mocked(passwordResetTokenRepository.findByToken).mockResolvedValue(
        record as never,
      );

      await expect(findValidToken("valid-token")).resolves.toBe(record);
      expect(passwordResetTokenRepository.findByToken).toHaveBeenCalledWith(
        createHash("sha256").update("valid-token").digest("hex"),
      );
    });

    it("should throw when the token does not exist", async () => {
      vi.mocked(passwordResetTokenRepository.findByToken).mockResolvedValue(
        null,
      );

      await expect(findValidToken("unknown-token")).rejects.toThrow(
        "Invalid token!",
      );
    });

    it("should throw when the token has already been used", async () => {
      vi.mocked(passwordResetTokenRepository.findByToken).mockResolvedValue({
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      } as never);

      await expect(findValidToken("used-token")).rejects.toThrow(
        "Invalid token!",
      );
    });

    it("should throw when the token has expired", async () => {
      vi.mocked(passwordResetTokenRepository.findByToken).mockResolvedValue({
        usedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      } as never);

      await expect(findValidToken("expired-token")).rejects.toThrow(
        "Invalid token!",
      );
    });
  });

  describe("isOnResendCooldown", () => {
    it("should return false when the user has no token", async () => {
      vi.mocked(
        passwordResetTokenRepository.findLatestByUserId,
      ).mockResolvedValue(null);

      await expect(isOnResendCooldown("user-123")).resolves.toBe(false);
    });

    it("should return true when the latest token is within the cooldown", async () => {
      vi.mocked(
        passwordResetTokenRepository.findLatestByUserId,
      ).mockResolvedValue({
        createdAt: new Date(Date.now() - PASSWORD_RESET_COOLDOWN_MS + 5_000),
      } as never);

      await expect(isOnResendCooldown("user-123")).resolves.toBe(true);
    });

    it("should return false when the cooldown has passed", async () => {
      vi.mocked(
        passwordResetTokenRepository.findLatestByUserId,
      ).mockResolvedValue({
        createdAt: new Date(Date.now() - PASSWORD_RESET_COOLDOWN_MS - 1_000),
      } as never);

      await expect(isOnResendCooldown("user-123")).resolves.toBe(false);
    });
  });

  describe("invalidateUserTokens", () => {
    it("should mark every pending token of the user as used", async () => {
      vi.mocked(
        passwordResetTokenRepository.markAllAsUsedByUserId,
      ).mockResolvedValue({} as never);

      await invalidateUserTokens("user-123");

      expect(
        passwordResetTokenRepository.markAllAsUsedByUserId,
      ).toHaveBeenCalledWith("user-123", expect.any(Date));
    });
  });
});
