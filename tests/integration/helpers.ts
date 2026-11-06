import { asc, type SQL } from "drizzle-orm";
import { vi } from "vitest";
import { auditLogs } from "../../src/modules/audit/auditLog.model.js";
import { testDb } from "./database.js";
import * as userRepository from "../../src/modules/user/user.repository.js";
import { CURRENT_TERMS_VERSION } from "../../src/modules/terms/terms.js";
import {
  sendConfirmationEmail,
  sendPasswordResetEmail,
} from "../../src/services/email/email.service.js";

export const API = "/api/v1";

export const userData = {
  name: "Maria Silva",
  email: "maria@example.com",
  password: "password123",
  coren: "123456",
  corenState: "SP" as const,
  acceptedTermsVersion: CURRENT_TERMS_VERSION,
};

export const createVerifiedUser = async (
  overrides: Partial<typeof userData> = {},
) => {
  const user = await userRepository.save({ ...userData, ...overrides });
  await userRepository.markEmailVerified(user.id, new Date());

  return user;
};

export const createUnverifiedUser = async () => {
  return await userRepository.save(userData);
};

const tokenFromUrl = (url: unknown) =>
  new URL(String(url)).searchParams.get("token");

export const waitForConfirmationToken = async () => {
  return await vi.waitFor(() => {
    const call = vi.mocked(sendConfirmationEmail).mock.lastCall;
    if (!call) {
      throw new Error("Confirmation email was not sent");
    }
    return tokenFromUrl(call[2]);
  });
};

export const waitForPasswordResetToken = async () => {
  return await vi.waitFor(() => {
    const call = vi.mocked(sendPasswordResetEmail).mock.lastCall;
    if (!call) {
      throw new Error("Password reset email was not sent");
    }
    return tokenFromUrl(call[2]);
  });
};

export const findAuditLogs = async (where?: SQL) => {
  return await testDb()
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(asc(auditLogs.createdAt), asc(auditLogs.id));
};
