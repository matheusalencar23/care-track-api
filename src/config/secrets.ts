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
export const RESEND_API_KEY = requiredEnv("RESEND_API_KEY");
export const RESEND_EMAIL_ORIGIN = requiredEnv("RESEND_EMAIL_ORIGIN");
export const EMAIL_HOST = requiredEnv("EMAIL_HOST");
export const PASSWORD_RESET_HOST = requiredEnv("PASSWORD_RESET_HOST");
