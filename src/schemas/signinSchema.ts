import z from "zod";

export const SigninSchema = z.object({
  body: z.object({
    email: z.email("Email inválido"),
    password: z
      .string("A senha é obrigatória")
      .nonempty("A senha é obrigatória"),
  }),
});
