import mongoose from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import AuditLog from "../../src/modules/audit/auditLog.model.js";
import { messages } from "../../src/shared/messages.js";
import { API, createVerifiedUser, userData } from "./helpers.js";

const patientData = {
  name: "José da Silva",
  birthDate: "1950-03-15",
  cpf: "52998224725",
  cns: "898001160660004",
  phone: "11987654321",
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

describe("patients", () => {
  it("should create, read, list and update a patient", async () => {
    const { agent } = await signedInAgent();

    const created = await agent
      .post(`${API}/patients`)
      .send(patientData)
      .expect(201);
    expect(created.body).toEqual({
      id: expect.any(String),
      ...patientData,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const id = created.body.id;

    const read = await agent.get(`${API}/patients/${id}`).expect(200);
    expect(read.body).toEqual(created.body);

    const list = await agent.get(`${API}/patients`).expect(200);
    expect(list.body).toEqual({
      items: [created.body],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });

    const updated = await agent
      .put(`${API}/patients/${id}`)
      .send({ name: "José da Silva Santos", birthDate: "1950-03-16" })
      .expect(200);
    expect(updated.body).toMatchObject({
      id,
      name: "José da Silva Santos",
      birthDate: "1950-03-16",
      cpf: null,
      cns: null,
      phone: null,
    });
  });

  it("should require authentication", async () => {
    await request(app).get(`${API}/patients`).expect(401);
    await request(app).post(`${API}/patients`).send(patientData).expect(401);
  });

  it("should validate the patient data", async () => {
    const { agent } = await signedInAgent();

    const response = await agent
      .post(`${API}/patients`)
      .send({ ...patientData, cpf: "12345678900", birthDate: "2999-01-01" })
      .expect(422);

    expect(response.body.message).toBe(messages.VALIDATION_FAILED);
  });

  it("should reject an invalid patient id", async () => {
    const { agent } = await signedInAgent();

    await agent.get(`${API}/patients/not-an-id`).expect(422);
  });

  it("should return 404 for a patient that does not exist", async () => {
    const { agent } = await signedInAgent();
    const id = new mongoose.Types.ObjectId().toString();

    const response = await agent.get(`${API}/patients/${id}`).expect(404);
    expect(response.body.message).toBe(messages.PATIENT_NOT_FOUND);
  });

  it("should reject a duplicated CPF for the same nurse", async () => {
    const { agent } = await signedInAgent();

    await agent.post(`${API}/patients`).send(patientData).expect(201);
    await agent
      .post(`${API}/patients`)
      .send({ ...patientData, cns: undefined })
      .expect(409);
  });

  describe("listing", () => {
    const createPatients = async (
      agent: ReturnType<typeof request.agent>,
      names: string[],
    ) => {
      for (const name of names) {
        await agent
          .post(`${API}/patients`)
          .send({ name, birthDate: "1980-01-01" })
          .expect(201);
      }
    };

    it("should paginate patients sorted by name", async () => {
      const { agent } = await signedInAgent();
      await createPatients(agent, ["Carla", "Ana", "Bruno"]);

      const first = await agent
        .get(`${API}/patients`)
        .query({ page: 1, limit: 2 })
        .expect(200);
      expect(first.body.items.map((p: { name: string }) => p.name)).toEqual([
        "Ana",
        "Bruno",
      ]);
      expect(first.body).toMatchObject({ total: 3, totalPages: 2 });

      const second = await agent
        .get(`${API}/patients`)
        .query({ page: 2, limit: 2 })
        .expect(200);
      expect(second.body.items.map((p: { name: string }) => p.name)).toEqual([
        "Carla",
      ]);
    });

    it("should search by name ignoring accents and case", async () => {
      const { agent } = await signedInAgent();
      await createPatients(agent, ["João Conceição", "Maria Souza"]);

      const response = await agent
        .get(`${API}/patients`)
        .query({ search: "CONCEICAO" })
        .expect(200);

      expect(response.body.items.map((p: { name: string }) => p.name)).toEqual([
        "João Conceição",
      ]);
    });

    it("should search by CPF with or without formatting", async () => {
      const { agent } = await signedInAgent();
      await agent.post(`${API}/patients`).send(patientData).expect(201);
      await createPatients(agent, ["Outro Paciente"]);

      const response = await agent
        .get(`${API}/patients`)
        .query({ search: "529.982.247-25" })
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.items[0].cpf).toBe(patientData.cpf);
    });

    it("should treat the search as text, not as a regex", async () => {
      const { agent } = await signedInAgent();
      await createPatients(agent, ["Ana"]);

      const response = await agent
        .get(`${API}/patients`)
        .query({ search: ".*" })
        .expect(200);

      expect(response.body.total).toBe(0);
    });

    it("should reject an invalid limit", async () => {
      const { agent } = await signedInAgent();

      await agent.get(`${API}/patients`).query({ limit: 101 }).expect(422);
    });
  });

  describe("isolation between nurses", () => {
    it("should not let a nurse read, list or update another nurse's patient", async () => {
      const { agent: owner } = await signedInAgent();
      const { agent: other } = await signedInAgent({
        email: "ana@example.com",
      });

      const created = await owner
        .post(`${API}/patients`)
        .send(patientData)
        .expect(201);
      const id = created.body.id;

      await other.get(`${API}/patients/${id}`).expect(404);
      await other
        .put(`${API}/patients/${id}`)
        .send({ name: "Invasor", birthDate: "1990-01-01" })
        .expect(404);

      const list = await other
        .get(`${API}/patients`)
        .query({ search: patientData.cpf })
        .expect(200);
      expect(list.body.total).toBe(0);

      const stored = await owner.get(`${API}/patients/${id}`).expect(200);
      expect(stored.body.name).toBe(patientData.name);
    });

    it("should let different nurses register the same CPF", async () => {
      const { agent: owner } = await signedInAgent();
      const { agent: other } = await signedInAgent({
        email: "ana@example.com",
      });

      await owner.post(`${API}/patients`).send(patientData).expect(201);
      await other.post(`${API}/patients`).send(patientData).expect(201);
    });
  });

  describe("audit", () => {
    it("should record every access to patients", async () => {
      const { user, agent } = await signedInAgent();

      const created = await agent
        .post(`${API}/patients`)
        .send(patientData)
        .expect(201);
      const id = created.body.id;
      await agent.get(`${API}/patients/${id}`).expect(200);
      await agent.get(`${API}/patients`).expect(200);
      await agent
        .put(`${API}/patients/${id}`)
        .send({ name: "José", birthDate: "1950-03-15" })
        .expect(200);

      const logs = await AuditLog.find({ resourceType: "patient" })
        .sort({ createdAt: 1, _id: 1 })
        .lean();

      expect(logs.map((log) => log.action)).toEqual([
        "patient.create",
        "patient.read",
        "patient.list",
        "patient.update",
      ]);
      for (const log of logs) {
        expect(log.userId).toEqual(user._id);
      }
      expect(logs[1]).toMatchObject({
        resourceId: new mongoose.Types.ObjectId(id),
        patientId: new mongoose.Types.ObjectId(id),
      });
      expect(logs[2]?.patientId).toBeNull();
    });

    it("should not record a denied access", async () => {
      const { agent: owner } = await signedInAgent();
      const { agent: other } = await signedInAgent({
        email: "ana@example.com",
      });
      const created = await owner
        .post(`${API}/patients`)
        .send(patientData)
        .expect(201);

      await other.get(`${API}/patients/${created.body.id}`).expect(404);

      expect(await AuditLog.countDocuments({ action: "patient.read" })).toBe(0);
    });
  });
});
