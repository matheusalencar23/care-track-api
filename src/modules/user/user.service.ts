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

export const createUser = async (
  name: string,
  email: string,
  password: string,
) => {
  const userAlreadyExists = await userRepository.findByEmail(email);

  if (userAlreadyExists) {
    throw new BadRequestException(messages.INVALID_REGISTRATION_CREDENTIALS);
  }

  const user = await userRepository.save(name, email, password);
  AppLogger.info(`User created {userId=${user.id}}`);

  createValidationEmail(user.id, email, name).catch(() => {});
};

export const validateUser = async (token: string) => {
  const emailVerificationToken =
    await emailVerificationTokenService.validateByToken(token);
  const user = await userRepository.findById(
    emailVerificationToken.userId.toString(),
  );

  if (user?.emailVerifiedAt) {
    throw new UnprocessableEntityException("Email already verified!", []);
  }

  if (user) {
    user.emailVerifiedAt = new Date();
    await user?.save();
  }

  return;
};

export const resendValidation = async (email: string) => {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new NotFoundException("User not found!");
  }

  if (user.emailVerifiedAt) {
    throw new UnprocessableEntityException("Email already verified!", []);
  }

  if (await emailVerificationTokenService.isOnResendCooldown(user.id)) {
    throw new TooManyRequestsException(
      "Confirmation email was sent recently, try again later",
    );
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
    AppLogger.error(`Error sending confirmation email {userId=${userId}}`);
    if (err instanceof Error && err.stack) {
      AppLogger.error(err.stack);
    }

    throw err;
  }
};
