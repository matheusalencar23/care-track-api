import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmailVerificationToken,
  deleteVerificationTokenByUserId,
  isOnResendCooldown,
  RESEND_COOLDOWN_MS,
  findValidToken,
  markTokenAsUsed,
} from "../../src/modules/email/emailVerificationToken.service.js";
import * as emailVerificationTokenRepository from "../../src/modules/email/emailVerificationToken.repository.js";
import { messages } from "../../src/shared/messages.js";

vi.mock("../../src/modules/email/emailVerificationToken.repository.js", () => ({
  save: vi.fn(),
  findByToken: vi.fn(),
  findLatestByUserId: vi.fn(),
  deleteByUserId: vi.fn(),
}));

describe("emailVerificationTokenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEmailVerificationToken", () => {
    it("should persist a hash of the token, not the token itself", async () => {
      vi.mocked(emailVerificationTokenRepository.save).mockResolvedValue(
        {} as never,
      );

      const token = await createEmailVerificationToken("user-123");

      expect(token).toEqual(expect.any(String));
      expect(emailVerificationTokenRepository.save).toHaveBeenCalledOnce();

      const [userId, storedHash, expiresAt] =
        vi.mocked(emailVerificationTokenRepository.save).mock.calls[0] ?? [];

      expect(userId).toBe("user-123");
      expect(storedHash).not.toBe(token);
      expect(storedHash).toBe(createHash("sha256").update(token).digest("hex"));
      expect(expiresAt).toBeInstanceOf(Date);
      expect((expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("findValidToken", () => {
    it("should throw when the token does not exist", async () => {
      vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue(
        null,
      );

      await expect(findValidToken("unknown-token")).rejects.toThrow(
        messages.INVALID_LINK_TOKEN,
      );
    });

    it("should throw when the token has already been used", async () => {
      vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue(
        {
          usedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          save: vi.fn(),
        } as never,
      );

      await expect(findValidToken("used-token")).rejects.toThrow(
        messages.INVALID_LINK_TOKEN,
      );
    });

    it("should throw when the token has expired", async () => {
      vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue(
        {
          usedAt: null,
          expiresAt: new Date(Date.now() - 60_000),
          save: vi.fn(),
        } as never,
      );

      await expect(findValidToken("expired-token")).rejects.toThrow(
        messages.INVALID_LINK_TOKEN,
      );
    });

    it("should return a valid token without consuming it", async () => {
      const save = vi.fn();
      const record = {
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        save,
      };

      vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue(
        record as never,
      );

      const result = await findValidToken("valid-token");

      expect(result).toBe(record);
      expect(result.usedAt).toBeNull();
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe("markTokenAsUsed", () => {
    it("should set usedAt and save the token", async () => {
      const record = { usedAt: null as Date | null, save: vi.fn() };

      await markTokenAsUsed(record as never);

      expect(record.usedAt).toBeInstanceOf(Date);
      expect(record.save).toHaveBeenCalledOnce();
    });
  });

  describe("isOnResendCooldown", () => {
    it("should return false when the user has no token", async () => {
      vi.mocked(
        emailVerificationTokenRepository.findLatestByUserId,
      ).mockResolvedValue(null);

      await expect(isOnResendCooldown("user-123")).resolves.toBe(false);
      expect(
        emailVerificationTokenRepository.findLatestByUserId,
      ).toHaveBeenCalledWith("user-123");
    });

    it("should return true when the latest token is within the cooldown", async () => {
      vi.mocked(
        emailVerificationTokenRepository.findLatestByUserId,
      ).mockResolvedValue({
        createdAt: new Date(Date.now() - RESEND_COOLDOWN_MS + 5_000),
      } as never);

      await expect(isOnResendCooldown("user-123")).resolves.toBe(true);
    });

    it("should return false when the cooldown has passed", async () => {
      vi.mocked(
        emailVerificationTokenRepository.findLatestByUserId,
      ).mockResolvedValue({
        createdAt: new Date(Date.now() - RESEND_COOLDOWN_MS - 1_000),
      } as never);

      await expect(isOnResendCooldown("user-123")).resolves.toBe(false);
    });
  });

  describe("deleteVerificationTokenByUserId", () => {
    it("should delegate to the repository", async () => {
      vi.mocked(
        emailVerificationTokenRepository.deleteByUserId,
      ).mockResolvedValue({} as never);

      await deleteVerificationTokenByUserId("user-123");

      expect(
        emailVerificationTokenRepository.deleteByUserId,
      ).toHaveBeenCalledWith("user-123");
    });
  });
});
