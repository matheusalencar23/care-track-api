import * as userRepository from "../user/user.repository.js";
import * as passwordResetTokenService from "./passwordResetToken.service.js";
import * as auditLogService from "../audit/auditLog.service.js";
import {
  BadRequestException,
  UnprocessableEntityException,
} from "../../shared/exceptions/index.js";
import { generateToken } from "../../utils/token.utils.js";
import { messages } from "../../shared/messages.js";
import { sendPasswordResetEmail } from "../../services/email/email.service.js";
import { PASSWORD_RESET_HOST } from "../../config/secrets.js";
import { AppLogger } from "../../shared/appLogger.js";

export const login = async (email: string, password: string) => {
  const user = await userRepository.findByEmail(email);

  if (!user || !user.emailVerifiedAt) {
    throw new BadRequestException(messages.INVALID_CREDENTIALS);
  }

  const isPasswordMatched = await user.authenticate(password);

  if (!isPasswordMatched) {
    throw new BadRequestException(messages.INVALID_CREDENTIALS);
  }

  await auditLogService.record({
    userId: user.id,
    action: "auth.signin",
    resourceType: "user",
    resourceId: user.id,
  });

  const token = generateToken({ _id: user._id });
  return token;
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
  const user = await userRepository.findById(
    passwordResetToken.userId.toString(),
  );

  if (!user) {
    throw new UnprocessableEntityException("Invalid token!", []);
  }

  const now = new Date();
  user.password = password;
  user.passwordChangedAt = now;
  user.emailVerifiedAt ??= now;
  await user.save();

  await passwordResetTokenService.invalidateUserTokens(user.id);
  await auditLogService.record({
    userId: user.id,
    action: "auth.password_reset",
    resourceType: "user",
    resourceId: user.id,
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
    AppLogger.error("Error sending password reset email", { userId });
    if (err instanceof Error && err.stack) {
      AppLogger.error(err.stack);
    }

    throw err;
  }
};
