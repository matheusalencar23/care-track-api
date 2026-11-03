import z from "zod";
import {
  CONSENT_GRANTORS,
  CONSENT_METHODS,
  CONSENT_TYPES,
} from "./consent.model.js";

const idSchema = (message: string) => z.uuid(message);

const patientParamsSchema = z.object({
  id: idSchema("ID de paciente inválido"),
});

const consentBodySchema = z
  .object({
    type: z.enum(CONSENT_TYPES, "Tipo de consentimento inválido"),
    method: z.enum(CONSENT_METHODS, "Forma de coleta inválida"),
    grantor: z.enum(
      CONSENT_GRANTORS,
      "Responsável pelo consentimento inválido",
    ),
    representativeName: z
      .string("Nome do responsável legal inválido")
      .trim()
      .nonempty("O nome do responsável legal é obrigatório")
      .max(200, "O nome do responsável legal deve ter no máximo 200 caracteres")
      .optional(),
    collectedAt: z.iso
      .datetime({
        error: "Data da coleta inválida",
        offset: true,
        abort: true,
      })
      .refine(
        (date) => new Date(date) <= new Date(),
        "A data da coleta não pode estar no futuro",
      )
      .optional(),
  })
  .refine(
    (body) =>
      body.grantor !== "legal_representative" ||
      body.representativeName !== undefined,
    {
      message: "O nome do responsável legal é obrigatório",
      path: ["representativeName"],
    },
  )
  .refine(
    (body) =>
      body.grantor !== "patient" || body.representativeName === undefined,
    {
      message:
        "O nome do responsável legal só deve ser informado quando ele consente",
      path: ["representativeName"],
    },
  );

export type ConsentData = z.infer<typeof consentBodySchema>;

export const GrantConsentSchema = z.object({
  params: patientParamsSchema,
  body: consentBodySchema,
});

export const ListConsentsSchema = z.object({
  params: patientParamsSchema,
});

export const RevokeConsentSchema = z.object({
  params: patientParamsSchema.extend({
    consentId: idSchema("ID de consentimento inválido"),
  }),
  body: z
    .object({
      reason: z
        .string("Motivo inválido")
        .trim()
        .max(500, "O motivo deve ter no máximo 500 caracteres")
        .optional(),
    })
    .optional(),
});
