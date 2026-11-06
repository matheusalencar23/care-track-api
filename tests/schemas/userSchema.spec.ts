import { describe, expect, it } from "vitest";

import {
  SigninSchema,
  SignupSchema,
} from "../../src/modules/user/user.schema.js";
import { CURRENT_TERMS_VERSION } from "../../src/modules/terms/terms.js";

const signupBody = {
  name: "John Doe",
  email: "john@example.com",
  password: "password123",
  coren: "123456",
  corenState: "SP",
  acceptedTermsVersion: CURRENT_TERMS_VERSION,
};

const signupPayload = (password: unknown) => ({
  body: { ...signupBody, password },
});

const signupErrors = (overrides: Record<string, unknown>) => {
  const result = SignupSchema.safeParse({
    body: { ...signupBody, ...overrides },
  });
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

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

describe("SignupSchema coren", () => {
  it("should accept a numeric COREN with a valid state", () => {
    expect(signupErrors({})).toEqual([]);
  });

  it("should reject a COREN with anything other than digits", () => {
    expect(signupErrors({ coren: "123.456" })).toEqual([
      "O COREN deve conter apenas números",
    ]);
    expect(signupErrors({ coren: "123456-ENF" })).toEqual([
      "O COREN deve conter apenas números",
    ]);
    expect(signupErrors({ coren: "" })).toEqual([
      "O COREN deve conter apenas números",
    ]);
  });

  it("should reject a missing COREN", () => {
    expect(signupErrors({ coren: undefined })).toEqual([
      "O COREN é obrigatório",
    ]);
  });

  it("should reject an unknown state", () => {
    expect(signupErrors({ corenState: "XX" })).toEqual([
      "UF do COREN inválida",
    ]);
    expect(signupErrors({ corenState: undefined })).toEqual([
      "UF do COREN inválida",
    ]);
  });
});

describe("SignupSchema acceptedTermsVersion", () => {
  it("should require the acceptance of the terms", () => {
    expect(signupErrors({ acceptedTermsVersion: undefined })).toEqual([
      "É preciso aceitar os termos de uso",
    ]);
  });

  it("should reject an outdated version of the terms", () => {
    expect(signupErrors({ acceptedTermsVersion: "2020-01-01" })).toEqual([
      "Os termos de uso foram atualizados. Recarregue a página e aceite a versão atual.",
    ]);
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
