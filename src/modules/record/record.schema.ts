import z from "zod";

export const RECORD_CONTENT_MAX_LENGTH = 20_000;
export const RECORD_REASON_MAX_LENGTH = 500;

const patientParamsSchema = z.object({
  id: z.uuid("ID de paciente inválido"),
});

const recordParamsSchema = patientParamsSchema.extend({
  recordId: z.uuid("ID de registro inválido"),
});

const contentSchema = z
  .string("Conteúdo do registro inválido")
  .trim()
  .nonempty("O conteúdo do registro é obrigatório")
  .max(
    RECORD_CONTENT_MAX_LENGTH,
    `O conteúdo do registro deve ter no máximo ${RECORD_CONTENT_MAX_LENGTH} caracteres`,
  );

export const CreateRecordSchema = z.object({
  params: patientParamsSchema,
  body: z.object({
    content: contentSchema,
  }),
});

export const UpdateRecordSchema = z.object({
  params: recordParamsSchema,
  body: z.object({
    content: contentSchema,
    version: z
      .number("Versão do registro inválida")
      .int("Versão do registro inválida")
      .positive("Versão do registro inválida"),
    reason: z
      .string("Motivo inválido")
      .trim()
      .nonempty("O motivo não pode ficar em branco")
      .max(
        RECORD_REASON_MAX_LENGTH,
        `O motivo deve ter no máximo ${RECORD_REASON_MAX_LENGTH} caracteres`,
      )
      .optional(),
  }),
});

export type UpdateRecordData = z.infer<typeof UpdateRecordSchema>["body"];

export const ListRecordVersionsSchema = z.object({
  params: recordParamsSchema,
});
