import { findByEmail } from "../repository/userRepository.js";
import { BadRequestException } from "../shared/exceptions/badRequestError.js";
import { generateToken } from "../utils/tokenUtils.js";

export const login = async (email: string, password: string) => {
  const user = await findByEmail(email);

  if (!user) {
    throw new BadRequestException("Invalid credentials");
  }

  const isPasswordMatched = await user.authenticate(password);

  if (!isPasswordMatched) {
    throw new BadRequestException("Invalid credentials");
  }

  const token = generateToken({ _id: user._id });
  return token;
};
