function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const ENV = process.env.ENV ?? "dev";
export const PORT = Number(process.env.PORT) || 3001;
export const JWT_SECRET = requiredEnv("JWT_SECRET");
export const MONGO_DB_URL_CONNECTION = requiredEnv("MONGO_DB_URL_CONNECTION");