import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (
  password: string,
  hashPassword: string,
) => {
  return await bcrypt.compare(password, hashPassword);
};

export const generateRandomToken = () => {
  return randomBytes(32).toString("hex");
};

export const hashToken = (token: string) => {
  return createHash("sha256").update(token).digest("hex");
};
