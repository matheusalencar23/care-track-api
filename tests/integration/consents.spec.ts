import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { auditLogs } from "../../src/modules/audit/auditLog.model.js";
import { consents } from "../../src/modules/consent/consent.model.js";
import { messages } from "../../src/shared/messages.js";
import { API, createVerifiedUser, findAuditLogs, userData } from "./helpers.js";
import { adminQuery, testDb } from "./database.js";

type Agent = ReturnType<typeof request.agent>;

const adultPatient = { name: "José da Silva", birthDate: "1950-03-15" };

const imageConsent = {
  type: "image_capture",
  method: "written",
  grantor: "patient",
};

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

const createPatient = async (agent: Agent, data = adultPatient) => {
  const response = await agent.post(`${API}/patients`).send(data).expect(201);
  return response.body.id as string;
};

const consentsUrl = (patientId: string) =>
  `${API}/patients/${patientId}/consents`;

describe("consents", () => {
  it("should grant, list and revoke a consent", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);

    const granted = await agent
      .post(consentsUrl(patientId))
      .send(imageConsent)
      .expect(201);
    expect(granted.body).toEqual({
      id: expect.any(String),
      patientId,
      ...imageConsent,
      representativeName: null,
      collectedAt: expect.any(String),
      status: "active",
      needsRenewal: false,
      revokedAt: null,
      revocationReason: null,
      createdAt: expect.any(String),
    });

    const list = await agent.get(consentsUrl(patientId)).expect(200);
    expect(list.body).toEqual([granted.body]);

    const revoked = await agent
      .post(`${consentsUrl(patientId)}/${granted.body.id}/revoke`)
      .send({ reason: "Paciente pediu a revogação" })
      .expect(200);
    expect(revoked.body).toMatchObject({
      id: granted.body.id,
      status: "revoked",
      revokedAt: expect.any(String),
      revocationReason: "Paciente pediu a revogação",
    });
  });

  it("should require authentication", async () => {
    const id = randomUUID();

    await request(app).get(consentsUrl(id)).expect(401);
    await request(app).post(consentsUrl(id)).send(imageConsent).expect(401);
  });

  it("should return 404 for a patient that does not exist", async () => {
    const { agent } = await signedInAgent();
    const id = randomUUID();

    const response = await agent
      .post(consentsUrl(id))
      .send(imageConsent)
      .expect(404);
    expect(response.body.message).toBe(messages.PATIENT_NOT_FOUND);
  });

  it("should keep the collection date informed by the nurse", async () => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);

    const response = await agent
      .post(consentsUrl(patientId))
      .send({ ...imageConsent, collectedAt: "2026-01-10T14:30:00-03:00" })
      .expect(201);

    expect(response.body.collectedAt).toBe("2026-01-10T17:30:00.000Z");
  });

  it.each([
    [{ type: "publication" }, "type"],
    [{ method: "telepathy" }, "method"],
    [{ grantor: "neighbor" }, "grantor"],
    [{ grantor: "legal_representative" }, "representativeName"],
    [{ representativeName: "Maria" }, "representativeName"],
    [{ collectedAt: "2999-01-01T00:00:00Z" }, "collectedAt"],
    [{ collectedAt: "10/01/2026" }, "collectedAt"],
  ])("should reject the invalid consent %o", async (overrides, path) => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);

    const response = await agent
      .post(consentsUrl(patientId))
      .send({ ...imageConsent, ...overrides })
      .expect(422);

    expect(response.body.errors).toEqual([
      { location: "body", path, message: expect.any(String) },
    ]);
  });

  describe("active consent", () => {
    it("should not allow two active consents of the same type", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      await agent.post(consentsUrl(patientId)).send(imageConsent).expect(201);
      const response = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(409);
      expect(response.body.message).toBe(messages.CONSENT_ALREADY_ACTIVE);
    });

    it("should allow a new consent after revoking and keep the history", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const first = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(201);
      await agent
        .post(`${consentsUrl(patientId)}/${first.body.id}/revoke`)
        .expect(200);
      const second = await agent
        .post(consentsUrl(patientId))
        .send({ ...imageConsent, method: "verbal" })
        .expect(201);

      const list = await agent.get(consentsUrl(patientId)).expect(200);
      expect(
        list.body.map((c: { id: string; status: string }) => [c.id, c.status]),
      ).toEqual([
        [second.body.id, "active"],
        [first.body.id, "revoked"],
      ]);
    });

    it("should not revoke a consent twice", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const granted = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(201);
      const revokeUrl = `${consentsUrl(patientId)}/${granted.body.id}/revoke`;

      await agent.post(revokeUrl).expect(200);
      const response = await agent.post(revokeUrl).expect(409);
      expect(response.body.message).toBe(messages.CONSENT_ALREADY_REVOKED);
    });

    it("should never reactivate or change a stored consent, even outside the API", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const active = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(201);

      await expect(
        adminQuery("UPDATE consents SET method = 'verbal' WHERE id = $1", [
          active.body.id,
        ]),
      ).rejects.toThrow("cannot change");

      await agent
        .post(`${consentsUrl(patientId)}/${active.body.id}/revoke`)
        .expect(200);

      await expect(
        adminQuery(
          "UPDATE consents SET status = 'active', revoked_at = NULL WHERE id = $1",
          [active.body.id],
        ),
      ).rejects.toThrow("cannot be changed or reactivated");

      const [stored] = await testDb()
        .select()
        .from(consents)
        .where(eq(consents.id, active.body.id));
      expect(stored).toMatchObject({ method: "written", status: "revoked" });
    });
  });

  describe("minors", () => {
    const minorPatient = {
      name: "Pedro Souza",
      birthDate: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    };

    it("should require a legal representative for a minor patient", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, minorPatient);

      const response = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(422);
      expect(response.body.message).toBe(
        messages.CONSENT_REQUIRES_REPRESENTATIVE,
      );

      const granted = await agent
        .post(consentsUrl(patientId))
        .send({
          ...imageConsent,
          grantor: "legal_representative",
          representativeName: "Ana Souza",
        })
        .expect(201);
      expect(granted.body.representativeName).toBe("Ana Souza");
      expect(granted.body.needsRenewal).toBe(false);
    });

    it("should use the age at the collection date", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, {
        name: "Carla Lima",
        birthDate: "2000-06-15",
      });

      await agent
        .post(consentsUrl(patientId))
        .send({ ...imageConsent, collectedAt: "2018-06-14T12:00:00Z" })
        .expect(422);
      await agent
        .post(consentsUrl(patientId))
        .send({ ...imageConsent, collectedAt: "2018-06-15T12:00:00Z" })
        .expect(201);
    });
  });

  describe("renewal at the age of majority", () => {
    const formerMinor = { name: "Carla Lima", birthDate: "2000-06-15" };
    const representativeConsent = {
      ...imageConsent,
      grantor: "legal_representative",
      representativeName: "Ana Lima",
      collectedAt: "2010-01-10T12:00:00Z",
    };

    it("should flag the consent given while the patient was a minor", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, formerMinor);

      const granted = await agent
        .post(consentsUrl(patientId))
        .send(representativeConsent)
        .expect(201);
      expect(granted.body).toMatchObject({
        status: "active",
        needsRenewal: true,
      });

      const list = await agent.get(consentsUrl(patientId)).expect(200);
      expect(list.body).toEqual([granted.body]);
    });

    it("should not flag a representative's consent collected in adulthood", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, formerMinor);

      const granted = await agent
        .post(consentsUrl(patientId))
        .send({
          ...representativeConsent,
          collectedAt: "2018-06-15T12:00:00Z",
        })
        .expect(201);
      expect(granted.body.needsRenewal).toBe(false);

      await agent.post(consentsUrl(patientId)).send(imageConsent).expect(409);
    });

    it("should follow a correction of the birth date", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, formerMinor);
      await agent
        .post(consentsUrl(patientId))
        .send({
          ...representativeConsent,
          collectedAt: "2018-06-15T12:00:00Z",
        })
        .expect(201);

      await agent
        .put(`${API}/patients/${patientId}`)
        .send({ ...formerMinor, birthDate: "2001-06-15" })
        .expect(200);

      const list = await agent.get(consentsUrl(patientId)).expect(200);
      expect(list.body[0].needsRenewal).toBe(true);
    });

    it("should replace the expired consent in a single request and keep the history", async () => {
      const { user, agent } = await signedInAgent();
      const patientId = await createPatient(agent, formerMinor);
      const expired = await agent
        .post(consentsUrl(patientId))
        .send(representativeConsent)
        .expect(201);

      const renewed = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(201);
      expect(renewed.body).toMatchObject({
        status: "active",
        grantor: "patient",
        needsRenewal: false,
      });

      const list = await agent.get(consentsUrl(patientId)).expect(200);
      expect(list.body).toMatchObject([
        { id: renewed.body.id, status: "active", needsRenewal: false },
        {
          id: expired.body.id,
          status: "revoked",
          needsRenewal: false,
          revokedAt: expect.any(String),
          revocationReason: "Renovação: o paciente completou 18 anos.",
        },
      ]);

      const logs = await findAuditLogs(eq(auditLogs.resourceType, "consent"));
      expect(logs).toMatchObject([
        { action: "consent.grant", resourceId: expired.body.id },
        { action: "consent.revoke", resourceId: expired.body.id },
        {
          action: "consent.grant",
          userId: user.id,
          resourceId: renewed.body.id,
          patientId,
        },
        { action: "consent.list" },
      ]);
    });

    it("should still accept revoking the expired consent before granting", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, formerMinor);
      const expired = await agent
        .post(consentsUrl(patientId))
        .send(representativeConsent)
        .expect(201);

      await agent
        .post(`${consentsUrl(patientId)}/${expired.body.id}/revoke`)
        .send({ reason: "Paciente pediu a revogação" })
        .expect(200);
      await agent.post(consentsUrl(patientId)).send(imageConsent).expect(201);
    });

    it("should let only one of two simultaneous renewals succeed", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, formerMinor);
      await agent
        .post(consentsUrl(patientId))
        .send(representativeConsent)
        .expect(201);

      const responses = await Promise.all([
        agent.post(consentsUrl(patientId)).send(imageConsent),
        agent.post(consentsUrl(patientId)).send(imageConsent),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);

      const stored = await testDb()
        .select()
        .from(consents)
        .where(eq(consents.status, "active"));
      expect(stored).toHaveLength(1);
    });

    it("should not let another nurse renew the consent", async () => {
      const { agent: owner } = await signedInAgent();
      const { agent: other } = await signedInAgent({
        email: "ana@example.com",
      });
      const patientId = await createPatient(owner, formerMinor);
      const expired = await owner
        .post(consentsUrl(patientId))
        .send(representativeConsent)
        .expect(201);

      await other.post(consentsUrl(patientId)).send(imageConsent).expect(404);

      const list = await owner.get(consentsUrl(patientId)).expect(200);
      expect(list.body).toEqual([expired.body]);
    });

    it("should not renew the consent of an archived patient", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, formerMinor);
      await agent
        .post(consentsUrl(patientId))
        .send(representativeConsent)
        .expect(201);
      await agent.post(`${API}/patients/${patientId}/archive`).expect(200);

      const response = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(409);
      expect(response.body.message).toBe(messages.PATIENT_ARCHIVED);
    });
  });

  describe("archived patient", () => {
    it("should not grant a consent to an archived patient", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      await agent.post(`${API}/patients/${patientId}/archive`).expect(200);

      const response = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(409);
      expect(response.body.message).toBe(messages.PATIENT_ARCHIVED);
    });

    it("should still list and revoke consents of an archived patient", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const granted = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(201);
      await agent.post(`${API}/patients/${patientId}/archive`).expect(200);

      await agent.get(consentsUrl(patientId)).expect(200);
      await agent
        .post(`${consentsUrl(patientId)}/${granted.body.id}/revoke`)
        .expect(200);
    });
  });

  describe("isolation between nurses", () => {
    it("should not let a nurse grant, list or revoke another nurse's consents", async () => {
      const { agent: owner } = await signedInAgent();
      const { agent: other } = await signedInAgent({
        email: "ana@example.com",
      });
      const patientId = await createPatient(owner);
      const granted = await owner
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(201);

      await other.post(consentsUrl(patientId)).send(imageConsent).expect(404);
      await other.get(consentsUrl(patientId)).expect(404);
      await other
        .post(`${consentsUrl(patientId)}/${granted.body.id}/revoke`)
        .expect(404);

      const list = await owner.get(consentsUrl(patientId)).expect(200);
      expect(list.body).toEqual([granted.body]);
    });

    it("should not revoke a consent through another patient", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const otherPatientId = await createPatient(agent, {
        name: "Ana",
        birthDate: "1980-01-01",
      });
      const granted = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(201);

      const response = await agent
        .post(`${consentsUrl(otherPatientId)}/${granted.body.id}/revoke`)
        .expect(404);
      expect(response.body.message).toBe(messages.CONSENT_NOT_FOUND);
    });
  });

  describe("audit", () => {
    it("should record grant, list and revoke", async () => {
      const { user, agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const granted = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(201);
      await agent.get(consentsUrl(patientId)).expect(200);
      await agent
        .post(`${consentsUrl(patientId)}/${granted.body.id}/revoke`)
        .expect(200);

      const logs = await findAuditLogs(eq(auditLogs.resourceType, "consent"));

      const consentId = granted.body.id as string;
      expect(logs).toMatchObject([
        {
          action: "consent.grant",
          userId: user.id,
          resourceId: consentId,
          patientId,
        },
        {
          action: "consent.list",
          userId: user.id,
          resourceId: null,
          patientId,
        },
        {
          action: "consent.revoke",
          userId: user.id,
          resourceId: consentId,
          patientId,
        },
      ]);
    });
  });
});
