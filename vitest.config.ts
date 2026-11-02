import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.spec.ts"],
          exclude: ["tests/integration/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.spec.ts"],
          // Um único mongod (mongodb-memory-server) para toda a execução; cada
          // arquivo de teste usa um banco próprio
          globalSetup: ["./tests/integration/globalSetup.ts"],
          setupFiles: ["./tests/integration/setup.ts"],
          env: { LOG_LEVEL: "silent" },
          // O primeiro download do binário do mongod pode demorar
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
