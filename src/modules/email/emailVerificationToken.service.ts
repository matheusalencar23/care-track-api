import { createHash, randomBytes } from "node:crypto";
import * as emailVerificationTokenRepository from "./emailVerificationToken.repository.js";
import { UnprocessableEntityException } from "../../shared/exceptions/index.js";

export const createEmailVerificationToken = async (userId: string) => {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await emailVerificationTokenRepository.save(userId, tokenHash, expiresAt);
  return token;
};

export const validateByToken = async (token: string) => {
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

  emailVerificationToken.usedAt = new Date();
  await emailVerificationToken.save();

  return emailVerificationToken;
};

export const deleteVerificationTokenByUserId = async (userId: string) => {
  await emailVerificationTokenRepository.deleteByUserId(userId);
};
