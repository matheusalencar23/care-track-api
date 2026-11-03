import type { PoolClient } from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { API, createVerifiedUser, userData } from "./helpers.js";
import { adminQuery, appClient } from "./database.js";

const INSERT_RECORD = `
  WITH record AS (
    INSERT INTO records (owner_id, patient_id, author_id)
    VALUES ($1, $2, $1)
    RETURNING id, owner_id, author_id
  )
  INSERT INTO record_versions (owner_id, record_id, author_id, content)
  SELECT owner_id, id, author_id, $3 FROM record
  RETURNING record_id, version, content`;

const INSERT_VERSION = `
  INSERT INTO record_versions (owner_id, record_id, author_id, content, reason, version)
  VALUES ($1, $2, $1, $3, $4, 7)
  RETURNING version`;

describe("records tables", () => {
  let ownerId: string;
  let otherId: string;
  let patientId: string;
  let otherPatientId: string;
  let client: PoolClient;

  const inScope = async <T>(
    scopeOwnerId: string,
    callback: () => Promise<T>,
    { commit = false } = {},
  ) => {
    await client.query("BEGIN");
    try {
      await client.query("SELECT set_config('app.owner_id', $1, true)", [
        scopeOwnerId,
      ]);
      const result = await callback();
      if (commit) {
        await client.query("COMMIT");
      }
      return result;
    } finally {
      await client.query("ROLLBACK");
    }
  };

  const createPatient = async (email: string) => {
    const agent = request.agent(app);
    await agent
      .post(`${API}/auth/signin`)
      .send({ email, password: userData.password })
      .expect(200);
    const created = await agent
      .post(`${API}/patients`)
      .send({ name: "José da Silva", birthDate: "1950-03-15" })
      .expect(201);

    return created.body.id as string;
  };

  const insertRecord = async (content: string | null = "Paciente estável") => {
    const result = await adminQuery(INSERT_RECORD, [
      ownerId,
      patientId,
      content,
    ]);

    return result.rows[0].record_id as string;
  };

  beforeEach(async () => {
    const owner = await createVerifiedUser();
    const other = await createVerifiedUser({ email: "ana@example.com" });
    ownerId = owner.id;
    otherId = other.id;
    patientId = await createPatient(userData.email);
    otherPatientId = await createPatient("ana@example.com");

    client = await appClient();
  });

  afterEach(() => {
    client.release();
  });

  it.each([["SELECT * FROM records"], ["SELECT * FROM record_versions"]])(
    "should reject %s outside of an owner scope",
    async (statement) => {
      await expect(client.query(statement)).rejects.toThrow(
        "Owner scope is not set",
      );
    },
  );

  it("should let the API create a record and append versions numbered by the database", async () => {
    await inScope(
      ownerId,
      async () => {
        const created = await client.query(INSERT_RECORD, [
          ownerId,
          patientId,
          "Paciente estável",
        ]);
        const recordId = created.rows[0].record_id;
        await client.query(INSERT_VERSION, [
          ownerId,
          recordId,
          "Paciente estável, sem queixas",
          "Complemento da avaliação",
        ]);
      },
      { commit: true },
    );

    const versions = await adminQuery(
      "SELECT version, content, reason FROM record_versions ORDER BY version",
    );
    expect(versions.rows).toEqual([
      { version: 1, content: "Paciente estável", reason: null },
      {
        version: 2,
        content: "Paciente estável, sem queixas",
        reason: "Complemento da avaliação",
      },
    ]);
  });

  it("should only show the records and versions of the owner in scope", async () => {
    const recordId = await insertRecord();

    const own = await inScope(ownerId, () =>
      client.query(
        "SELECT r.id FROM records r JOIN record_versions v ON v.record_id = r.id",
      ),
    );
    expect(own.rows).toEqual([{ id: recordId }]);

    const other = await inScope(otherId, async () => ({
      records: (await client.query("SELECT id FROM records")).rows,
      versions: (await client.query("SELECT id FROM record_versions")).rows,
    }));
    expect(other).toEqual({ records: [], versions: [] });
  });

  it("should not insert a record for another owner", async () => {
    await expect(
      inScope(otherId, () =>
        client.query(INSERT_RECORD, [ownerId, patientId, "Invasão"]),
      ),
    ).rejects.toThrow("row-level security");
  });

  it("should not link a record to another owner's patient", async () => {
    await expect(
      adminQuery(INSERT_RECORD, [ownerId, otherPatientId, "Paciente errado"]),
    ).rejects.toThrow("records_patient_fk");
  });

  it("should not link a version to another owner's record", async () => {
    const recordId = await insertRecord();

    await expect(
      adminQuery(INSERT_VERSION, [otherId, recordId, "Invasão", "Motivo"]),
    ).rejects.toThrow("record_versions_record_fk");
  });

  it("should not commit a record without its first version", async () => {
    await expect(
      adminQuery(
        "INSERT INTO records (owner_id, patient_id, author_id) VALUES ($1, $2, $1)",
        [ownerId, patientId],
      ),
    ).rejects.toThrow("first version");

    await expect(
      inScope(
        ownerId,
        () =>
          client.query(
            "INSERT INTO records (owner_id, patient_id, author_id) VALUES ($1, $2, $1)",
            [ownerId, patientId],
          ),
        { commit: true },
      ),
    ).rejects.toThrow("first version");
  });

  it("should use the server time for records and versions", async () => {
    const result = await adminQuery(
      `WITH record AS (
         INSERT INTO records (owner_id, patient_id, author_id, created_at)
         VALUES ($1, $2, $1, '2000-01-01')
         RETURNING id, owner_id, author_id, created_at
       ), version AS (
         INSERT INTO record_versions (owner_id, record_id, author_id, content, created_at)
         SELECT owner_id, id, author_id, 'Retroativo', '2000-01-01' FROM record
         RETURNING created_at
       )
       SELECT record.created_at AS record_time, version.created_at AS version_time,
         now() AS server_time
       FROM record, version`,
      [ownerId, patientId],
    );

    const [row] = result.rows;
    expect(row.record_time).toEqual(row.server_time);
    expect(row.version_time).toEqual(row.server_time);
  });

  it.each([
    ["UPDATE records SET owner_id = $1", () => [otherId]],
    ["UPDATE records SET patient_id = $1", () => [patientId]],
    ["UPDATE records SET author_id = $1", () => [otherId]],
    ["UPDATE records SET created_at = now()", () => []],
    ["DELETE FROM records", () => []],
    ["UPDATE record_versions SET content = 'Reescrito'", () => []],
    ["UPDATE record_versions SET version = 9", () => []],
    ["DELETE FROM record_versions", () => []],
  ])("should not let the API run %s", async (statement, values) => {
    await insertRecord();

    await expect(
      inScope(ownerId, () => client.query(statement, values())),
    ).rejects.toThrow("permission denied");
  });

  it.each([
    ["owner_id", () => otherId],
    ["author_id", () => otherId],
    ["patient_id", () => otherPatientId],
    ["created_at", () => "2000-01-01"],
  ])(
    "should not change the %s of a record even for the schema owner",
    async (column, value) => {
      const recordId = await insertRecord();

      await expect(
        adminQuery(`UPDATE records SET ${column} = $1 WHERE id = $2`, [
          value(),
          recordId,
        ]),
      ).rejects.toThrow("cannot change");
    },
  );

  it.each([
    ["UPDATE record_versions SET content = 'Reescrito'"],
    ["DELETE FROM record_versions"],
    ["TRUNCATE record_versions"],
  ])(
    "should not let even the schema owner run %s",
    async (statement) => {
      await insertRecord();

      await expect(adminQuery(statement)).rejects.toThrow("append-only");
    },
  );

  it("should allow a version without text, for records with only files", async () => {
    await insertRecord(null);

    const versions = await adminQuery("SELECT content FROM record_versions");
    expect(versions.rows).toEqual([{ content: null }]);
  });

  it("should reject a version with blank text", async () => {
    await expect(insertRecord("   ")).rejects.toThrow(
      "record_versions_content_not_blank",
    );
  });

  it("should reject a reason on the first version and a blank reason on later ones", async () => {
    await expect(
      adminQuery(
        `WITH record AS (
           INSERT INTO records (owner_id, patient_id, author_id)
           VALUES ($1, $2, $1)
           RETURNING id, owner_id, author_id
         )
         INSERT INTO record_versions (owner_id, record_id, author_id, content, reason)
         SELECT owner_id, id, author_id, 'Texto', 'Motivo' FROM record`,
        [ownerId, patientId],
      ),
    ).rejects.toThrow("record_versions_first_without_reason");

    const recordId = await insertRecord();
    await expect(
      adminQuery(INSERT_VERSION, [ownerId, recordId, "Texto novo", "  "]),
    ).rejects.toThrow("record_versions_reason_not_blank");
  });
});
