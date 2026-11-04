import z from "zod";
import { ApiOperation, component } from "./apiDocs.js";

const HealthSchema = component(
  "Health",
  z.object({
    status: z.enum(["ok", "degraded"]),
    db: z.enum(["connected", "disconnected"]),
    version: z.string(),
  }),
);

export const healthOperations: ApiOperation[] = [
  {
    method: "get",
    path: "/health",
    tag: "Saúde",
    summary: "Estado da API",
    rateLimited: false,
    responses: {
      200: { description: "API e banco disponíveis.", schema: HealthSchema },
      503: { description: "Banco indisponível.", schema: HealthSchema },
    },
  },
];
