import z from "zod";

export const ATTACHMENT_FILE_NAME_MAX_LENGTH = 255;
export const RECORD_ATTACHMENTS_MAX = 20;

const attachmentIdSchema = z.uuid("ID de anexo inválido");

const patientParamsSchema = z.object({
  id: z.uuid("ID de paciente inválido"),
});

const attachmentParamsSchema = patientParamsSchema.extend({
  attachmentId: attachmentIdSchema,
});

export const attachmentIdsSchema = z
  .array(attachmentIdSchema, "Lista de anexos inválida")
  .max(
    RECORD_ATTACHMENTS_MAX,
    `Um registro pode ter no máximo ${RECORD_ATTACHMENTS_MAX} anexos`,
  )
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "A lista de anexos tem itens repetidos",
  });

export const PatientParamsSchema = z.object({
  params: patientParamsSchema,
});

export const CreateAttachmentSchema = z.object({
  params: patientParamsSchema,
  body: z.object({
    fileName: z
      .string("Nome do arquivo inválido")
      .trim()
      .nonempty("O nome do arquivo é obrigatório")
      .max(
        ATTACHMENT_FILE_NAME_MAX_LENGTH,
        `O nome do arquivo deve ter no máximo ${ATTACHMENT_FILE_NAME_MAX_LENGTH} caracteres`,
      )
      .refine((name) => !/\p{Cc}/u.test(name), "Nome do arquivo inválido"),
  }),
});

export const ATTACHMENT_DISPOSITIONS = ["attachment", "inline"] as const;

export type AttachmentDisposition = (typeof ATTACHMENT_DISPOSITIONS)[number];

export const AttachmentDownloadQuerySchema = z.object({
  disposition: z
    .enum(ATTACHMENT_DISPOSITIONS, "Forma de abertura inválida")
    .default("attachment"),
});

export const AttachmentParamsSchema = z.object({
  params: attachmentParamsSchema,
});

export const DownloadAttachmentSchema = AttachmentParamsSchema.extend({
  query: AttachmentDownloadQuerySchema,
});
