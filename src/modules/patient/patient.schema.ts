import z from "zod";
import { isValidCpf } from "../../utils/document.utils.js";

const MIN_BIRTH_DATE = "1900-01-01";

const today = () => new Date().toISOString().slice(0, 10);

const patientBodySchema = z.object({
  name: z
    .string("O nome é obrigatório")
    .trim()
    .nonempty("O nome é obrigatório")
    .max(200, "O nome deve ter no máximo 200 caracteres"),
  birthDate: z.iso
    .date({ error: "Data de nascimento inválida", abort: true })
    .refine((date) => date >= MIN_BIRTH_DATE, "Data de nascimento inválida")
    .refine(
      (date) => date <= today(),
      "A data de nascimento não pode estar no futuro",
    ),
  cpf: z.string("CPF inválido").refine(isValidCpf, "CPF inválido").optional(),
  cns: z
    .string("Cartão SUS inválido")
    .regex(/^\d{15}$/, "O Cartão SUS deve conter 15 números")
    .optional(),
  phone: z
    .string("Telefone inválido")
    .regex(/^\d{10,11}$/, "O telefone deve conter DDD e apenas números")
    .optional(),
});

export type PatientData = z.infer<typeof patientBodySchema>;

const patientParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{24}$/i, "ID de paciente inválido"),
});

export const ListPatientsQuerySchema = z.object({
  search: z
    .string("Busca inválida")
    .trim()
    .max(100, "A busca deve ter no máximo 100 caracteres")
    .optional(),
  status: z.enum(["active", "archived"], "Status inválido").default("active"),
  page: z.coerce
    .number("Página inválida")
    .int("Página inválida")
    .min(1, "Página inválida")
    .default(1),
  limit: z.coerce
    .number("Limite inválido")
    .int("Limite inválido")
    .min(1, "O limite deve ser entre 1 e 100")
    .max(100, "O limite deve ser entre 1 e 100")
    .default(20),
});

export type ListPatientsQuery = z.infer<typeof ListPatientsQuerySchema>;

export const CreatePatientSchema = z.object({
  body: patientBodySchema,
});

export const ListPatientsSchema = z.object({
  query: ListPatientsQuerySchema,
});

export const GetPatientSchema = z.object({
  params: patientParamsSchema,
});

export const ArchivePatientSchema = z.object({
  params: patientParamsSchema,
});

export const UpdatePatientSchema = z.object({
  params: patientParamsSchema,
  body: patientBodySchema,
});
