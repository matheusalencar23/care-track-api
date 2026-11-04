import z from "zod";
import {
  ApiOperation,
  authorSchema,
  component,
  errorResponse,
  validationErrorResponse,
} from "../../docs/apiDocs.js";
import { RECORD_VOID_REASONS } from "./record.model.js";
import {
  CreateRecordSchema,
  ListRecordsSchema,
  ListRecordVersionsSchema,
  UpdateRecordSchema,
  VoidRecordSchema,
} from "./record.schema.js";

const RecordSchema = component(
  "Record",
  z.object({
    id: z.uuid(),
    patientId: z.uuid(),
    content: z.string().nullable(),
    version: z.int().meta({ description: "Número da versão atual" }),
    author: authorSchema.meta({
      description: "Autor da versão atual, como era na data da gravação",
    }),
    createdAt: z.iso.datetime(),
    editedAt: z.iso
      .datetime()
      .nullable()
      .meta({ description: "Horário da última edição; nulo se nunca editado" }),
    voidedAt: z.iso.datetime().nullable(),
    voidReason: z.enum(RECORD_VOID_REASONS).nullable(),
    voidReasonDetails: z.string().nullable(),
  }),
);

const RecordPageSchema = component(
  "RecordPage",
  z.object({
    items: z.array(RecordSchema),
    nextCursor: z
      .uuid()
      .nullable()
      .meta({ description: "Valor do `cursor` da próxima página; nulo no fim" }),
  }),
);

const RecordVersionSchema = component(
  "RecordVersion",
  z.object({
    version: z.int(),
    content: z.string().nullable(),
    reason: z.string().nullable(),
    author: authorSchema,
    createdAt: z.iso.datetime(),
  }),
);

const RecordVersionListSchema = component(
  "RecordVersionList",
  z.array(RecordVersionSchema),
);

const patientNotFound = errorResponse("Paciente não encontrado.");
const recordNotFound = errorResponse("Paciente ou registro não encontrado.");

export const recordOperations: ApiOperation[] = [
  {
    method: "post",
    path: "/patients/:id/records",
    tag: "Registros",
    summary: "Cria um registro na linha do tempo",
    description:
      "O autor (nome, COREN e UF) e o horário são definidos pelo servidor.",
    authenticated: true,
    request: CreateRecordSchema,
    responses: {
      201: { description: "Registro criado.", schema: RecordSchema },
      404: patientNotFound,
      409: errorResponse("Paciente arquivado."),
    },
  },
  {
    method: "get",
    path: "/patients/:id/records",
    tag: "Registros",
    summary: "Linha do tempo do paciente",
    description:
      "Versão atual de cada registro, do mais novo para o mais antigo, com paginação por cursor: envie o `nextCursor` da resposta como `cursor` para buscar a próxima página. Os anulados só aparecem com `status=voided`.",
    authenticated: true,
    request: ListRecordsSchema,
    responses: {
      200: { description: "Página da linha do tempo.", schema: RecordPageSchema },
      404: patientNotFound,
    },
  },
  {
    method: "put",
    path: "/patients/:id/records/:recordId",
    tag: "Registros",
    summary: "Edita um registro",
    description:
      "Cria uma nova versão; as anteriores continuam consultáveis. `version` é a versão que está sendo editada: se outra edição chegou antes, responde 409 e o registro deve ser recarregado.",
    authenticated: true,
    request: UpdateRecordSchema,
    responses: {
      200: { description: "Registro editado.", schema: RecordSchema },
      404: recordNotFound,
      409: errorResponse(
        "Paciente arquivado, registro anulado ou versão desatualizada.",
      ),
      422: validationErrorResponse(
        "Dados inválidos, ou conteúdo igual ao da versão atual.",
      ),
    },
  },
  {
    method: "get",
    path: "/patients/:id/records/:recordId/versions",
    tag: "Registros",
    summary: "Histórico de versões de um registro",
    description: "Da versão mais nova para a mais antiga.",
    authenticated: true,
    request: ListRecordVersionsSchema,
    responses: {
      200: { description: "Versões.", schema: RecordVersionListSchema },
      404: recordNotFound,
    },
  },
  {
    method: "post",
    path: "/patients/:id/records/:recordId/void",
    tag: "Registros",
    summary: "Anula um registro",
    description:
      "A anulação é definitiva: o registro sai da linha do tempo, mas continua guardado e não aceita novas versões. `details` é obrigatório quando `reason` é `other`.",
    authenticated: true,
    request: VoidRecordSchema,
    responses: {
      200: { description: "Registro anulado.", schema: RecordSchema },
      404: recordNotFound,
      409: errorResponse("Paciente arquivado ou registro já anulado."),
    },
  },
];
