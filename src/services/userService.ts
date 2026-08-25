import User from "../models/user.js";
import { BadRequestException } from "../shared/exceptions/badRequestError.js";
import { INVALID_REGISTRATION_CREDENTIALS } from "../shared/messages.js";

export const createUser = async (
  name: string,
  email: string,
  password: string,
) => {
  const userAlreadyExists = await User.findOne({ email });

  if (userAlreadyExists) {
    throw new BadRequestException(INVALID_REGISTRATION_CREDENTIALS);
  }

  const user = new User({
    name,
    email,
    password,
  });

  await user.save();
};
