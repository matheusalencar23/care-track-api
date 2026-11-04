import z from "zod";
import {
  ApiOperation,
  component,
  emptyResponse,
  errorResponse,
  validationErrorResponse,
} from "../../docs/apiDocs.js";
import { BRAZILIAN_STATES } from "../../shared/brazilianStates.js";
import {
  ResendValidationEmailSchema,
  SignupSchema,
  ValidateUserSchema,
} from "./user.schema.js";

export const UserSchema = component(
  "User",
  z.object({
    name: z.string(),
    email: z.email(),
    coren: z.string(),
    corenState: z.enum(BRAZILIAN_STATES),
  }),
);

export const userOperations: ApiOperation[] = [
  {
    method: "post",
    path: "/users/signup",
    tag: "Usuários",
    summary: "Cadastra uma enfermeira",
    description:
      "Cria a conta e envia o e-mail de confirmação. O login só é liberado depois que o e-mail é confirmado.",
    request: SignupSchema,
    responses: {
      201: { description: "Conta criada.", schema: UserSchema },
      400: errorResponse("Não foi possível concluir o cadastro."),
    },
  },
  {
    method: "get",
    path: "/users/validate",
    tag: "Usuários",
    summary: "Confirma o e-mail",
    description:
      "Recebe o token enviado por e-mail (válido por 30 minutos e de uso único).",
    request: ValidateUserSchema,
    responses: {
      200: emptyResponse("E-mail confirmado."),
      422: validationErrorResponse(
        "Token inválido, expirado ou e-mail já confirmado.",
      ),
    },
  },
  {
    method: "post",
    path: "/users/resend",
    tag: "Usuários",
    summary: "Reenvia o e-mail de confirmação",
    description:
      "Sempre responde 200, exista ou não a conta, para não revelar quais e-mails estão cadastrados.",
    request: ResendValidationEmailSchema,
    responses: {
      200: emptyResponse("Pedido recebido."),
    },
  },
];
