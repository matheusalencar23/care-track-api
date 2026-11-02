import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { ipKeyGenerator } from "express-rate-limit";
import { afterAll, afterEach, beforeAll, inject, vi } from "vitest";
import {
  authLimiter,
  emailLimiter,
  generalLimiter,
} from "../../src/middlewares/rateLimit.middleware.js";

vi.mock("../../src/services/email/email.service.js");

beforeAll(async () => {
  await mongoose.connect(inject("mongoUri"), { dbName: randomUUID() });
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.syncIndexes()),
  );
});

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
