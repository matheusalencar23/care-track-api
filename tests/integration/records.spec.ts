import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { auditLogs } from "../../src/modules/audit/auditLog.model.js";
import {
  records,
  recordVersions,
} from "../../src/modules/record/record.model.js";
import { messages } from "../../src/shared/messages.js";
import { API, createVerifiedUser, findAuditLogs, userData } from "./helpers.js";
import { countRows, testDb } from "./database.js";

type Agent = ReturnType<typeof request.agent>;

const signedInAgent = async (overrides: Partial<typeof userData> = {}) => {
  const user = await createVerifiedUser(overrides);
  const agent = request.agent(app);

  await agent
    .post(`${API}/auth/signin`)
    .send({
      email: overrides.email ?? userData.email,
      password: overrides.password ?? userData.password,
    })
    .expect(200);

  return { user, agent };
};

const createPatient = async (agent: Agent) => {
  const response = await agent
    .post(`${API}/patients`)
    .send({ name: "José da Silva", birthDate: "1950-03-15" })
    .expect(201);
  return response.body.id as string;
};

const recordsUrl = (patientId: string) =>
  `${API}/patients/${patientId}/records`;

describe("records", () => {
  it("should create a record with the author, COREN and server time", async () => {
    const { user, agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const before = new Date();

    const response = await agent
      .post(recordsUrl(patientId))
      .send({ content: "  Paciente estável, sem queixas.\nPA 120x80.  " })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      patientId,
      content: "Paciente estável, sem queixas.\nPA 120x80.",
      version: 1,
      author: {
        id: user.id,
        name: userData.name,
        coren: userData.coren,
        corenState: userData.corenState,
      },
      createdAt: expect.any(String),
      editedAt: null,
    });
    expect(new Date(response.body.createdAt).getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 1000,
    );

    const [record] = await testDb()
      .select()
      .from(records)
      .where(eq(records.id, response.body.id));
    expect(record).toMatchObject({
      ownerId: user.id,
      patientId,
      authorId: user.id,
    });

    const versions = await testDb()
      .select()
      .from(recordVersions)
      .where(eq(recordVersions.recordId, response.body.id));
    expect(versions).toEqual([
      expect.objectContaining({
        version: 1,
        content: "Paciente estável, sem queixas.\nPA 120x80.",
        authorId: user.id,
        authorName: userData.name,
        authorCoren: userData.coren,
        authorCorenState: userData.corenState,
        reason: null,
      }),
    ]);
  });

  it("should ignore a creation time or author sent by the client", async () => {
    const { user, agent } = await signedInAgent();
    const patientId = await createPatient(agent);

    const response = await agent
      .post(recordsUrl(patientId))
      .send({
        content: "Curativo realizado",
        createdAt: "2000-01-01T00:00:00Z",
        authorId: randomUUID(),
        author: { name: "Outra pessoa", coren: "999999" },
      })
      .expect(201);

    expect(response.body.createdAt).not.toBe("2000-01-01T00:00:00.000Z");
    expect(response.body.author).toEqual({
      id: user.id,
      name: userData.name,
      coren: userData.coren,
      corenState: userData.corenState,
    });
  });

  it("should audit the creation of a record", async () => {
    const { user, agent } = await signedInAgent();
    const patientId = await createPatient(agent);

    const response = await agent
      .post(recordsUrl(patientId))
      .send({ content: "Curativo realizado" })
      .expect(201);

    const logs = await findAuditLogs(eq(auditLogs.action, "record.create"));
    expect(logs).toEqual([
      expect.objectContaining({
        userId: user.id,
        resourceType: "record",
        resourceId: response.body.id,
        patientId,
      }),
    ]);
  });

  it("should require authentication", async () => {
    await request(app)
      .post(recordsUrl(randomUUID()))
      .send({ content: "Curativo realizado" })
      .expect(401);
  });

  it("should return 404 for a patient that does not exist", async () => {
    const { agent } = await signedInAgent();

    const response = await agent
      .post(recordsUrl(randomUUID()))
      .send({ content: "Curativo realizado" })
      .expect(404);
    expect(response.body.message).toBe(messages.PATIENT_NOT_FOUND);
  });

  it("should not create a record for an archived patient", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    await agent.post(`${API}/patients/${patientId}/archive`).expect(200);

    const response = await agent
      .post(recordsUrl(patientId))
      .send({ content: "Curativo realizado" })
      .expect(409);
    expect(response.body.message).toBe(messages.PATIENT_ARCHIVED);
    expect(await countRows(records)).toBe(0);
  });

  it.each([
    [{}],
    [{ content: "" }],
    [{ content: "   " }],
    [{ content: 123 }],
    [{ content: "a".repeat(20_001) }],
  ])("should reject the invalid record %o", async (body) => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);

    await agent.post(recordsUrl(patientId)).send(body).expect(422);
    expect(await countRows(records)).toBe(0);
  });

  it("should reject an invalid patient id", async () => {
    const { agent } = await signedInAgent();

    await agent
      .post(recordsUrl("not-a-uuid"))
      .send({ content: "Curativo realizado" })
      .expect(422);
  });

  it("should not create a record for another nurse's patient", async () => {
    const { agent: owner } = await signedInAgent();
    const patientId = await createPatient(owner);
    const { agent: other } = await signedInAgent({ email: "ana@example.com" });

    const response = await other
      .post(recordsUrl(patientId))
      .send({ content: "Invasão" })
      .expect(404);
    expect(response.body.message).toBe(messages.PATIENT_NOT_FOUND);
    expect(await countRows(records)).toBe(0);
    expect(await countRows(recordVersions)).toBe(0);
  });
});
