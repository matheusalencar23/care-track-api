import { describe, expect, it } from "vitest";

import {
  CreateRecordSchema,
  ListRecordVersionsSchema,
  UpdateRecordSchema,
} from "../../src/modules/record/record.schema.js";

const params = { id: "0195f3a2-7c4e-7b1a-9d2e-3f4a5b6c7d8e" };

const createErrors = (body: unknown, overrides: object = {}) => {
  const result = CreateRecordSchema.safeParse({
    params: { ...params, ...overrides },
    body,
  });
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("CreateRecordSchema", () => {
  it("should accept a record with text", () => {
    expect(createErrors({ content: "Paciente estável.\nPA 120x80." })).toEqual(
      [],
    );
  });

  it("should accept a record with the maximum length", () => {
    expect(createErrors({ content: "a".repeat(20_000) })).toEqual([]);
  });

  it.each([
    [{}, "Conteúdo do registro inválido"],
    [{ content: 123 }, "Conteúdo do registro inválido"],
    [{ content: "" }, "O conteúdo do registro é obrigatório"],
    [{ content: "  \n " }, "O conteúdo do registro é obrigatório"],
    [
      { content: "a".repeat(20_001) },
      "O conteúdo do registro deve ter no máximo 20000 caracteres",
    ],
  ])("should reject the body %o", (body, message) => {
    expect(createErrors(body)).toEqual([message]);
  });

  it("should reject an invalid patient id", () => {
    expect(createErrors({ content: "Texto" }, { id: "123" })).toEqual([
      "ID de paciente inválido",
    ]);
  });
});

const recordParams = {
  ...params,
  recordId: "0195f3a2-7c4e-7b1a-9d2e-3f4a5b6c7d8f",
};

const updateErrors = (body: unknown, overrides: object = {}) => {
  const result = UpdateRecordSchema.safeParse({
    params: { ...recordParams, ...overrides },
    body,
  });
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("UpdateRecordSchema", () => {
  it("should accept an edit with or without a reason", () => {
    expect(updateErrors({ content: "Novo texto", version: 1 })).toEqual([]);
    expect(
      updateErrors({ content: "Novo texto", version: 2, reason: "Correção" }),
    ).toEqual([]);
  });

  it.each([
    [{ content: "Novo texto" }, "Versão do registro inválida"],
    [{ content: "Novo texto", version: "1" }, "Versão do registro inválida"],
    [{ content: "Novo texto", version: 0 }, "Versão do registro inválida"],
    [{ content: "Novo texto", version: 1.5 }, "Versão do registro inválida"],
    [{ content: " ", version: 1 }, "O conteúdo do registro é obrigatório"],
    [
      { content: "Novo texto", version: 1, reason: "  " },
      "O motivo não pode ficar em branco",
    ],
    [
      { content: "Novo texto", version: 1, reason: "a".repeat(501) },
      "O motivo deve ter no máximo 500 caracteres",
    ],
  ])("should reject the body %o", (body, message) => {
    expect(updateErrors(body)).toEqual([message]);
  });

  it("should reject an invalid record id", () => {
    expect(
      updateErrors({ content: "Novo texto", version: 1 }, { recordId: "1" }),
    ).toEqual(["ID de registro inválido"]);
  });
});

describe("ListRecordVersionsSchema", () => {
  it("should validate the patient and record ids", () => {
    expect(
      ListRecordVersionsSchema.safeParse({ params: recordParams }).success,
    ).toBe(true);
    expect(
      ListRecordVersionsSchema.safeParse({
        params: { ...recordParams, recordId: "1" },
      }).success,
    ).toBe(false);
  });
});
