import z from "zod";
import {
  ApiOperation,
  component,
  errorResponse,
  validationErrorResponse,
} from "../../docs/apiDocs.js";
import { ATTACHMENT_CONTENT_TYPES } from "./attachment.model.js";
import {
  DownloadAttachmentSchema,
  PatientParamsSchema,
} from "./attachment.schema.js";

const attachmentFields = z.object({
  id: z.uuid(),
  patientId: z.uuid(),
  recordId: z
    .uuid()
    .nullable()
    .meta({ description: "Nulo enquanto o anexo não entrou em um registro" }),
  fileName: z.string(),
  contentType: z.enum(ATTACHMENT_CONTENT_TYPES),
  size: z.int().meta({ description: "Tamanho em bytes do arquivo gravado" }),
  sha256: z.string().meta({ description: "Hash do arquivo gravado" }),
  createdAt: z.iso.datetime(),
});

export const AttachmentSchema = component("Attachment", attachmentFields);

const AttachmentDownloadSchema = component(
  "AttachmentDownload",
  attachmentFields.extend({
    downloadUrl: z.url().meta({ description: "URL assinada de curta duração" }),
    downloadUrlExpiresAt: z.iso.datetime(),
  }),
);

const notFound = errorResponse("Paciente ou anexo não encontrado.");

const UploadAttachmentSchema = z.object({
  params: PatientParamsSchema.shape.params,
  body: z.object({
    file: z.string().meta({
      format: "binary",
      description:
        "Arquivo. O tipo é detectado pelo conteúdo, e metadados de imagens (como GPS) são removidos antes de gravar.",
    }),
  }),
});

export const attachmentOperations: ApiOperation[] = [
  {
    method: "post",
    path: "/patients/:id/attachments",
    tag: "Anexos",
    summary: "Envia um anexo",
    description:
      "Grava o arquivo, ainda sem registro. Depois, informe o id em `attachmentIds` ao criar o registro. Fotos e vídeos (pelo tipo detectado) exigem um consentimento `image_capture` ativo e sem `needsRenewal`; PDFs não.",
    authenticated: true,
    request: UploadAttachmentSchema,
    multipart: true,
    responses: {
      201: { description: "Anexo gravado.", schema: AttachmentSchema },
      404: errorResponse("Paciente não encontrado."),
      409: errorResponse(
        "Paciente arquivado, ou foto ou vídeo sem consentimento de uso de imagem ativo (`ATTACHMENT_CONSENT_REQUIRED`).",
      ),
      413: errorResponse("Arquivo acima do tamanho máximo."),
      422: validationErrorResponse(
        "Arquivo ausente, nome inválido, tipo não permitido ou arquivo corrompido.",
      ),
    },
  },
  {
    method: "get",
    path: "/patients/:id/attachments/:attachmentId/download",
    tag: "Anexos",
    summary: "Gera a URL de download de um anexo",
    description:
      "A URL é assinada e de curta duração. Cada chamada é registrada na auditoria. Fotos e vídeos só são liberados com um consentimento `image_capture` ativo e sem `needsRenewal`; PDFs não dependem dele. Por padrão, a URL força o download (`Content-Disposition: attachment`); com `disposition=inline`, o navegador exibe o arquivo, para a pré-visualização de PDFs no front. O arquivo sempre volta com `Cache-Control: no-store`, para o navegador não gravá-lo no cache em disco.",
    authenticated: true,
    request: DownloadAttachmentSchema,
    responses: {
      200: {
        description: "URL de download.",
        schema: AttachmentDownloadSchema,
      },
      404: notFound,
      409: errorResponse(
        "Foto ou vídeo sem consentimento de uso de imagem ativo (`ATTACHMENT_CONSENT_REQUIRED`).",
      ),
      422: validationErrorResponse("ID inválido ou `disposition` inválida."),
    },
  },
];
