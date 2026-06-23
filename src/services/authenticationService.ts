import User from "../models/user";
import { BadRequestException } from "../shared/exceptions/badRequestError";
import { generateToken } from "../utils/tokenUtils";

export const login = async (email: string, password: string) => {
  const user = await User.findOne({ email });

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
