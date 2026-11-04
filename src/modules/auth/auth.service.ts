import * as userRepository from "../user/user.repository.js";
import * as passwordResetTokenService from "./passwordResetToken.service.js";
import * as auditLogService from "../audit/auditLog.service.js";
import {
  BadRequestException,
  UnprocessableEntityException,
} from "../../shared/exceptions/index.js";
import { createSession } from "./session.js";
import { comparePassword } from "../../utils/crypt.utils.js";
import { withTransaction } from "../../db/db.js";
import { messages } from "../../shared/messages.js";
import { sendPasswordResetEmail } from "../../services/email/email.service.js";
import { PASSWORD_RESET_HOST } from "../../config/secrets.js";
import { AppLogger } from "../../shared/appLogger.js";
import { errorDetails } from "../../shared/errorDetails.js";

export const login = async (email: string, password: string) => {
  const user = await userRepository.findByEmail(email);

  if (!user || !user.emailVerifiedAt) {
    throw new BadRequestException(messages.INVALID_CREDENTIALS);
  }

  const isPasswordMatched = await comparePassword(password, user.passwordHash);

  if (!isPasswordMatched) {
    throw new BadRequestException(messages.INVALID_CREDENTIALS);
  }

  await auditLogService.record({
    userId: user.id,
    action: "auth.signin",
    resourceType: "user",
    resourceId: user.id,
  });

  return createSession(user.id);
};

export const requestPasswordReset = async (email: string) => {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    AppLogger.info("Password reset requested for unknown email");
    return;
  }

  if (await passwordResetTokenService.isOnResendCooldown(user.id)) {
    AppLogger.info("Password reset on cooldown", { userId: user.id });
    return;
  }

  createPasswordResetEmail(user.id, email, user.name).catch(() => {});
};

export const resetPassword = async (token: string, password: string) => {
  const passwordResetToken =
    await passwordResetTokenService.findValidToken(token);
  const user = await userRepository.findById(passwordResetToken.userId);

  if (!user) {
    throw new UnprocessableEntityException(messages.INVALID_LINK_TOKEN, []);
  }

  const now = new Date();

  await withTransaction(async () => {
    await userRepository.updatePassword(user.id, password, {
      passwordChangedAt: now,
      emailVerifiedAt: user.emailVerifiedAt ?? now,
    });
    await passwordResetTokenService.invalidateUserTokens(user.id);
    await auditLogService.record({
      userId: user.id,
      action: "auth.password_reset",
      resourceType: "user",
      resourceId: user.id,
    });
  });
  AppLogger.info("Password reset", { userId: user.id });
};

const createPasswordResetEmail = async (
  userId: string,
  email: string,
  name: string,
) => {
  try {
    const passwordResetToken =
      await passwordResetTokenService.createPasswordResetToken(userId);

    await sendPasswordResetEmail(
      email,
      name,
      `${PASSWORD_RESET_HOST}?token=${passwordResetToken}`,
    );
  } catch (err) {
    AppLogger.error("Error sending password reset email", {
      userId,
      ...errorDetails(err),
    });

    throw err;
  }
};
