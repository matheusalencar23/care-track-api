import User from "../models/user";
import { BadRequestException } from "../shared/exceptions/badRequestError";

export const createUser = async (
  name: string,
  email: string,
  password: string,
) => {
  const userAlreadyExists = await User.findOne({ email });

  if (userAlreadyExists) {
    throw new BadRequestException("User already exists");
  }

  const user = new User({
    name,
    email,
    password,
  });

  await user.save();
};

