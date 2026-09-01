import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmailVerificationToken,
  deleteVerificationTokenByUserId,
  validateByToken,
} from "../../src/modules/email/emailVerificationToken.service.js";
import * as emailVerificationTokenRepository from "../../src/modules/email/emailVerificationToken.repository.js";

vi.mock("../../src/modules/email/emailVerificationToken.repository.js", () => ({
  save: vi.fn(),
  findByToken: vi.fn(),
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
      expect(storedHash).toBe(
        createHash("sha256").update(token).digest("hex"),
      );
      expect(expiresAt).toBeInstanceOf(Date);
      expect((expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("validateByToken", () => {
    it("should throw when the token does not exist", async () => {
      vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue(
        null,
      );

      await expect(validateByToken("unknown-token")).rejects.toThrow(
        "Invalid token!",
      );
    });

    it("should throw when the token has already been used", async () => {
      vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue({
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        save: vi.fn(),
      } as never);

      await expect(validateByToken("used-token")).rejects.toThrow(
        "Invalid token!",
      );
    });

    it("should throw when the token has expired", async () => {
      vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue({
        usedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
        save: vi.fn(),
      } as never);

      await expect(validateByToken("expired-token")).rejects.toThrow(
        "Invalid token!",
      );
    });

    it("should mark a valid token as used and return it", async () => {
      const save = vi.fn();
      const record = {
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        save,
      };

      vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue(
        record as never,
      );

      const result = await validateByToken("valid-token");

      expect(result.usedAt).toBeInstanceOf(Date);
      expect(save).toHaveBeenCalledOnce();
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
