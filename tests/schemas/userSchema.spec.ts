import { describe, expect, it } from "vitest";

import {
  SigninSchema,
  SignupSchema,
} from "../../src/modules/user/user.schema.js";

const signupPayload = (password: unknown) => ({
  body: { name: "John Doe", email: "john@example.com", password },
});

const errorMessages = (password: unknown) => {
  const result = SignupSchema.safeParse(signupPayload(password));
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("SignupSchema", () => {
  describe("password", () => {
    it("should accept a password with exactly 8 characters", () => {
      expect(SignupSchema.safeParse(signupPayload("12345678")).success).toBe(
        true,
      );
    });

    it("should accept a password with exactly 72 characters", () => {
      expect(
        SignupSchema.safeParse(signupPayload("a".repeat(72))).success,
      ).toBe(true);
    });

    it("should reject a password shorter than 8 characters", () => {
      expect(errorMessages("1234567")).toEqual([
        "A senha deve ter pelo menos 8 caracteres",
      ]);
    });

    it("should reject a password longer than 72 characters", () => {
      expect(errorMessages("a".repeat(73))).toEqual([
        "A senha deve ter no máximo 72 caracteres",
      ]);
    });

    it("should count leading and trailing spaces as part of the password", () => {
      expect(SignupSchema.safeParse(signupPayload("  123456")).success).toBe(
        true,
      );
    });

    it("should reject a missing password", () => {
      expect(errorMessages(undefined)).toEqual(["A senha é obrigatória"]);
    });
  });
});

describe("SigninSchema", () => {
  // A regra de tamanho vale só para novos cadastros: contas criadas antes
  // dela, com senha curta, precisam continuar conseguindo entrar.
  it("should not enforce the minimum length on signin", () => {
    const result = SigninSchema.safeParse({
      body: { email: "john@example.com", password: "123" },
    });

    expect(result.success).toBe(true);
  });
});
