import z from "zod";

export const RECORD_CONTENT_MAX_LENGTH = 20_000;

const patientParamsSchema = z.object({
  id: z.uuid("ID de paciente inválido"),
});

export const CreateRecordSchema = z.object({
  params: patientParamsSchema,
  body: z.object({
    content: z
      .string("Conteúdo do registro inválido")
      .trim()
      .nonempty("O conteúdo do registro é obrigatório")
      .max(
        RECORD_CONTENT_MAX_LENGTH,
        `O conteúdo do registro deve ter no máximo ${RECORD_CONTENT_MAX_LENGTH} caracteres`,
      ),
  }),
});
