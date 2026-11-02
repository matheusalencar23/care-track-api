import { describe, expect, it } from "vitest";
import {
  comparePassword,
  generateRandomToken,
  hashPassword,
  hashToken,
} from "../../src/utils/crypt.utils.js";

describe("cryptUtils", () => {
  describe("hashPassword", () => {
    it("should generate a hash different from the original password", async () => {
      const password = "my-password";

      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
    });

    it("should generate a valid bcrypt hash", async () => {
      const password = "my-password";

      const hash = await hashPassword(password);

      expect(hash).toMatch(/^\$2[aby]?\$/);
    });
  });

  describe("comparePassword", () => {
    it("should return true when the password matches the hash", async () => {
      const password = "my-password";

      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it("should return false when the password does not match the hash", async () => {
      const password = "my-password";
      const wrongPassword = "wrong-password";

      const hash = await hashPassword(password);

      const result = await comparePassword(wrongPassword, hash);

      expect(result).toBe(false);
    });
  });

  describe("generateRandomToken", () => {
    it("should generate a different 64-char hex token each time", () => {
      const token = generateRandomToken();

      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(generateRandomToken()).not.toBe(token);
    });
  });

  describe("hashToken", () => {
    it("should be deterministic and differ from the token", () => {
      expect(hashToken("abc")).toBe(hashToken("abc"));
      expect(hashToken("abc")).not.toBe("abc");
      expect(hashToken("abc")).not.toBe(hashToken("abd"));
    });
  });
});
