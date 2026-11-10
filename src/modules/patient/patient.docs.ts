import z from "zod";
import {
  ApiOperation,
  component,
  conflictErrorResponse,
  errorResponse,
} from "../../docs/apiDocs.js";
import {
  ArchivePatientSchema,
  CreatePatientSchema,
  GetPatientSchema,
  ListPatientsSchema,
  UpdatePatientSchema,
} from "./patient.schema.js";

const PatientSchema = component(
  "Patient",
  z.object({
    id: z.uuid(),
    name: z.string(),
    birthDate: z.iso.date(),
    cpf: z.string().nullable(),
    cns: z.string().nullable().meta({ description: "Cartão SUS" }),
    phone: z.string().nullable(),
    archivedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
);

const PatientPageSchema = component(
  "PatientPage",
  z.object({
    items: z.array(PatientSchema),
    page: z.int(),
    limit: z.int(),
    total: z.int(),
    totalPages: z.int(),
  }),
);

const notFound = errorResponse("Paciente não encontrado.");

export const patientOperations: ApiOperation[] = [
  {
    method: "post",
    path: "/patients",
    tag: "Pacientes",
    summary: "Cadastra um paciente",
    authenticated: true,
    request: CreatePatientSchema,
    responses: {
      201: { description: "Paciente cadastrado.", schema: PatientSchema },
      409: conflictErrorResponse(
        "Já existe um paciente desta enfermeira com o mesmo CPF (`PATIENT_CPF_ALREADY_EXISTS`, no campo `cpf`) ou Cartão SUS (`PATIENT_CNS_ALREADY_EXISTS`, no campo `cns`).",
      ),
    },
  },
  {
    method: "get",
    path: "/patients",
    tag: "Pacientes",
    summary: "Lista os pacientes",
    description:
      "Paginação por página, em ordem alfabética. A busca procura parte do nome (sem diferenciar acentos e maiúsculas) e, quando só tem números, também o CPF ou o Cartão SUS exatos.",
    authenticated: true,
    request: ListPatientsSchema,
    responses: {
      200: { description: "Página de pacientes.", schema: PatientPageSchema },
    },
  },
  {
    method: "get",
    path: "/patients/:id",
    tag: "Pacientes",
    summary: "Consulta um paciente",
    authenticated: true,
    request: GetPatientSchema,
    responses: {
      200: { description: "Paciente.", schema: PatientSchema },
      404: notFound,
    },
  },
  {
    method: "put",
    path: "/patients/:id",
    tag: "Pacientes",
    summary: "Atualiza os dados cadastrais",
    description:
      "Substitui todos os dados cadastrais: campos opcionais omitidos ficam vazios. Uma nova `birthDate` não pode ser posterior à data de coleta de nenhum consentimento do paciente, inclusive os revogados (422 `PATIENT_BIRTH_DATE_AFTER_CONSENT`, no campo `birthDate`).",
    authenticated: true,
    request: UpdatePatientSchema,
    responses: {
      200: { description: "Paciente atualizado.", schema: PatientSchema },
      404: notFound,
      409: conflictErrorResponse(
        "Paciente arquivado (`PATIENT_ARCHIVED`), ou CPF (`PATIENT_CPF_ALREADY_EXISTS`, no campo `cpf`) ou Cartão SUS (`PATIENT_CNS_ALREADY_EXISTS`, no campo `cns`) já usado em outro paciente.",
      ),
    },
  },
  {
    method: "post",
    path: "/patients/:id/archive",
    tag: "Pacientes",
    summary: "Arquiva o paciente",
    authenticated: true,
    request: ArchivePatientSchema,
    responses: {
      200: { description: "Paciente arquivado.", schema: PatientSchema },
      404: notFound,
      409: errorResponse("O paciente já está arquivado."),
    },
  },
  {
    method: "post",
    path: "/patients/:id/unarchive",
    tag: "Pacientes",
    summary: "Reativa o paciente",
    authenticated: true,
    request: ArchivePatientSchema,
    responses: {
      200: { description: "Paciente reativado.", schema: PatientSchema },
      404: notFound,
      409: errorResponse("O paciente não está arquivado."),
    },
  },
];
