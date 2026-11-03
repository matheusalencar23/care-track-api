import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  archive,
  create,
  get,
  list,
  unarchive,
  update,
} from "../../src/modules/patient/patient.controller.js";
import {
  archivePatient,
  createPatient,
  getPatient,
  listPatients,
  unarchivePatient,
  updatePatient,
} from "../../src/modules/patient/patient.service.js";
import { UnauthorizedException } from "../../src/shared/exceptions/index.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

vi.mock("../../src/modules/patient/patient.service.js", () => ({
  archivePatient: vi.fn(),
  unarchivePatient: vi.fn(),
  createPatient: vi.fn(),
  getPatient: vi.fn(),
  listPatients: vi.fn(),
  updatePatient: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const user = {
  id: "nurse-1",
  name: "Maria Silva",
  email: "maria@example.com",
  coren: "123456",
  corenState: "SP" as const,
};

const body = {
  name: "José da Silva",
  birthDate: "1950-03-15",
  cpf: "52998224725",
  cns: undefined,
  phone: undefined,
};

const patient = { id: "patient-1", name: "José da Silva" };

describe("patientController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create the patient for the authenticated nurse and respond 201", async () => {
      vi.mocked(createPatient).mockResolvedValue(patient as never);
      const req = createMockRequest({
        user,
        body: { ...body, nurseId: "someone-else" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await create(req, res, next);

      expect(createPatient).toHaveBeenCalledWith("nurse-1", body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(patient);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({ body });
      const res = createMockResponse();
      const next = createMockNext();

      await create(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(createPatient).not.toHaveBeenCalled();
    });

    it("should call next when the service throws", async () => {
      const error = new Error("DB is down");
      vi.mocked(createPatient).mockRejectedValue(error);
      const req = createMockRequest({ user, body });
      const res = createMockResponse();
      const next = createMockNext();

      await create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("should list with the parsed query and defaults", async () => {
      const result = { items: [], page: 2, limit: 20, total: 0, totalPages: 0 };
      vi.mocked(listPatients).mockResolvedValue(result);
      const req = createMockRequest({
        user,
        query: { page: "2", search: " jose " },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await list(req, res, next);

      expect(listPatients).toHaveBeenCalledWith("nurse-1", {
        status: "active",
        page: 2,
        limit: 20,
        search: "jose",
      });
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const next = createMockNext();

      await list(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(listPatients).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("should return the patient", async () => {
      vi.mocked(getPatient).mockResolvedValue(patient as never);
      const req = createMockRequest({ user, params: { id: "patient-1" } });
      const res = createMockResponse();
      const next = createMockNext();

      await get(req, res, next);

      expect(getPatient).toHaveBeenCalledWith("nurse-1", "patient-1");
      expect(res.json).toHaveBeenCalledWith(patient);
    });

    it("should call next when the service throws", async () => {
      const error = new Error("Not found");
      vi.mocked(getPatient).mockRejectedValue(error);
      const req = createMockRequest({ user, params: { id: "patient-1" } });
      const res = createMockResponse();
      const next = createMockNext();

      await get(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("update", () => {
    it("should update the patient", async () => {
      vi.mocked(updatePatient).mockResolvedValue(patient as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1" },
        body,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await update(req, res, next);

      expect(updatePatient).toHaveBeenCalledWith("nurse-1", "patient-1", body);
      expect(res.json).toHaveBeenCalledWith(patient);
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({ params: { id: "patient-1" }, body });
      const res = createMockResponse();
      const next = createMockNext();

      await update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(updatePatient).not.toHaveBeenCalled();
    });
  });

  describe("archive", () => {
    it("should archive the patient", async () => {
      vi.mocked(archivePatient).mockResolvedValue(patient as never);
      const req = createMockRequest({ user, params: { id: "patient-1" } });
      const res = createMockResponse();
      const next = createMockNext();

      await archive(req, res, next);

      expect(archivePatient).toHaveBeenCalledWith("nurse-1", "patient-1");
      expect(res.json).toHaveBeenCalledWith(patient);
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({ params: { id: "patient-1" } });
      const res = createMockResponse();
      const next = createMockNext();

      await archive(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(archivePatient).not.toHaveBeenCalled();
    });

    it("should call next when the service throws", async () => {
      const error = new Error("Conflict");
      vi.mocked(archivePatient).mockRejectedValue(error);
      const req = createMockRequest({ user, params: { id: "patient-1" } });
      const res = createMockResponse();
      const next = createMockNext();

      await archive(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("unarchive", () => {
    it("should unarchive the patient", async () => {
      vi.mocked(unarchivePatient).mockResolvedValue(patient as never);
      const req = createMockRequest({ user, params: { id: "patient-1" } });
      const res = createMockResponse();
      const next = createMockNext();

      await unarchive(req, res, next);

      expect(unarchivePatient).toHaveBeenCalledWith("nurse-1", "patient-1");
      expect(res.json).toHaveBeenCalledWith(patient);
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({ params: { id: "patient-1" } });
      const res = createMockResponse();
      const next = createMockNext();

      await unarchive(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(unarchivePatient).not.toHaveBeenCalled();
    });
  });
});
