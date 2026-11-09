import { parseTrustProxy } from "./trustProxy.js";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const PORT = Number(process.env.PORT) || 3001;
export const JWT_SECRET = requiredEnv("JWT_SECRET");
export const DATABASE_URL = requiredEnv("DATABASE_URL");
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "";
export const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY);
export const RESEND_API_KEY = requiredEnv("RESEND_API_KEY");
export const RESEND_EMAIL_ORIGIN = requiredEnv("RESEND_EMAIL_ORIGIN");
export const EMAIL_VERIFICATION_URL = requiredEnv("EMAIL_VERIFICATION_URL");
export const PASSWORD_RESET_HOST = requiredEnv("PASSWORD_RESET_HOST");
export const S3_ENDPOINT = requiredEnv("S3_ENDPOINT");
export const S3_PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT || S3_ENDPOINT;
export const S3_REGION = requiredEnv("S3_REGION");
export const S3_BUCKET = requiredEnv("S3_BUCKET");
export const S3_ACCESS_KEY_ID = requiredEnv("S3_ACCESS_KEY_ID");
export const S3_SECRET_ACCESS_KEY = requiredEnv("S3_SECRET_ACCESS_KEY");
export const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === "true";
export const ATTACHMENT_MAX_SIZE_BYTES =
  Number(process.env.ATTACHMENT_MAX_SIZE_BYTES) || 200 * 1024 * 1024;
export const API_DOCS_ENABLED = process.env.API_DOCS_ENABLED
  ? process.env.API_DOCS_ENABLED === "true"
  : NODE_ENV !== "production";
