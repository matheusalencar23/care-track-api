import { createHash, randomBytes } from "node:crypto";
import * as emailVerificationTokenRepository from "./emailVerificationToken.repository.js";
import type { IEmailVerificationToken } from "./emailVerificationToken.model.js";
import { UnprocessableEntityException } from "../../shared/exceptions/index.js";

export const RESEND_COOLDOWN_MS = 60 * 1000;

export const createEmailVerificationToken = async (userId: string) => {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await emailVerificationTokenRepository.save(userId, tokenHash, expiresAt);
  return token;
};

export const isOnResendCooldown = async (userId: string) => {
  const latestToken =
    await emailVerificationTokenRepository.findLatestByUserId(userId);

  if (!latestToken) {
    return false;
  }

  return Date.now() - latestToken.createdAt.getTime() < RESEND_COOLDOWN_MS;
};

// Só verifica o token, sem consumi-lo: quem chama decide quando marcá-lo
// como usado (depois de concluir a operação que ele autoriza).
export const findValidToken = async (token: string) => {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const emailVerificationToken =
    await emailVerificationTokenRepository.findByToken(tokenHash);
  const invalidToken =
    !emailVerificationToken ||
    emailVerificationToken.usedAt ||
    new Date() > emailVerificationToken.expiresAt;

  if (invalidToken) {
    throw new UnprocessableEntityException("Invalid token!", []);
  }

  return emailVerificationToken;
};

export const markTokenAsUsed = async (
  emailVerificationToken: IEmailVerificationToken,
) => {
  emailVerificationToken.usedAt = new Date();
  await emailVerificationToken.save();
};

export const deleteVerificationTokenByUserId = async (userId: string) => {
  await emailVerificationTokenRepository.deleteByUserId(userId);
};
