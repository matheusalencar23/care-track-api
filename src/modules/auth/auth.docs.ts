import {
  ApiOperation,
  emptyResponse,
  errorResponse,
  validationErrorResponse,
} from "../../docs/apiDocs.js";
import { UserSchema } from "../user/user.docs.js";
import { SigninSchema } from "../user/user.schema.js";
import { ForgotPasswordSchema, ResetPasswordSchema } from "./auth.schema.js";

export const authOperations: ApiOperation[] = [
  {
    method: "post",
    path: "/auth/signin",
    tag: "Autenticação",
    summary: "Faz login",
    description:
      "Grava a sessão no cookie httpOnly `token` (1 hora). Exige o e-mail confirmado.",
    request: SigninSchema,
    responses: {
      200: {
        description: "Login feito.",
        headers: {
          "Set-Cookie": {
            description: "Cookie httpOnly `token` com o JWT da sessão.",
            schema: { type: "string" },
          },
        },
      },
      400: errorResponse("Credenciais inválidas ou e-mail não confirmado."),
    },
  },
  {
    method: "post",
    path: "/auth/signout",
    tag: "Autenticação",
    summary: "Encerra a sessão",
    authenticated: true,
    responses: {
      204: emptyResponse("Sessão encerrada e cookie removido."),
    },
  },
  {
    method: "get",
    path: "/auth/me",
    tag: "Autenticação",
    summary: "Dados da enfermeira autenticada",
    authenticated: true,
    responses: {
      200: { description: "Enfermeira autenticada.", schema: UserSchema },
    },
  },
  {
    method: "post",
    path: "/auth/forgot-password",
    tag: "Autenticação",
    summary: "Pede a recuperação de senha",
    description:
      "Envia o link de redefinição por e-mail. Sempre responde 200, exista ou não a conta.",
    request: ForgotPasswordSchema,
    responses: {
      200: emptyResponse("Pedido recebido."),
    },
  },
  {
    method: "post",
    path: "/auth/reset-password",
    tag: "Autenticação",
    summary: "Redefine a senha",
    description:
      "Grava a nova senha e encerra todas as sessões abertas antes da troca.",
    request: ResetPasswordSchema,
    responses: {
      200: emptyResponse("Senha redefinida."),
      422: validationErrorResponse("Dados inválidos ou link expirado."),
    },
  },
];
