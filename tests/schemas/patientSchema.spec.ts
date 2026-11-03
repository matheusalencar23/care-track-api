import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CreatePatientSchema,
  ListPatientsQuerySchema,
} from "../../src/modules/patient/patient.schema.js";

const patientBody = {
  name: "José da Silva",
  birthDate: "1950-03-15",
};

const createErrors = (overrides: Record<string, unknown>) => {
  const result = CreatePatientSchema.safeParse({
    body: { ...patientBody, ...overrides },
  });
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("CreatePatientSchema", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should accept only the required fields", () => {
    expect(createErrors({})).toEqual([]);
  });

  it("should accept all the optional fields", () => {
    expect(
      createErrors({
        cpf: "52998224725",
        cns: "898001160660004",
        phone: "1133334444",
      }),
    ).toEqual([]);
  });

  it("should reject a blank name", () => {
    expect(createErrors({ name: "   " })).toEqual(["O nome é obrigatório"]);
  });

  it("should reject a missing name", () => {
    expect(createErrors({ name: undefined })).toEqual(["O nome é obrigatório"]);
  });

  it("should reject a birth date that is not an ISO date", () => {
    expect(createErrors({ birthDate: "15/03/1950" })).toEqual([
      "Data de nascimento inválida",
    ]);
  });

  it("should reject a birth date in the future", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T12:00:00.000Z") });

    expect(createErrors({ birthDate: "2026-11-02" })).toEqual([]);
    expect(createErrors({ birthDate: "2026-11-03" })).toEqual([
      "A data de nascimento não pode estar no futuro",
    ]);
  });

  it("should reject a birth date before 1900", () => {
    expect(createErrors({ birthDate: "1899-12-31" })).toEqual([
      "Data de nascimento inválida",
    ]);
  });

  it.each(["52998224724", "11111111111", "529.982.247-25", "5299822472"])(
    "should reject the invalid CPF %s",
    (cpf) => {
      expect(createErrors({ cpf })).toEqual(["CPF inválido"]);
    },
  );

  it("should reject a CNS without 15 digits", () => {
    expect(createErrors({ cns: "89800116066000" })).toEqual([
      "O Cartão SUS deve conter 15 números",
    ]);
  });

  it("should reject a phone without the area code", () => {
    expect(createErrors({ phone: "987654321" })).toEqual([
      "O telefone deve conter DDD e apenas números",
    ]);
  });
});

describe("ListPatientsQuerySchema", () => {
  it("should apply the default page and limit", () => {
    expect(ListPatientsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it("should coerce page and limit from the query string", () => {
    expect(ListPatientsQuerySchema.parse({ page: "3", limit: "50" })).toEqual({
      page: 3,
      limit: 50,
    });
  });

  it.each([
    { page: "0" },
    { page: "1.5" },
    { page: "abc" },
    { limit: "0" },
    { limit: "101" },
  ])("should reject %o", (query) => {
    expect(ListPatientsQuerySchema.safeParse(query).success).toBe(false);
  });

  it("should reject a repeated search parameter", () => {
    expect(
      ListPatientsQuerySchema.safeParse({ search: ["a", "b"] }).success,
    ).toBe(false);
  });
});
