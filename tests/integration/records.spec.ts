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
      voidedAt: null,
      voidReason: null,
      voidReasonDetails: null,
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

describe("record voiding", () => {
  const voidUrl = (patientId: string, recordId: string) =>
    `${recordUrl(patientId, recordId)}/void`;

  it("should void a record with the reason and keep its content", async () => {
    const { user, agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    const response = await agent
      .post(voidUrl(patientId, recordId))
      .send({ reason: "other", details: "  Registro feito para teste  " })
      .expect(200);

    expect(response.body).toMatchObject({
      id: recordId,
      content: "Curativo realizado",
      version: 1,
      voidedAt: expect.any(String),
      voidReason: "other",
      voidReasonDetails: "Registro feito para teste",
    });

    const [stored] = await testDb()
      .select()
      .from(records)
      .where(eq(records.id, recordId));
    expect(stored).toMatchObject({
      voidedBy: user.id,
      voidReason: "other",
      voidReasonDetails: "Registro feito para teste",
    });
    expect(await countRows(recordVersions)).toBe(1);
  });

  it("should void with a listed reason and no details", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    const response = await agent
      .post(voidUrl(patientId, recordId))
      .send({ reason: "wrong_patient" })
      .expect(200);

    expect(response.body).toMatchObject({
      voidReason: "wrong_patient",
      voidReasonDetails: null,
    });
  });

  it("should audit the voiding", async () => {
    const { user, agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    await agent
      .post(voidUrl(patientId, recordId))
      .send({ reason: "duplicate" })
      .expect(200);

    expect(await findAuditLogs(eq(auditLogs.action, "record.void"))).toEqual([
      expect.objectContaining({
        userId: user.id,
        resourceType: "record",
        resourceId: recordId,
        patientId,
      }),
    ]);
  });

  it("should not void a record twice or change the voiding", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);
    await agent
      .post(voidUrl(patientId, recordId))
      .send({ reason: "duplicate" })
      .expect(200);

    const response = await agent
      .post(voidUrl(patientId, recordId))
      .send({ reason: "wrong_patient" })
      .expect(409);
    expect(response.body.message).toBe(messages.RECORD_ALREADY_VOIDED);

    const [stored] = await testDb().select().from(records);
    expect(stored?.voidReason).toBe("duplicate");
  });

  it("should accept only one of two simultaneous voidings", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    const responses = await Promise.all(
      (["duplicate", "wrong_patient"] as const).map((reason) =>
        agent.post(voidUrl(patientId, recordId)).send({ reason }),
      ),
    );

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await findAuditLogs(eq(auditLogs.action, "record.void")),
    ).toHaveLength(1);
  });

  it("should not edit a voided record, but still list its versions", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);
    await agent
      .post(voidUrl(patientId, recordId))
      .send({ reason: "duplicate" })
      .expect(200);

    const response = await agent
      .put(recordUrl(patientId, recordId))
      .send({ content: "Novo texto", version: 1 })
      .expect(409);
    expect(response.body.message).toBe(messages.RECORD_VOIDED);

    const versions = await agent
      .get(versionsUrl(patientId, recordId))
      .expect(200);
    expect(versions.body).toHaveLength(1);
  });

  it.each([
    [{}],
    [{ reason: "mistake" }],
    [{ reason: "other" }],
    [{ reason: "other", details: "   " }],
    [{ reason: "duplicate", details: "a".repeat(501) }],
  ])("should reject the invalid voiding %o", async (body) => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    await agent.post(voidUrl(patientId, recordId)).send(body).expect(422);

    const [stored] = await testDb().select().from(records);
    expect(stored?.voidedAt).toBeNull();
  });

  it("should not void a record of an archived patient", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);
    await agent.post(`${API}/patients/${patientId}/archive`).expect(200);

    const response = await agent
      .post(voidUrl(patientId, recordId))
      .send({ reason: "duplicate" })
      .expect(409);
    expect(response.body.message).toBe(messages.PATIENT_ARCHIVED);
  });

  it("should return 404 for a record that does not exist or belongs to another patient", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const otherPatientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);

    for (const url of [
      voidUrl(patientId, randomUUID()),
      voidUrl(otherPatientId, recordId),
    ]) {
      const response = await agent
        .post(url)
        .send({ reason: "duplicate" })
        .expect(404);
      expect(response.body.message).toBe(messages.RECORD_NOT_FOUND);
    }
  });

  it("should require authentication", async () => {
    await request(app)
      .post(voidUrl(randomUUID(), randomUUID()))
      .send({ reason: "duplicate" })
      .expect(401);
  });

  it("should not let another nurse void a record", async () => {
    const { agent: owner } = await signedInAgent();
    const patientId = await createPatient(owner);
    const recordId = await createRecord(owner, patientId);
    const { agent: other } = await signedInAgent({ email: "ana@example.com" });

    const response = await other
      .post(voidUrl(patientId, recordId))
      .send({ reason: "duplicate" })
      .expect(404);
    expect(response.body.message).toBe(messages.PATIENT_NOT_FOUND);

    const [stored] = await testDb().select().from(records);
    expect(stored?.voidedAt).toBeNull();
  });
});

