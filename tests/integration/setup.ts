import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, inject, vi } from "vitest";

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

afterEach(async () => {
  vi.clearAllMocks();
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
