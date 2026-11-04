import z from "zod";
import {
  ApiOperation,
  component,
  errorResponse,
  validationErrorResponse,
} from "../../docs/apiDocs.js";
import {
  CONSENT_GRANTORS,
  CONSENT_METHODS,
  CONSENT_STATUSES,
  CONSENT_TYPES,
} from "./consent.model.js";
import {
  GrantConsentSchema,
  ListConsentsSchema,
  RevokeConsentSchema,
} from "./consent.schema.js";

const ConsentSchema = component(
  "Consent",
  z.object({
    id: z.uuid(),
    patientId: z.uuid(),
    type: z.enum(CONSENT_TYPES),
    method: z.enum(CONSENT_METHODS),
    grantor: z.enum(CONSENT_GRANTORS),
    representativeName: z.string().nullable(),
    collectedAt: z.iso.datetime(),
    status: z.enum(CONSENT_STATUSES),
    revokedAt: z.iso.datetime().nullable(),
    revocationReason: z.string().nullable(),
    createdAt: z.iso.datetime(),
  }),
);

const ConsentListSchema = component("ConsentList", z.array(ConsentSchema));

const patientNotFound = errorResponse("Paciente não encontrado.");

export const consentOperations: ApiOperation[] = [
  {
    method: "post",
    path: "/patients/:id/consents",
    tag: "Consentimentos",
    summary: "Registra um consentimento",
    description:
      "O `representativeName` é obrigatório quando quem consente é o responsável legal, e proibido quando é o próprio paciente. Paciente menor de idade na data da coleta exige o responsável legal. Sem `collectedAt`, vale o horário do servidor.",
    authenticated: true,
    request: GrantConsentSchema,
    responses: {
      201: { description: "Consentimento registrado.", schema: ConsentSchema },
      404: patientNotFound,
      409: errorResponse(
        "Paciente arquivado, ou já existe um consentimento ativo do mesmo tipo.",
      ),
      422: validationErrorResponse(
        "Dados inválidos, ou paciente menor de idade consentindo sem o responsável legal.",
      ),
    },
  },
  {
    method: "get",
    path: "/patients/:id/consents",
    tag: "Consentimentos",
    summary: "Lista os consentimentos do paciente",
    description: "Do mais novo para o mais antigo, incluindo os revogados.",
    authenticated: true,
    request: ListConsentsSchema,
    responses: {
      200: { description: "Consentimentos.", schema: ConsentListSchema },
      404: patientNotFound,
    },
  },
  {
    method: "post",
    path: "/patients/:id/consents/:consentId/revoke",
    tag: "Consentimentos",
    summary: "Revoga um consentimento",
    authenticated: true,
    request: RevokeConsentSchema,
    responses: {
      200: { description: "Consentimento revogado.", schema: ConsentSchema },
      404: errorResponse("Paciente ou consentimento não encontrado."),
      409: errorResponse("O consentimento já foi revogado."),
    },
  },
];
