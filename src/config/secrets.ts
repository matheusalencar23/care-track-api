import { loadEnvFile } from "node:process";
loadEnvFile(".env");

export const ENV = process.env.ENV ?? "dev";
export const PORT = Number(process.env.PORT);
export const JWT_SECRET = process.env.JWT_SECRET ?? "";
export const MONGO_DB_URL_CONNECTION =
  process.env.MONGO_DB_URL_CONNECTION ?? "";
