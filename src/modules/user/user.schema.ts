import z from "zod";

export const SignupSchema = z.object({
  body: z.object({
    name: z.string("O nome é obrigatório").nonempty("O nome é obrigatório"),
    email: z.email("Email inválido"),
    password: z
      .string("A senha é obrigatória")
      .nonempty("A senha é obrigatória"),
  }),
});

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
