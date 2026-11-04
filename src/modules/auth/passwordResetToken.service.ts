import * as passwordResetTokenRepository from "./passwordResetToken.repository.js";
import { UnprocessableEntityException } from "../../shared/exceptions/index.js";
import { generateRandomToken, hashToken } from "../../utils/crypt.utils.js";

export const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export const createPasswordResetToken = async (userId: string) => {
  const token = generateRandomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
  await passwordResetTokenRepository.save(userId, tokenHash, expiresAt);
  return token;
};

export const isOnResendCooldown = async (userId: string) => {
  const latestToken =
    await passwordResetTokenRepository.findLatestByUserId(userId);

  if (!latestToken) {
    return false;
  }

  return (
    Date.now() - latestToken.createdAt.getTime() < PASSWORD_RESET_COOLDOWN_MS
  );
};

export const findValidToken = async (token: string) => {
  const tokenHash = hashToken(token);
  const passwordResetToken =
    await passwordResetTokenRepository.findByToken(tokenHash);
  const invalidToken =
    !passwordResetToken ||
    passwordResetToken.usedAt ||
    new Date() > passwordResetToken.expiresAt;

  if (invalidToken) {
    throw new UnprocessableEntityException("INVALID_LINK_TOKEN", []);
  }

  return passwordResetToken;
};

export const invalidateUserTokens = async (userId: string) => {
  await passwordResetTokenRepository.markAllAsUsedByUserId(userId, new Date());
};
