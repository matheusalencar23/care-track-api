import z from "zod";

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

export const ErrorSchema = component(
  "Error",
  z.object({
    message: z.string(),
    timestamp: z.iso.datetime(),
  }),
);

export const ValidationErrorSchema = component(
  "ValidationError",
  z.object({
    message: z.string(),
    errors: z.array(z.string()),
    timestamp: z.iso.datetime(),
  }),
);

export const MessageSchema = component(
  "Message",
  z.object({
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
