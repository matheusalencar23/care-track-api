import User from "./user.model.js";
import { BadRequestException } from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";
import { isDuplicateKeyError } from "../../utils/mongo.utils.js";

export const findByEmail = async (email: string) => {
  return await User.findOne({ email: email });
};

export const findById = async (id: string) => {
  return await User.findById(id);
};

export const save = async (name: string, email: string, password: string) => {
  const user = new User({
    name,
    email,
    password,
  });

  try {
    await user.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new BadRequestException(messages.INVALID_REGISTRATION_CREDENTIALS);
    }

    throw err;
  }

  return user;
};
