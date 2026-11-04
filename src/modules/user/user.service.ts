import * as userRepository from "./user.repository.js";
import {
  BadRequestException,
  NotFoundException,
  TooManyRequestsException,
  UnprocessableEntityException,
} from "../../shared/exceptions/index.js";
import { sendConfirmationEmail } from "../../services/email/email.service.js";
import * as emailVerificationTokenService from "../email/emailVerificationToken.service.js";
import { withTransaction } from "../../db/db.js";
import { EMAIL_VERIFICATION_URL } from "../../config/secrets.js";
import { AppLogger } from "../../shared/appLogger.js";
import { errorDetails } from "../../shared/errorDetails.js";
import type { SignupData } from "./user.schema.js";

export const createUser = async (data: SignupData) => {
  const userAlreadyExists = await userRepository.findByEmail(data.email);

  if (userAlreadyExists) {
    throw new BadRequestException("INVALID_REGISTRATION_CREDENTIALS");
  }

  const user = await userRepository.save(data);
  AppLogger.info("User created", { userId: user.id });

  createValidationEmail(user.id, data.email, data.name).catch(() => {});
};

export const validateUser = async (token: string) => {
  const emailVerificationToken =
    await emailVerificationTokenService.findValidToken(token);
  const user = await userRepository.findById(emailVerificationToken.userId);

  if (!user) {
    throw new UnprocessableEntityException("INVALID_LINK_TOKEN", []);
  }

  if (user.emailVerifiedAt) {
    throw new UnprocessableEntityException("EMAIL_ALREADY_VERIFIED", []);
  }

  // Na mesma transação: se algo falhar, nem o e-mail fica confirmado nem o
  // token é consumido, e o mesmo link continua funcionando.
  await withTransaction(async () => {
    await userRepository.markEmailVerified(user.id, new Date());
    await emailVerificationTokenService.markTokenAsUsed(emailVerificationToken);
  });
};

export const resendValidation = async (email: string) => {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new NotFoundException("USER_NOT_FOUND");
  }

  if (user.emailVerifiedAt) {
    throw new UnprocessableEntityException("EMAIL_ALREADY_VERIFIED", []);
  }

  if (await emailVerificationTokenService.isOnResendCooldown(user.id)) {
    throw new TooManyRequestsException("CONFIRMATION_EMAIL_COOLDOWN");
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
      `${EMAIL_VERIFICATION_URL}?token=${emailVerificationToken}`,
    );
  } catch (err) {
    AppLogger.error("Error sending confirmation email", {
      userId,
      ...errorDetails(err),
    });

    throw err;
  }
};
