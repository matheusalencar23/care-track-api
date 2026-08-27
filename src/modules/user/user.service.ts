import { findByEmail, save } from "./user.repository.js";
import { BadRequestException } from "../../shared/exceptions/badRequestError.js";
import { INVALID_REGISTRATION_CREDENTIALS } from "../../shared/messages.js";

export const createUser = async (
  name: string,
  email: string,
  password: string,
) => {
  const userAlreadyExists = await findByEmail(email);

  if (userAlreadyExists) {
    throw new BadRequestException(INVALID_REGISTRATION_CREDENTIALS);
  }

  save(name, email, password);
};
