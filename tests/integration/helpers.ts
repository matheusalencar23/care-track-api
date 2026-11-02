import { vi } from "vitest";
import User from "../../src/modules/user/user.model.js";
import {
  sendConfirmationEmail,
  sendPasswordResetEmail,
} from "../../src/services/email/email.service.js";

export const API = "/api/v1";

export const userData = {
  name: "Maria Silva",
  email: "maria@example.com",
  password: "password123",
  coren: "123456",
  corenState: "SP" as const,
};

// Cria direto no banco um usuário com o e-mail já confirmado, sem passar
// pelas rotas (e sem consumir os rate limits)
export const createVerifiedUser = async (
  overrides: Partial<typeof userData> = {},
) => {
  return await User.create({
    ...userData,
    ...overrides,
    emailVerifiedAt: new Date(),
  });
};

const tokenFromUrl = (url: unknown) =>
  new URL(String(url)).searchParams.get("token");

// O e-mail de confirmação é enviado sem bloquear a resposta do signup, então
// espera a chamada do mock antes de ler o link
export const waitForConfirmationToken = async () => {
  return await vi.waitFor(() => {
    const call = vi.mocked(sendConfirmationEmail).mock.lastCall;
    if (!call) {
      throw new Error("Confirmation email was not sent");
    }
    return tokenFromUrl(call[2]);
  });
};

export const waitForPasswordResetToken = async () => {
  return await vi.waitFor(() => {
    const call = vi.mocked(sendPasswordResetEmail).mock.lastCall;
    if (!call) {
      throw new Error("Password reset email was not sent");
    }
    return tokenFromUrl(call[2]);
  });
};
