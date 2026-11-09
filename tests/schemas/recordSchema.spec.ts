import { describe, expect, it } from "vitest";

import {
  CreateRecordSchema,
  ListRecordsQuerySchema,
  ListRecordVersionsSchema,
  UpdateRecordSchema,
  VoidRecordSchema,
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
    [{}, "Informe o conteúdo do registro ou ao menos um anexo"],
    [
      { attachmentIds: [] },
      "Informe o conteúdo do registro ou ao menos um anexo",
    ],
    [{ attachmentIds: ["123"] }, "ID de anexo inválido"],
    [
      {
        attachmentIds: [
          "0190a3b8-6f5e-7000-8000-000000000000",
          "0190a3b8-6f5e-7000-8000-000000000000",
        ],
      },
      "A lista de anexos tem itens repetidos",
    ],
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

const voidErrors = (body: unknown) => {
  const result = VoidRecordSchema.safeParse({ params: recordParams, body });
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("VoidRecordSchema", () => {
  it.each([
    [{ reason: "wrong_patient" }],
    [{ reason: "duplicate" }],
    [{ reason: "duplicate", details: "Registrado duas vezes" }],
    [{ reason: "other", details: "Registro de teste" }],
  ])("should accept %o", (body) => {
    expect(voidErrors(body)).toEqual([]);
  });

  it.each([
    [{}, "Motivo da anulação inválido"],
    [{ reason: "mistake" }, "Motivo da anulação inválido"],
    [{ reason: "other" }, "Descreva o motivo da anulação"],
    [
      { reason: "other", details: "   " },
      "A descrição do motivo não pode ficar em branco",
    ],
    [
      { reason: "duplicate", details: "a".repeat(501) },
      "A descrição do motivo deve ter no máximo 500 caracteres",
    ],
  ])("should reject %o", (body, message) => {
    expect(voidErrors(body)).toContain(message);
  });
});

describe("ListRecordsQuerySchema", () => {
  it("should apply the defaults", () => {
    expect(ListRecordsQuerySchema.parse({})).toEqual({
      status: "active",
      limit: 20,
    });
  });

  it("should accept a status, a cursor and a limit from the query string", () => {
    expect(
      ListRecordsQuerySchema.parse({
        status: "voided",
        cursor: recordParams.recordId,
        limit: "50",
      }),
    ).toEqual({ status: "voided", cursor: recordParams.recordId, limit: 50 });
  });

  it.each([
    [{ status: "deleted" }, "Status inválido"],
    [{ cursor: "abc" }, "Cursor inválido"],
    [{ limit: "0" }, "O limite deve ser entre 1 e 100"],
    [{ limit: "101" }, "O limite deve ser entre 1 e 100"],
    [{ limit: "1.5" }, "Limite inválido"],
  ])("should reject %o", (query, message) => {
    const result = ListRecordsQuerySchema.safeParse(query);
    expect(
      result.success ? [] : result.error.issues.map((i) => i.message),
    ).toEqual([message]);
  });
});
