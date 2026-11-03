import mongoose from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import AuditLog from "../../src/modules/audit/auditLog.model.js";
import Consent from "../../src/modules/consent/consent.model.js";
import { messages } from "../../src/shared/messages.js";
import { API, createVerifiedUser, userData } from "./helpers.js";

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
    const id = new mongoose.Types.ObjectId().toString();

    await request(app).get(consentsUrl(id)).expect(401);
    await request(app).post(consentsUrl(id)).send(imageConsent).expect(401);
  });

  it("should return 404 for a patient that does not exist", async () => {
    const { agent } = await signedInAgent();
    const id = new mongoose.Types.ObjectId().toString();

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
    [{ type: "publication" }],
    [{ method: "telepathy" }],
    [{ grantor: "neighbor" }],
    [{ grantor: "legal_representative" }],
    [{ representativeName: "Maria" }],
    [{ collectedAt: "2999-01-01T00:00:00Z" }],
    [{ collectedAt: "10/01/2026" }],
  ])("should reject the invalid consent %o", async (overrides) => {
    const { agent } = await signedInAgent();
    const patientId = await createPatient(agent);

    await agent
      .post(consentsUrl(patientId))
      .send({ ...imageConsent, ...overrides })
      .expect(422);
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

    it("should never reactivate or change a stored consent", async () => {
      const { user, agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const granted = await agent
        .post(consentsUrl(patientId))
        .send(imageConsent)
        .expect(201);
      await agent
        .post(`${consentsUrl(patientId)}/${granted.body.id}/revoke`)
        .expect(200);

      const consent = await Consent.findOne({
        _id: granted.body.id,
        ownerId: user._id,
      }).orFail();

      consent.method = "verbal";
      consent.status = "active";
      await expect(consent.save()).rejects.toThrow("cannot be reactivated");

      consent.status = "revoked";
      await consent.save();
      const stored = await Consent.findOne({
        _id: granted.body.id,
        ownerId: user._id,
      }).orFail();
      expect(stored.method).toBe("written");
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

      const logs = await AuditLog.find({ resourceType: "consent" })
        .sort({ createdAt: 1, _id: 1 })
        .lean();

      const consentId = new mongoose.Types.ObjectId(granted.body.id as string);
      const patientObjectId = new mongoose.Types.ObjectId(patientId);
      expect(logs).toMatchObject([
        {
          action: "consent.grant",
          userId: user._id,
          resourceId: consentId,
          patientId: patientObjectId,
        },
        {
          action: "consent.list",
          userId: user._id,
          resourceId: null,
          patientId: patientObjectId,
        },
        {
          action: "consent.revoke",
          userId: user._id,
          resourceId: consentId,
          patientId: patientObjectId,
        },
      ]);
    });
  });
});