describe("record timeline", () => {
  type Page = {
    items: { id: string; content: string }[];
    nextCursor: string | null;
  };

  const listRecords = async (
    agent: Agent,
    patientId: string,
    query: Record<string, string | number> = {},
  ) => {
    const response = await agent
      .get(recordsUrl(patientId))
      .query(query)
      .expect(200);
    return response.body as Page;
  };

  const readAll = async (
    agent: Agent,
    patientId: string,
    query: Record<string, string | number>,
  ) => {
    const pages: Page[] = [];
    let cursor: string | null = null;

    do {
      const page: Page = await listRecords(agent, patientId, {
        ...query,
        ...(cursor && { cursor }),
      });
      pages.push(page);
      cursor = page.nextCursor;
    } while (cursor);

    return pages;
  };

  it("should list the current version of each record, newest first", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const first = await createRecord(agent, patientId, "Primeiro");
    const second = await createRecord(agent, patientId, "Segundo");
    const edited = await agent
      .put(recordUrl(patientId, first))
      .send({ content: "Primeiro, corrigido", version: 1 })
      .expect(200);

    const page = await listRecords(agent, patientId);

    expect(page).toEqual({
      items: [
        expect.objectContaining({ id: second, content: "Segundo", version: 1 }),
        edited.body,
      ],
      nextCursor: null,
    });
  });

  it("should paginate with a cursor without repeating or skipping records", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const created: string[] = [];
    for (const content of ["1", "2", "3", "4", "5"]) {
      created.push(await createRecord(agent, patientId, content));
    }

    const pages = await readAll(agent, patientId, { limit: 2 });

    expect(pages.map((page) => page.items.map((item) => item.content))).toEqual(
      [["5", "4"], ["3", "2"], ["1"]],
    );
    expect(pages.at(-1)?.nextCursor).toBeNull();
  });

  it("should not shift the next page when a record is created while paginating", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    for (const content of ["1", "2", "3"]) {
      await createRecord(agent, patientId, content);
    }

    const first = await listRecords(agent, patientId, { limit: 2 });
    await createRecord(agent, patientId, "novo");
    const second = await listRecords(agent, patientId, {
      limit: 2,
      cursor: first.nextCursor as string,
    });

    expect(first.items.map((item) => item.content)).toEqual(["3", "2"]);
    expect(second.items.map((item) => item.content)).toEqual(["1"]);
  });

  it("should break ties of the same creation time by id", async () => {
    const { user, agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    await adminQuery(
      `WITH record AS (
         INSERT INTO records (owner_id, patient_id, author_id)
         SELECT $1, $2, $1 FROM generate_series(1, 3)
         RETURNING id, owner_id, author_id
       )
       INSERT INTO record_versions (owner_id, record_id, author_id,
         author_name, author_coren, author_coren_state, content)
       SELECT owner_id, record.id, author_id, name, coren, coren_state, 'Mesmo instante'
       FROM record JOIN users ON users.id = record.author_id`,
      [user.id, patientId],
    );

    const pages = await readAll(agent, patientId, { limit: 1 });
    const ids = pages.flatMap((page) => page.items.map((item) => item.id));

    expect(ids).toHaveLength(3);
    expect(ids).toEqual([...ids].sort().reverse());
  });

  it("should hide voided records from the timeline and list them apart", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const kept = await createRecord(agent, patientId, "Mantido");
    const voided = await createRecord(agent, patientId, "Anulado");
    await agent
      .post(`${recordUrl(patientId, voided)}/void`)
      .send({ reason: "duplicate" })
      .expect(200);

    const active = await listRecords(agent, patientId);
    expect(active.items.map((item) => item.id)).toEqual([kept]);

    const voidedPage = await listRecords(agent, patientId, {
      status: "voided",
    });
    expect(voidedPage.items).toEqual([
      expect.objectContaining({
        id: voided,
        content: "Anulado",
        voidReason: "duplicate",
        voidedAt: expect.any(String),
      }),
    ]);
  });

  it("should return an empty page for a patient without records", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);

    expect(await listRecords(agent, patientId)).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("should return an empty page for a cursor of another patient", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const otherPatientId = await createPatient(agent);
    await createRecord(agent, patientId);
    const otherRecord = await createRecord(agent, otherPatientId);

    const page = await listRecords(agent, patientId, { cursor: otherRecord });

    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it("should audit the listing once for the patient", async () => {
    const { user, agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    await createRecord(agent, patientId, "1");
    await createRecord(agent, patientId, "2");

    await listRecords(agent, patientId);

    expect(await findAuditLogs(eq(auditLogs.action, "record.list"))).toEqual([
      expect.objectContaining({
        userId: user.id,
        resourceType: "record",
        resourceId: null,
        patientId,
      }),
    ]);
  });

  it("should list the records of an archived patient", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);
    const recordId = await createRecord(agent, patientId);
    await agent.post(`${API}/patients/${patientId}/archive`).expect(200);

    const page = await listRecords(agent, patientId);

    expect(page.items.map((item) => item.id)).toEqual([recordId]);
  });

  it.each([
    [{ limit: 0 }],
    [{ limit: 101 }],
    [{ limit: "abc" }],
    [{ cursor: "not-a-uuid" }],
    [{ status: "deleted" }],
  ])("should reject the invalid query %o", async (query) => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);

    await agent.get(recordsUrl(patientId)).query(query).expect(422);
  });

  it("should return 404 for a patient that does not exist", async () => {
    const { agent } = await signedInAgent();

    const response = await agent.get(recordsUrl(randomUUID())).expect(404);
    expect(response.body.message).toBe(messages.PATIENT_NOT_FOUND);
  });

  it("should require authentication", async () => {
    await request(app).get(recordsUrl(randomUUID())).expect(401);
  });

  it("should not list another nurse's records", async () => {
    const { agent: owner } = await signedInAgent();
    const patientId = await createPatient(owner);
    await createRecord(owner, patientId);
    const { user: otherUser, agent: other } = await signedInAgent({
      email: "ana@example.com",
    });

    const response = await other.get(recordsUrl(patientId)).expect(404);
    expect(response.body.message).toBe(messages.PATIENT_NOT_FOUND);

    const logs = await findAuditLogs(eq(auditLogs.userId, otherUser.id));
    expect(logs.map((log) => log.action)).not.toContain("record.list");
  });
});
