import z from "zod";
import { passwordSchema } from "../user/user.schema.js";

export const ForgotPasswordSchema = z.object({
  body: z.object({
    email: z.email("Email inválido"),
  }),
});

export const ResetPasswordSchema = z.object({
  body: z.object({
    token: z.string("Token inválido").nonempty("Token inválido"),
    password: passwordSchema,
  }),
});
