import User from "./user.model.js";

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

  await user.save();

  return user;
};
