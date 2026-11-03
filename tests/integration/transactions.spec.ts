import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import app from "../../src/app.js";
import * as auditLogRepository from "../../src/modules/audit/auditLog.repository.js";
import { auditLogs } from "../../src/modules/audit/auditLog.model.js";
import { patients } from "../../src/modules/patient/patient.model.js";
import {
  API,
  createVerifiedUser,
  userData,
  waitForPasswordResetToken,
} from "./helpers.js";
import { countRows, testDb } from "./database.js";

vi.mock(
  "../../src/modules/audit/auditLog.repository.js",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../src/modules/audit/auditLog.repository.js")
      >();
    return { ...actual, save: vi.fn(actual.save) };
  },
);

const failNextAudit = () => {
  vi.mocked(auditLogRepository.save).mockRejectedValueOnce(
    new Error("Audit storage is down"),
  );
};

const signedInAgent = async () => {
  await createVerifiedUser();
  const agent = request.agent(app);
  await agent
    .post(`${API}/auth/signin`)
    .send({ email: userData.email, password: userData.password })
    .expect(200);
  return agent;
};

describe("write and audit in the same transaction", () => {
  it("should not create a patient when the audit fails", async () => {
    const agent = await signedInAgent();
    failNextAudit();

    await agent
      .post(`${API}/patients`)
      .send({ name: "José da Silva", birthDate: "1950-03-15" })
      .expect(500);

    expect(await countRows(patients)).toBe(0);
  });

  it("should not keep a patient update when the audit fails", async () => {
    const agent = await signedInAgent();
    const created = await agent
      .post(`${API}/patients`)
      .send({ name: "José da Silva", birthDate: "1950-03-15" })
      .expect(201);
    failNextAudit();

    await agent
      .put(`${API}/patients/${created.body.id}`)
      .send({ name: "Outro Nome", birthDate: "1950-03-15" })
      .expect(500);

    const [stored] = await testDb().select().from(patients);
    expect(stored?.name).toBe("José da Silva");
    expect(await countRows(auditLogs)).toBe(2);
  });

  it("should not change the password when the audit fails", async () => {
    await createVerifiedUser();
    await request(app)
      .post(`${API}/auth/forgot-password`)
      .send({ email: userData.email })
      .expect(200);
    const token = await waitForPasswordResetToken();
    failNextAudit();

    await request(app)
      .post(`${API}/auth/reset-password`)
      .send({ token, password: "new-password-456" })
      .expect(500);

    await request(app)
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: userData.password })
      .expect(200);
    await request(app)
      .post(`${API}/auth/reset-password`)
      .send({ token, password: "new-password-456" })
      .expect(200);
  });
});
