import z from "zod";
import { MessageCode, messages } from "../shared/messages.js";

export const apiSchemas = z.registry<{ id: string }>();

export const component = <T extends z.ZodType>(id: string, schema: T) => {
  apiSchemas.add(schema, { id });
  return schema;
};

export interface ApiResponse {
  description: string;
  schema?: z.ZodType;
  headers?: Record<string, { description: string; schema: object }>;
}

export interface ApiOperation {
  method: "get" | "post" | "put" | "delete";
  path: string;
  tag: string;
  summary: string;
  description?: string;
  request?: z.ZodObject;
  authenticated?: boolean;
  rateLimited?: boolean;
  responses: Record<number, ApiResponse>;
}

const codeSchema = z
  .enum(Object.keys(messages) as [MessageCode, ...MessageCode[]])
  .meta({
    description:
      "Identificador estável do erro. Use-o para decidir o que fazer; a `message` é o texto para o usuário e pode mudar.",
  });

export const ErrorSchema = component(
  "Error",
  z.object({
    code: codeSchema,
    message: z.string(),
    timestamp: z.iso.datetime(),
  }),
);

export const ValidationErrorSchema = component(
  "ValidationError",
  z.object({
    code: codeSchema,
    message: z.string(),
    errors: z.array(
      z.object({
        location: z.enum(["body", "query", "params"]),
        path: z.string().meta({
          description:
            "Caminho do campo dentro de `location`, separado por pontos (ex.: `representativeName`, `items.0.name`). Vazio quando o erro é do objeto inteiro.",
        }),
        message: z.string(),
      }),
    ),
    timestamp: z.iso.datetime(),
  }),
);

export const MessageSchema = component(
  "Message",
  z.object({
    code: codeSchema,
    message: z.string(),
  }),
);

export const errorResponse = (description: string): ApiResponse => ({
  description,
  schema: ErrorSchema,
});

export const validationErrorResponse = (description: string): ApiResponse => ({
  description,
  schema: ValidationErrorSchema,
});

export const emptyResponse = (description: string): ApiResponse => ({
  description,
});

export const authorSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  coren: z.string(),
  corenState: z.string().meta({ description: "UF do COREN" }),
});
