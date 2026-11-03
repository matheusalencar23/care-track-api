import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
} from "../../src/modules/patient/patient.service.js";
import * as patientRepository from "../../src/modules/patient/patient.repository.js";
import * as auditLogService from "../../src/modules/audit/auditLog.service.js";
import { NotFoundException } from "../../src/shared/exceptions/index.js";

vi.mock("../../src/modules/patient/patient.repository.js", () => ({
  save: vi.fn(),
  findByIdForNurse: vi.fn(),
  listForNurse: vi.fn(),
  updateForNurse: vi.fn(),
}));

vi.mock("../../src/modules/audit/auditLog.service.js", () => ({
  record: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createdAt = new Date("2026-11-02T10:00:00.000Z");

const patient = {
  id: "patient-1",
  name: "José da Silva",
  birthDate: new Date("1950-03-15T00:00:00.000Z"),
  cpf: "52998224725",
  cns: null,
  phone: null,
  createdAt,
  updatedAt: createdAt,
} as unknown as Awaited<ReturnType<typeof patientRepository.save>>;

const patientResponse = {
  id: "patient-1",
  name: "José da Silva",
  birthDate: "1950-03-15",
  cpf: "52998224725",
  cns: null,
  phone: null,
  createdAt,
  updatedAt: createdAt,
};

const patientData = { name: "José da Silva", birthDate: "1950-03-15" };

describe("patientService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPatient", () => {
    it("should save the patient for the nurse and record the audit", async () => {
      vi.mocked(patientRepository.save).mockResolvedValue(patient);

      await expect(createPatient("nurse-1", patientData)).resolves.toEqual(
        patientResponse,
      );

      expect(patientRepository.save).toHaveBeenCalledWith(
        "nurse-1",
        patientData,
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "nurse-1",
        action: "patient.create",
        resourceType: "patient",
        resourceId: "patient-1",
        patientId: "patient-1",
      });
    });

    it("should fail when the audit fails", async () => {
      vi.mocked(patientRepository.save).mockResolvedValue(patient);
      vi.mocked(auditLogService.record).mockRejectedValueOnce(
        new Error("DB is down"),
      );

      await expect(createPatient("nurse-1", patientData)).rejects.toThrow(
        "DB is down",
      );
    });
  });

  describe("listPatients", () => {
    it("should return the page with pagination data and record the audit", async () => {
      vi.mocked(patientRepository.listForNurse).mockResolvedValue({
        patients: [patient],
        total: 21,
      } as Awaited<ReturnType<typeof patientRepository.listForNurse>>);

      const query = { search: "jose", page: 2, limit: 20 };

      await expect(listPatients("nurse-1", query)).resolves.toEqual({
        items: [patientResponse],
        page: 2,
        limit: 20,
        total: 21,
        totalPages: 2,
      });

      expect(patientRepository.listForNurse).toHaveBeenCalledWith(
        "nurse-1",
        query,
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "nurse-1",
        action: "patient.list",
        resourceType: "patient",
      });
    });
  });

  describe("getPatient", () => {
    it("should return the nurse's patient and record the audit", async () => {
      vi.mocked(patientRepository.findByIdForNurse).mockResolvedValue(patient);

      await expect(getPatient("nurse-1", "patient-1")).resolves.toEqual(
        patientResponse,
      );

      expect(patientRepository.findByIdForNurse).toHaveBeenCalledWith(
        "patient-1",
        "nurse-1",
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "nurse-1",
        action: "patient.read",
        resourceType: "patient",
        resourceId: "patient-1",
        patientId: "patient-1",
      });
    });

    it("should throw NotFoundException without recording when the patient is not found", async () => {
      vi.mocked(patientRepository.findByIdForNurse).mockResolvedValue(null);

      await expect(getPatient("nurse-1", "patient-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe("updatePatient", () => {
    it("should update the nurse's patient and record the audit", async () => {
      vi.mocked(patientRepository.updateForNurse).mockResolvedValue(patient);

      await expect(
        updatePatient("nurse-1", "patient-1", patientData),
      ).resolves.toEqual(patientResponse);

      expect(patientRepository.updateForNurse).toHaveBeenCalledWith(
        "patient-1",
        "nurse-1",
        patientData,
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "nurse-1",
        action: "patient.update",
        resourceType: "patient",
        resourceId: "patient-1",
        patientId: "patient-1",
      });
    });

    it("should throw NotFoundException without recording when the patient is not found", async () => {
      vi.mocked(patientRepository.updateForNurse).mockResolvedValue(null);

      await expect(
        updatePatient("nurse-1", "patient-1", patientData),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });
});
