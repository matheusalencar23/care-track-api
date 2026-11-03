import { describe, expect, it } from "vitest";

import { CreateRecordSchema } from "../../src/modules/record/record.schema.js";

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
