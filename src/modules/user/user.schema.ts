import z from "zod";
import { BRAZILIAN_STATES } from "../../shared/brazilianStates.js";
import { CURRENT_TERMS_VERSION } from "../terms/terms.js";

export const passwordSchema = z
  .string("A senha é obrigatória")
  .nonempty("A senha é obrigatória")
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .max(72, "A senha deve ter no máximo 72 caracteres");

export const SignupSchema = z.object({
  body: z.object({
    name: z.string("O nome é obrigatório").nonempty("O nome é obrigatório"),
    email: z.email("Email inválido"),
    password: passwordSchema,
    coren: z
      .string("O COREN é obrigatório")
      .regex(/^\d{1,9}$/, "O COREN deve conter apenas números"),
    corenState: z.enum(BRAZILIAN_STATES, "UF do COREN inválida"),
    acceptedTermsVersion: z
      .string("É preciso aceitar os termos de uso")
      .refine(
        (version) => version === CURRENT_TERMS_VERSION,
        "Os termos de uso foram atualizados. Recarregue a página e aceite a versão atual.",
      ),
  }),
});

export type SignupData = z.infer<typeof SignupSchema>["body"];

export const SigninSchema = z.object({
  body: z.object({
    email: z.email("Email inválido"),
    password: z
      .string("A senha é obrigatória")
      .nonempty("A senha é obrigatória"),
  }),
});

export const ValidateUserSchema = z.object({
  query: z.object({
    token: z.string("Token inválido"),
  }),
});

export const ResendValidationEmailSchema = z.object({
  body: z.object({
    email: z.email("Email inválido"),
  }),
});
