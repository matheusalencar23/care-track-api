import type { PoolClient } from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { API, createVerifiedUser, userData } from "./helpers.js";
import { adminQuery, appClient } from "./database.js";

describe("owner scope (row-level security)", () => {
  let ownerId: string;
  let otherId: string;
  let patientId: string;
  let client: PoolClient;

  const inScope = async <T>(
    scopeOwnerId: string,
    callback: () => Promise<T>,
  ) => {
    await client.query("BEGIN");
    try {
      await client.query("SELECT set_config('app.owner_id', $1, true)", [
        scopeOwnerId,
      ]);
      return await callback();
    } finally {
      await client.query("ROLLBACK");
    }
  };

  beforeEach(async () => {
    const owner = await createVerifiedUser();
    const other = await createVerifiedUser({ email: "ana@example.com" });
    ownerId = owner.id;
    otherId = other.id;

    const agent = request.agent(app);
    await agent
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: userData.password })
      .expect(200);
    const created = await agent
      .post(`${API}/patients`)
      .send({ name: "José da Silva", birthDate: "1950-03-15" })
      .expect(201);
    patientId = created.body.id;

    client = await appClient();
  });

  afterEach(() => {
    client.release();
  });

  it.each([
    ["SELECT * FROM patients"],
    ["SELECT count(*) FROM patients"],
    ["UPDATE patients SET name = 'X'"],
    ["SELECT * FROM consents"],
  ])("should reject %s outside of an owner scope", async (statement) => {
    await expect(client.query(statement)).rejects.toThrow(
      "Owner scope is not set",
    );
  });

  it("should only show the rows of the owner in scope", async () => {
    const own = await inScope(ownerId, () =>
      client.query("SELECT id FROM patients"),
    );
    expect(own.rows).toEqual([{ id: patientId }]);

    const other = await inScope(otherId, () =>
      client.query("SELECT id FROM patients"),
    );
    expect(other.rows).toEqual([]);
  });

  it("should not update another owner's rows, even without a WHERE on owner_id", async () => {
    const result = await inScope(otherId, () =>
      client.query("UPDATE patients SET name = 'Invasor' WHERE id = $1", [
        patientId,
      ]),
    );
    expect(result.rowCount).toBe(0);

    const stored = await adminQuery("SELECT name FROM patients WHERE id = $1", [
      patientId,
    ]);
    expect(stored.rows).toEqual([{ name: "José da Silva" }]);
  });

  it("should not insert a row for another owner", async () => {
    await expect(
      inScope(otherId, () =>
        client.query(
          `INSERT INTO patients (owner_id, name, search_name, birth_date)
           VALUES ($1, 'Ana', 'ana', '1980-01-01')`,
          [ownerId],
        ),
      ),
    ).rejects.toThrow("row-level security");
  });

  it("should not let the API change the owner or delete a patient", async () => {
    await expect(
      inScope(ownerId, () =>
        client.query("UPDATE patients SET owner_id = $1", [otherId]),
      ),
    ).rejects.toThrow("permission denied");

    await expect(
      inScope(ownerId, () => client.query("DELETE FROM patients")),
    ).rejects.toThrow("permission denied");
  });

  it("should not change the owner of a patient even for the schema owner", async () => {
    await expect(
      adminQuery("UPDATE patients SET owner_id = $1 WHERE id = $2", [
        otherId,
        patientId,
      ]),
    ).rejects.toThrow("cannot change");
  });

  it("should not link a consent to another owner's patient", async () => {
    await expect(
      adminQuery(
        `INSERT INTO consents (owner_id, patient_id, type, method, grantor, collected_at)
         VALUES ($1, $2, 'image_capture', 'written', 'patient', now())`,
        [otherId, patientId],
      ),
    ).rejects.toThrow("consents_patient_fk");
  });

  it("should not keep the scope after the transaction ends", async () => {
    await inScope(ownerId, () => client.query("SELECT id FROM patients"));

    await expect(client.query("SELECT * FROM patients")).rejects.toThrow(
      "Owner scope is not set",
    );
  });
});
