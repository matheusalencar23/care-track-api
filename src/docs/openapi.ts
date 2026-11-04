import z from "zod";
import { APP_VERSION } from "../config/appInfo.js";
import { authOperations } from "../modules/auth/auth.docs.js";
import { consentOperations } from "../modules/consent/consent.docs.js";
import { healthOperations } from "./health.docs.js";
import { patientOperations } from "../modules/patient/patient.docs.js";
import { recordOperations } from "../modules/record/record.docs.js";
import { userOperations } from "../modules/user/user.docs.js";
import {
  ApiOperation,
  ApiResponse,
  apiSchemas,
  errorResponse,
  MessageSchema,
  validationErrorResponse,
} from "./apiDocs.js";

type JsonSchema = Record<string, unknown>;

export const apiOperations: ApiOperation[] = [
  ...healthOperations,
  ...userOperations,
  ...authOperations,
  ...patientOperations,
  ...consentOperations,
  ...recordOperations,
];

const tags = [
  { name: "Saúde", description: "Estado da API e do banco." },
  {
    name: "Usuários",
    description: "Cadastro da enfermeira e confirmação do e-mail.",
  },
  {
    name: "Autenticação",
    description:
      "Login, sessão e recuperação de senha. A sessão é um cookie httpOnly `token` deslizante: cada requisição autenticada a renova, e ela expira após 30 minutos sem requisições ou 12 horas após o login. Toda resposta autenticada de sucesso traz o header `X-Session-Expires-At`.",
  },
  {
    name: "Pacientes",
    description:
      "Pacientes da enfermeira autenticada. Uma enfermeira nunca enxerga os pacientes de outra: o recurso de outra dona responde 404.",
  },
  { name: "Consentimentos", description: "Consentimentos do paciente." },
  {
    name: "Registros",
    description:
      "Linha do tempo do paciente. Registros são versionados e anulados, nunca excluídos.",
  },
];

const cleanSchema = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(cleanSchema);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value).filter(
    ([key]) =>
      key !== "$schema" &&
      key !== "$id" &&
      !(key === "pattern" && "format" in value),
  );

  return Object.fromEntries(
    entries.map(([key, entry]) => [key, cleanSchema(entry)]),
  );
};

const toJsonSchema = (schema: z.ZodType) =>
  cleanSchema(z.toJSONSchema(schema, { io: "input" })) as JsonSchema;

const buildComponents = () => {
  const { schemas } = z.toJSONSchema(apiSchemas, {
    io: "output",
    uri: (id) => `#/components/schemas/${id}`,
  });

  return cleanSchema(schemas) as Record<string, JsonSchema>;
};

const componentRef = (schema: z.ZodType) => {
  const id = apiSchemas.get(schema)?.id;

  if (!id) {
    throw new Error("Response schemas must be registered with component()");
  }

  return { $ref: `#/components/schemas/${id}` };
};

const toOpenApiPath = (path: string) => path.replace(/:(\w+)/g, "{$1}");

const requestPart = (request: z.ZodObject | undefined, part: string) =>
  request?.shape[part] as z.ZodType | undefined;

const buildParameters = (
  location: "path" | "query",
  schema: z.ZodType | undefined,
) => {
  if (!schema) {
    return [];
  }

  const json = toJsonSchema(schema);
  const properties = (json["properties"] ?? {}) as Record<string, JsonSchema>;
  const required = (json["required"] ?? []) as string[];

  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: location,
    required: location === "path" || required.includes(name),
    schema: property,
  }));
};

const buildRequestBody = (schema: z.ZodType | undefined) => {
  if (!schema) {
    return undefined;
  }

  return {
    required: !schema.safeParse(undefined).success,
    content: { "application/json": { schema: toJsonSchema(schema) } },
  };
};

const defaultResponses = (
  operation: ApiOperation,
): Record<number, ApiResponse> => ({
  ...(operation.request && {
    422: validationErrorResponse("Dados inválidos."),
  }),
  ...(operation.authenticated && {
    401: errorResponse("Sessão ausente, inválida ou expirada."),
  }),
  ...(operation.rateLimited !== false && {
    429: {
      description: "Limite de requisições atingido.",
      schema: MessageSchema,
    },
  }),
  500: { description: "Erro inesperado.", schema: MessageSchema },
});

const sessionHeaders = {
  "X-Session-Expires-At": {
    description:
      "Expiração da sessão, já renovada por esta requisição (ISO 8601).",
    schema: { type: "string", format: "date-time" },
  },
};

const withSessionHeaders = (
  operation: ApiOperation,
  status: string,
  response: ApiResponse,
) => {
  const isSuccess = Number(status) >= 200 && Number(status) < 300;
  const hasSession =
    operation.authenticated || operation.path === "/auth/signin";

  if (!isSuccess || !hasSession || operation.path === "/auth/signout") {
    return response.headers;
  }

  return { ...response.headers, ...sessionHeaders };
};

const buildResponses = (operation: ApiOperation) => {
  const responses = { ...defaultResponses(operation), ...operation.responses };

  return Object.fromEntries(
    Object.entries(responses)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([status, response]) => {
        const headers = withSessionHeaders(operation, status, response);
        return [
          status,
          {
            description: response.description,
            ...(headers && { headers }),
            ...(response.schema && {
              content: {
                "application/json": { schema: componentRef(response.schema) },
              },
            }),
          },
        ];
      }),
  );
};

const buildOperation = (operation: ApiOperation) => {
  const requestBody = buildRequestBody(requestPart(operation.request, "body"));
  const parameters = [
    ...buildParameters("path", requestPart(operation.request, "params")),
    ...buildParameters("query", requestPart(operation.request, "query")),
  ];

  return {
    tags: [operation.tag],
    summary: operation.summary,
    ...(operation.description && { description: operation.description }),
    ...(operation.authenticated && { security: [{ cookieAuth: [] }] }),
    ...(parameters.length > 0 && { parameters }),
    ...(requestBody && { requestBody }),
    responses: buildResponses(operation),
  };
};

const buildPaths = () => {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const operation of apiOperations) {
    const path = toOpenApiPath(operation.path);
    paths[path] = {
      ...paths[path],
      [operation.method]: buildOperation(operation),
    };
  }

  return paths;
};

export const buildOpenApiDocument = () => ({
  openapi: "3.1.0",
  info: {
    title: "Care Track API",
    version: APP_VERSION,
    description:
      "API do prontuário de enfermagem eletrônico Care Track. As mensagens de erro vêm em português, prontas para exibir ao usuário.",
  },
  servers: [{ url: "/api/v1" }],
  tags,
  paths: buildPaths(),
  components: {
    schemas: buildComponents(),
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "token",
        description:
          "JWT gravado pelo `POST /auth/signin` num cookie httpOnly. No Swagger UI, faça o login pela própria rota: o navegador envia o cookie nas chamadas seguintes.",
      },
    },
  },
});
