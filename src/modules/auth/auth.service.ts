import { findByEmail } from "../user/user.repository.js";
import { BadRequestException } from "../../shared/exceptions/index.js";
import { generateToken } from "../../utils/token.utils.js";
import { messages } from "../../shared/messages.js";

export const login = async (email: string, password: string) => {
  const user = await findByEmail(email);

  if (!user || !user.emailVerifiedAt) {
    throw new BadRequestException(messages.INVALID_CREDENTIALS);
  }

  const isPasswordMatched = await user.authenticate(password);

  if (!isPasswordMatched) {
    throw new BadRequestException(messages.INVALID_CREDENTIALS);
  }

  const token = generateToken({ _id: user._id });
  return token;
};
