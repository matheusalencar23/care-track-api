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
import { adminQuery, countRows, testDb } from "./database.js";

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

const recordUrl = (patientId: string, recordId: string) =>
  `${recordsUrl(patientId)}/${recordId}`;

const versionsUrl = (patientId: string, recordId: string) =>
  `${recordUrl(patientId, recordId)}/versions`;

const createRecord = async (
  agent: Agent,
  patientId: string,
  content = "Curativo realizado",
) => {
  const response = await agent
    .post(recordsUrl(patientId))
    .send({ content })
    .expect(201);
  return response.body.id as string;
};

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

describe("record editing", () => {
  it("should edit a record by appending a version and keep the previous ones", async () => {
    const { user, agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const created = await agent
      .post(recordsUrl(patientId))
      .send({ content: "Curativo realizado" })
      .expect(201);
    const recordId = created.body.id as string;

    const edited = await agent
      .put(recordUrl(patientId, recordId))
      .send({
        content: "  Curativo realizado na região sacral.  ",
        version: 1,
        reason: "  Faltou o local do curativo  ",
      })
      .expect(200);

    expect(edited.body).toEqual({
      ...created.body,
      content: "Curativo realizado na região sacral.",
      version: 2,
      editedAt: expect.any(String),
    });

    const versions = await agent
      .get(versionsUrl(patientId, recordId))
      .expect(200);
    const author = {
      id: user.id,
      name: userData.name,
      coren: userData.coren,
      corenState: userData.corenState,
    };
    expect(versions.body).toEqual([
      {
        version: 2,
        content: "Curativo realizado na região sacral.",
        reason: "Faltou o local do curativo",
        author,
        createdAt: edited.body.editedAt,
      },
      {
        version: 1,
        content: "Curativo realizado",
        reason: null,
        author,
        createdAt: created.body.createdAt,
      },
    ]);
  });

  it("should accept an edit without a reason", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    await agent
      .put(recordUrl(patientId, recordId))
      .send({ content: "Curativo realizado com gaze", version: 1 })
      .expect(200);

    const [version] = await testDb()
      .select()
      .from(recordVersions)
      .where(eq(recordVersions.version, 2));
    expect(version?.reason).toBeNull();
  });

  it("should keep an old record editable", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);
    await adminQuery(`
      BEGIN;
      SET LOCAL session_replication_role = replica;
      UPDATE records SET created_at = now() - interval '2 years'
        WHERE id = '${recordId}';
      COMMIT;
    `);

    await agent
      .put(recordUrl(patientId, recordId))
      .send({ content: "Curativo realizado com gaze", version: 1 })
      .expect(200);
  });

  it("should audit the edit and the listing of versions", async () => {
    const { user, agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    await agent
      .put(recordUrl(patientId, recordId))
      .send({ content: "Curativo realizado com gaze", version: 1 })
      .expect(200);
    await agent.get(versionsUrl(patientId, recordId)).expect(200);

    for (const action of ["record.update", "record.list_versions"] as const) {
      expect(await findAuditLogs(eq(auditLogs.action, action))).toEqual([
        expect.objectContaining({
          userId: user.id,
          resourceType: "record",
          resourceId: recordId,
          patientId,
        }),
      ]);
    }
  });

  it("should reject an edit based on an outdated version", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);
    await agent
      .put(recordUrl(patientId, recordId))
      .send({ content: "Primeira edição", version: 1 })
      .expect(200);

    const response = await agent
      .put(recordUrl(patientId, recordId))
      .send({ content: "Edição de outra aba", version: 1 })
      .expect(409);
    expect(response.body.message).toBe(messages.RECORD_VERSION_OUTDATED);
    expect(await countRows(recordVersions)).toBe(2);
  });

  it("should accept only one of two simultaneous edits of the same version", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    const responses = await Promise.all(
      ["Edição A", "Edição B"].map((content) =>
        agent.put(recordUrl(patientId, recordId)).send({ content, version: 1 }),
      ),
    );

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await countRows(recordVersions)).toBe(2);
  });

  it("should reject an edit that does not change the content", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    const response = await agent
      .put(recordUrl(patientId, recordId))
      .send({ content: " Curativo realizado ", version: 1 })
      .expect(422);
    expect(response.body.message).toBe(messages.RECORD_CONTENT_UNCHANGED);
    expect(await countRows(recordVersions)).toBe(1);
  });

  it.each([
    [{ content: "Novo texto" }],
    [{ content: "Novo texto", version: 0 }],
    [{ content: "Novo texto", version: "1" }],
    [{ content: "   ", version: 1 }],
    [{ content: "Novo texto", version: 1, reason: "   " }],
    [{ content: "Novo texto", version: 1, reason: "a".repeat(501) }],
  ])("should reject the invalid edit %o", async (body) => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    await agent.put(recordUrl(patientId, recordId)).send(body).expect(422);
    expect(await countRows(recordVersions)).toBe(1);
  });

  it("should return 404 for a record that does not exist or belongs to another patient", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const otherPatientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    for (const url of [
      recordUrl(patientId, randomUUID()),
      recordUrl(otherPatientId, recordId),
    ]) {
      const edit = await agent
        .put(url)
        .send({ content: "Novo texto", version: 1 })
        .expect(404);
      expect(edit.body.message).toBe(messages.RECORD_NOT_FOUND);

      const list = await agent.get(`${url}/versions`).expect(404);
      expect(list.body.message).toBe(messages.RECORD_NOT_FOUND);
    }
  });

  it("should not edit a record of an archived patient, but still list its versions", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);
    await agent.post(`${API}/patients/${patientId}/archive`).expect(200);

    const response = await agent
      .put(recordUrl(patientId, recordId))
      .send({ content: "Novo texto", version: 1 })
      .expect(409);
    expect(response.body.message).toBe(messages.PATIENT_ARCHIVED);

    const versions = await agent
      .get(versionsUrl(patientId, recordId))
      .expect(200);
    expect(versions.body).toHaveLength(1);
  });

  it("should require authentication", async () => {
    const url = recordUrl(randomUUID(), randomUUID());

    await request(app)
      .put(url)
      .send({ content: "Novo texto", version: 1 })
      .expect(401);
    await request(app).get(`${url}/versions`).expect(401);
  });

  it("should not let another nurse edit a record or see its versions", async () => {
    const { agent: owner } = await signedInAgent();
    const patientId = await createPatient(owner);
    const recordId = await createRecord(owner, patientId);
    const { agent: other } = await signedInAgent({ email: "ana@example.com" });

    const edit = await other
      .put(recordUrl(patientId, recordId))
      .send({ content: "Invasão", version: 1 })
      .expect(404);
    expect(edit.body.message).toBe(messages.PATIENT_NOT_FOUND);

    const list = await other.get(versionsUrl(patientId, recordId)).expect(404);
    expect(list.body.message).toBe(messages.RECORD_NOT_FOUND);

    const versions = await testDb().select().from(recordVersions);
    expect(versions.map((v) => v.content)).toEqual(["Curativo realizado"]);
  });
});
