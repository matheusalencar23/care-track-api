import z from "zod";
import {
  ApiOperation,
  component,
  errorResponse,
  validationErrorResponse,
} from "../../docs/apiDocs.js";
import { ATTACHMENT_CONTENT_TYPES } from "./attachment.model.js";
import {
  AttachmentParamsSchema,
  DownloadAttachmentSchema,
  GetThumbnailsSchema,
  ListAttachmentsSchema,
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

const AttachmentPageSchema = component(
  "AttachmentPage",
  z.object({
    items: z.array(AttachmentSchema),
    nextCursor: z.uuid().nullable().meta({
      description: "Valor do `cursor` da próxima página; nulo no fim",
    }),
  }),
);

const AttachmentDownloadSchema = component(
  "AttachmentDownload",
  attachmentFields.extend({
    downloadUrl: z.url().meta({ description: "URL assinada de curta duração" }),
    downloadUrlExpiresAt: z.iso.datetime(),
  }),
);

const AttachmentThumbnailSchema = component(
  "AttachmentThumbnail",
  z.object({
    attachmentId: z.uuid(),
    status: z.enum(["available", "consent_required", "unavailable"]).meta({
      description:
        "`available`: URL gerada. `consent_required`: há miniatura, mas falta um consentimento `image_capture` ativo e sem `needsRenewal`. `unavailable`: o anexo não tem miniatura (vídeo, PDF, imagem anterior às miniaturas ou falha na geração); o front mostra o ícone.",
    }),
    thumbnailUrl: z.url().nullable().meta({
      description: "URL assinada de curta duração; nula fora de `available`",
    }),
    thumbnailUrlExpiresAt: z.iso.datetime().nullable(),
  }),
);

const AttachmentThumbnailsSchema = component(
  "AttachmentThumbnails",
  z.object({ items: z.array(AttachmentThumbnailSchema) }),
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
    path: "/patients/:id/attachments",
    tag: "Anexos",
    summary: "Lista os anexos do paciente",
    description:
      "Só os anexos já ligados a registros, do mais novo para o mais antigo (pelo horário do envio), com paginação por cursor: envie o `nextCursor` da resposta como `cursor` para buscar a próxima página. Como na linha do tempo, os anexos de registros anulados só aparecem com `status=voided`. Devolve só os metadados, sem URL: para abrir o arquivo, use a rota de download. A consulta é registrada na auditoria.",
    authenticated: true,
    request: ListAttachmentsSchema,
    responses: {
      200: { description: "Página de anexos.", schema: AttachmentPageSchema },
      404: errorResponse("Paciente não encontrado."),
    },
  },
  {
    method: "post",
    path: "/patients/:id/attachments/thumbnails",
    tag: "Anexos",
    summary: "Gera as URLs das miniaturas de vários anexos",
    description:
      "Para o carrossel e a linha do tempo: até 20 anexos por chamada, devolvidos na ordem pedida. Só imagens têm miniatura (WebP, até 320 px no lado maior, sem metadados). A miniatura também é imagem do paciente: sem consentimento `image_capture` ativo e sem `needsRenewal`, nenhuma URL é gerada e o item volta com `consent_required`, sem falhar a chamada. Cada miniatura liberada é registrada na auditoria. As URLs têm a mesma validade curta do download e voltam com `Cache-Control: no-store`.",
    authenticated: true,
    request: GetThumbnailsSchema,
    responses: {
      200: {
        description: "Situação e URL de cada miniatura.",
        schema: AttachmentThumbnailsSchema,
      },
      404: errorResponse("Paciente ou algum dos anexos não encontrado."),
      422: validationErrorResponse(
        "Lista vazia, com mais de 20 itens, com itens repetidos ou IDs inválidos.",
      ),
    },
  },
  {
    method: "post",
    path: "/patients/:id/attachments/:attachmentId/thumbnail",
    tag: "Anexos",
    summary: "Tenta gerar a miniatura de uma imagem",
    description:
      "Para imagens com `unavailable` (enviadas antes das miniaturas ou cuja geração falhou no upload): gera a miniatura a partir do arquivo gravado e devolve a situação no mesmo formato da rota de miniaturas. Se a imagem já tem miniatura, não gera outra. Se a geração falhar de novo, volta `unavailable`. Cada tentativa é registrada na auditoria (`attachment.thumbnail_generate`), e a URL liberada também (`attachment.thumbnail`), com a mesma regra de consentimento.",
    authenticated: true,
    request: AttachmentParamsSchema,
    responses: {
      200: {
        description: "Situação e URL da miniatura.",
        schema: AttachmentThumbnailSchema,
      },
      404: notFound,
      422: validationErrorResponse(
        "ID inválido, ou anexo que não é imagem (`ATTACHMENT_THUMBNAIL_NOT_SUPPORTED`).",
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
