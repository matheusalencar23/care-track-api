import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GrantConsentSchema,
  RevokeConsentSchema,
} from "../../src/modules/consent/consent.schema.js";

const params = { id: "64b7f0c2a1b2c3d4e5f60718" };

const consentBody = {
  type: "image_capture",
  method: "written",
  grantor: "patient",
};

const grantErrors = (overrides: Record<string, unknown>) => {
  const result = GrantConsentSchema.safeParse({
    params,
    body: { ...consentBody, ...overrides },
  });
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("GrantConsentSchema", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should accept a consent given by the patient", () => {
    expect(grantErrors({})).toEqual([]);
  });

  it("should accept a consent given by a legal representative", () => {
    expect(
      grantErrors({
        grantor: "legal_representative",
        representativeName: "Ana Souza",
      }),
    ).toEqual([]);
  });

  it("should require the name of the legal representative", () => {
    expect(grantErrors({ grantor: "legal_representative" })).toEqual([
      "O nome do responsável legal é obrigatório",
    ]);
  });

  it("should reject a blank name of the legal representative", () => {
    expect(
      grantErrors({
        grantor: "legal_representative",
        representativeName: "  ",
      }),
    ).toContain("O nome do responsável legal é obrigatório");
  });

  it("should reject a representative name when the patient consents", () => {
    expect(grantErrors({ representativeName: "Ana Souza" })).toEqual([
      "O nome do responsável legal só deve ser informado quando ele consente",
    ]);
  });

  it.each([
    [{ type: "publication" }, "Tipo de consentimento inválido"],
    [{ method: "email" }, "Forma de coleta inválida"],
    [{ grantor: "neighbor" }, "Responsável pelo consentimento inválido"],
  ])("should reject %o", (overrides, message) => {
    expect(grantErrors(overrides)).toEqual([message]);
  });

  it("should accept a collection date with offset", () => {
    expect(grantErrors({ collectedAt: "2026-01-10T14:30:00-03:00" })).toEqual(
      [],
    );
  });

  it("should reject a collection date that is not an ISO datetime", () => {
    expect(grantErrors({ collectedAt: "10/01/2026" })).toEqual([
      "Data da coleta inválida",
    ]);
  });

  it("should reject a collection date in the future", () => {
    vi.useFakeTimers({ now: new Date("2026-11-03T12:00:00.000Z") });

    expect(grantErrors({ collectedAt: "2026-11-03T12:00:00Z" })).toEqual([]);
    expect(grantErrors({ collectedAt: "2026-11-03T12:00:01Z" })).toEqual([
      "A data da coleta não pode estar no futuro",
    ]);
  });

  it("should reject an invalid patient id", () => {
    const result = GrantConsentSchema.safeParse({
      params: { id: "abc" },
      body: consentBody,
    });

    expect(result.success).toBe(false);
  });
});

describe("RevokeConsentSchema", () => {
  const revokeParams = { ...params, consentId: "64b7f0c2a1b2c3d4e5f60719" };

  it("should accept a revocation without body", () => {
    expect(
      RevokeConsentSchema.safeParse({ params: revokeParams }).success,
    ).toBe(true);
  });

  it("should accept a revocation with a reason", () => {
    expect(
      RevokeConsentSchema.safeParse({
        params: revokeParams,
        body: { reason: "Paciente pediu" },
      }).success,
    ).toBe(true);
  });

  it("should reject a reason longer than 500 characters", () => {
    expect(
      RevokeConsentSchema.safeParse({
        params: revokeParams,
        body: { reason: "a".repeat(501) },
      }).success,
    ).toBe(false);
  });

  it("should reject an invalid consent id", () => {
    expect(
      RevokeConsentSchema.safeParse({
        params: { ...params, consentId: "abc" },
      }).success,
    ).toBe(false);
  });
});
