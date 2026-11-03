import * as userRepository from "./user.repository.js";
import {
  BadRequestException,
  NotFoundException,
  TooManyRequestsException,
  UnprocessableEntityException,
} from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";
import { sendConfirmationEmail } from "../../services/email/email.service.js";
import * as emailVerificationTokenService from "../email/emailVerificationToken.service.js";
import { EMAIL_HOST } from "../../config/secrets.js";
import { AppLogger } from "../../shared/appLogger.js";
import type { SignupData } from "./user.schema.js";

export const createUser = async (data: SignupData) => {
  const userAlreadyExists = await userRepository.findByEmail(data.email);

  if (userAlreadyExists) {
    throw new BadRequestException(messages.INVALID_REGISTRATION_CREDENTIALS);
  }

  const user = await userRepository.save(data);
  AppLogger.info("User created", { userId: user.id });

  createValidationEmail(user.id, data.email, data.name).catch(() => {});
};

export const validateUser = async (token: string) => {
  const emailVerificationToken =
    await emailVerificationTokenService.findValidToken(token);
  const user = await userRepository.findById(
    emailVerificationToken.userId.toString(),
  );

  if (!user) {
    throw new UnprocessableEntityException(messages.INVALID_LINK_TOKEN, []);
  }

  if (user.emailVerifiedAt) {
    throw new UnprocessableEntityException(messages.EMAIL_ALREADY_VERIFIED, []);
  }

  user.emailVerifiedAt = new Date();
  await user.save();

  // O token só é consumido depois que a verificação foi gravada: se algo
  // falhar antes, o mesmo link continua funcionando.
  await emailVerificationTokenService.markTokenAsUsed(emailVerificationToken);
};

export const resendValidation = async (email: string) => {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new NotFoundException(messages.USER_NOT_FOUND);
  }

  if (user.emailVerifiedAt) {
    throw new UnprocessableEntityException(messages.EMAIL_ALREADY_VERIFIED, []);
  }

  if (await emailVerificationTokenService.isOnResendCooldown(user.id)) {
    throw new TooManyRequestsException(messages.CONFIRMATION_EMAIL_COOLDOWN);
  }

  await createValidationEmail(user.id, email, user.name);
};

const createValidationEmail = async (
  userId: string,
  email: string,
  name: string,
) => {
  try {
    const emailVerificationToken =
      await emailVerificationTokenService.createEmailVerificationToken(userId);

    await sendConfirmationEmail(
      email,
      name,
      `${EMAIL_HOST}?token=${emailVerificationToken}`,
    );
  } catch (err) {
    AppLogger.error("Error sending confirmation email", { userId });
    if (err instanceof Error && err.stack) {
      AppLogger.error(err.stack);
    }

    throw err;
  }
};
