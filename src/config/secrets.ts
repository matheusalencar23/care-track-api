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
export const MONGO_DB_URL_CONNECTION = requiredEnv("MONGO_DB_URL_CONNECTION");
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "";
export const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
export const RESEND_EMAIL_ORIGIN = process.env.RESEND_EMAIL_ORIGIN ?? "";
export const EMAIL_HOST = process.env.EMAIL_HOST;
