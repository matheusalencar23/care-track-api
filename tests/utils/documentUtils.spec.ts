import { describe, expect, it } from "vitest";

import { isValidCpf } from "../../src/utils/document.utils.js";

describe("isValidCpf", () => {
  it.each(["52998224725", "11144477735", "00000000191"])(
    "should accept the valid CPF %s",
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
    },
  );

  it.each([
    "52998224724",
    "52998224735",
    "00000000000",
    "99999999999",
    "5299822472",
    "529982247250",
    "529.982.247-25",
    "",
  ])("should reject the invalid CPF %s", (cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });
});
