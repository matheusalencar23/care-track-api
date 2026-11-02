import User from "./user.model.js";
import { BadRequestException } from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";
import { isDuplicateKeyError } from "../../utils/mongo.utils.js";
import type { SignupData } from "./user.schema.js";

export const findByEmail = async (email: string) => {
  return await User.findOne({ email: email });
};

export const findById = async (id: string) => {
  return await User.findById(id);
};

export const save = async (data: SignupData) => {
  const user = new User({
    name: data.name,
    email: data.email,
    password: data.password,
    coren: data.coren,
    corenState: data.corenState,
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
