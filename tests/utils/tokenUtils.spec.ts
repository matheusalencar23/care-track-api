import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { generateToken, verifyToken } from "../../src/utils/token.utils.js";
import { JWT_SECRET } from "../../src/config/secrets.js";
import { UnauthorizedException } from "../../src/shared/exceptions/index.js";

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

describe("tokenUtils", () => {
  describe("generateToken", () => {
    it("should generate a valid token", () => {
      const payload = {
        id: "123",
        email: "user@example.com",
      };

      const token = generateToken(payload, inOneHour());

      expect(token).toBeTypeOf("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should expire at the given time", () => {
      const expiresAt = inOneHour();

      const token = generateToken({ sub: "123" }, expiresAt);

      expect(verifyToken(token).exp).toBe(expiresAt);
    });
  });

  describe("verifyToken", () => {
    it("should return the original payload from a valid token", () => {
      const payload = {
        id: "123",
        email: "user@example.com",
      };

      const token = generateToken(payload, inOneHour());

      const result = verifyToken(token);

      expect(result.id).toBe(payload.id);
      expect(result.email).toBe(payload.email);
    });

    it("should throw when the token is invalid", () => {
      expect(() => verifyToken("invalid-token")).toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when the token is expired", () => {
      const token = jwt.sign(
        {
          id: "123",
          email: "user@example.com",
        },
        JWT_SECRET,
        {
          expiresIn: -1,
        },
      );

      expect(() => verifyToken(token)).toThrow(UnauthorizedException);
    });
  });
});
