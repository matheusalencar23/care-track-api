import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/**/*.model.ts",
  out: "./migrations",
  casing: "snake_case",
  entities: {
    roles: { provider: "", include: ["care_track_app"] },
  },
});
