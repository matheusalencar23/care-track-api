import { eq } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { CURRENT_TERMS_VERSION } from "../../src/modules/terms/terms.js";
import { termsAcceptances } from "../../src/modules/terms/termsAcceptance.model.js";
import { users } from "../../src/modules/user/user.model.js";
import { adminQuery, appClient, countRows, testDb } from "./database.js";
import { API, createVerifiedUser, userData } from "./helpers.js";

const findAcceptances = async () =>
  await testDb().select().from(termsAcceptances);

describe("terms acceptance", () => {
  it("should record the accepted version at signup, with the server time", async () => {
    const before = new Date();

    await request(app).post(`${API}/users/signup`).send(userData).expect(201);

    const [user] = await testDb()
      .select()
      .from(users)
      .where(eq(users.email, userData.email));
    const acceptances = await findAcceptances();

    expect(acceptances).toEqual([
      {
        id: expect.any(String),
        userId: user!.id,
        termsVersion: CURRENT_TERMS_VERSION,
        acceptedAt: expect.any(Date),
      },
    ]);
    expect(acceptances[0]!.acceptedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 1000,
    );
  });

  it.each([
    [undefined, "É preciso aceitar os termos de uso"],
    [
      "2020-01-01",
      "Os termos de uso foram atualizados. Recarregue a página e aceite a versão atual.",
    ],
  ])(
    "should reject a signup with terms version %s",
    async (acceptedTermsVersion, message) => {
      const response = await request(app)
        .post(`${API}/users/signup`)
        .send({ ...userData, acceptedTermsVersion })
        .expect(422);

      expect(response.body.errors).toEqual([
        { location: "body", path: "acceptedTermsVersion", message },
      ]);
      expect(await countRows(users)).toBe(0);
      expect(await countRows(termsAcceptances)).toBe(0);
    },
  );

  it("should not record an acceptance when the signup fails", async () => {
    await createVerifiedUser();

    await request(app).post(`${API}/users/signup`).send(userData).expect(400);

    expect(await countRows(termsAcceptances)).toBe(0);
  });

  it("should ignore an acceptance time sent by the API", async () => {
    const user = await createVerifiedUser();
    const client = await appClient();

    try {
      await client.query(
        "INSERT INTO terms_acceptances (user_id, terms_version, accepted_at) VALUES ($1, $2, '2000-01-01')",
        [user.id, CURRENT_TERMS_VERSION],
      );
    } finally {
      client.release();
    }

    const [acceptance] = await findAcceptances();
    expect(acceptance!.acceptedAt.getFullYear()).toBeGreaterThan(2000);
  });

  describe("append-only", () => {
    const createAcceptance = async () => {
      await request(app).post(`${API}/users/signup`).send(userData).expect(201);
      const [acceptance] = await findAcceptances();
      return acceptance!;
    };

    it.each([
      ["UPDATE terms_acceptances SET terms_version = 'outra'"],
      ["DELETE FROM terms_acceptances"],
      ["TRUNCATE terms_acceptances"],
    ])("should deny %s to the API user", async (statement) => {
      await createAcceptance();
      const client = await appClient();

      try {
        await expect(client.query(statement)).rejects.toThrow(
          "permission denied",
        );
      } finally {
        client.release();
      }

      expect(await countRows(termsAcceptances)).toBe(1);
    });

    it.each([
      ["UPDATE terms_acceptances SET terms_version = 'outra'"],
      ["DELETE FROM terms_acceptances"],
      ["TRUNCATE terms_acceptances"],
    ])("should reject %s even for the schema owner", async (statement) => {
      const acceptance = await createAcceptance();

      await expect(adminQuery(statement)).rejects.toThrow("append-only");

      expect(await findAcceptances()).toEqual([acceptance]);
    });
  });
});
