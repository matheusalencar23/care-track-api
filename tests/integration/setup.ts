import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { ipKeyGenerator } from "express-rate-limit";
import { afterAll, afterEach, beforeAll, inject, vi } from "vitest";
import {
  authLimiter,
  emailLimiter,
  generalLimiter,
} from "../../src/middlewares/rateLimit.middleware.js";

// O único mock dos testes de integração: nenhum e-mail sai de verdade. Os
// testes leem o link enviado a partir das chamadas do mock.
vi.mock("../../src/services/email/email.service.js");

beforeAll(async () => {
  await mongoose.connect(inject("mongoUri"), { dbName: randomUUID() });
  // Garante os índices (unique, TTL) antes do primeiro teste
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.syncIndexes()),
  );
});

// O Vitest define NODE_ENV=test, então os rate limiters ficam ativos. Os
// contadores (em memória, por IP) são zerados a cada teste para que um não
// consuma o limite do outro.
const LOOPBACK_KEYS = ["127.0.0.1", "::1"].map((ip) => ipKeyGenerator(ip));

afterEach(async () => {
  vi.clearAllMocks();
  for (const limiter of [generalLimiter, emailLimiter, authLimiter]) {
    for (const key of LOOPBACK_KEYS) {
      await limiter.resetKey(key);
    }
  }
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
