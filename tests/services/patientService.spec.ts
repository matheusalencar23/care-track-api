import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  archivePatient,
  createPatient,
  getPatient,
  listPatients,
  unarchivePatient,
  updatePatient,
} from "../../src/modules/patient/patient.service.js";
import * as patientRepository from "../../src/modules/patient/patient.repository.js";
import * as auditLogService from "../../src/modules/audit/auditLog.service.js";
import {
  ConflictException,
  NotFoundException,
} from "../../src/shared/exceptions/index.js";
import { messages } from "../../src/shared/messages.js";

vi.mock("../../src/modules/patient/patient.repository.js", () => ({
  save: vi.fn(),
  findByIdForOwner: vi.fn(),
  listForOwner: vi.fn(),
  update: vi.fn(),
  setArchivedAt: vi.fn(),
}));

vi.mock("../../src/modules/audit/auditLog.service.js", () => ({
  record: vi.fn(),
  recordMany: vi.fn(),
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

const buildPatient = (archivedAt: Date | null = null) =>
  ({
    id: "patient-1",
    name: "José da Silva",
    birthDate: new Date("1950-03-15T00:00:00.000Z"),
    cpf: "52998224725",
    cns: null,
    phone: null,
    archivedAt,
    createdAt,
    updatedAt: createdAt,
  }) as unknown as Awaited<ReturnType<typeof patientRepository.save>>;

const patient = buildPatient();

const patientResponse = {
  id: "patient-1",
  name: "José da Silva",
  birthDate: "1950-03-15",
  cpf: "52998224725",
  cns: null,
  phone: null,
  archivedAt: null,
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
      vi.mocked(patientRepository.listForOwner).mockResolvedValue({
        patients: [patient],
        total: 21,
      } as Awaited<ReturnType<typeof patientRepository.listForOwner>>);

      const query = {
        search: "jose",
        status: "active" as const,
        page: 2,
        limit: 20,
      };

      await expect(listPatients("nurse-1", query)).resolves.toEqual({
        items: [patientResponse],
        page: 2,
        limit: 20,
        total: 21,
        totalPages: 2,
      });

      expect(patientRepository.listForOwner).toHaveBeenCalledWith(
        "nurse-1",
        query,
      );
      expect(auditLogService.recordMany).toHaveBeenCalledWith([
        {
          userId: "nurse-1",
          action: "patient.list",
          resourceType: "patient",
          resourceId: "patient-1",
          patientId: "patient-1",
        },
      ]);
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it("should record a single entry without patient when the page is empty", async () => {
      vi.mocked(patientRepository.listForOwner).mockResolvedValue({
        patients: [],
        total: 0,
      } as Awaited<ReturnType<typeof patientRepository.listForOwner>>);

      await listPatients("nurse-1", {
        status: "active",
        page: 1,
        limit: 20,
      });

      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "nurse-1",
        action: "patient.list",
        resourceType: "patient",
      });
      expect(auditLogService.recordMany).not.toHaveBeenCalled();
    });
  });

  describe("getPatient", () => {
    it("should return the owner's patient and record the audit", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(patient);

      await expect(getPatient("nurse-1", "patient-1")).resolves.toEqual(
        patientResponse,
      );

      expect(patientRepository.findByIdForOwner).toHaveBeenCalledWith(
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
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(null);

      await expect(getPatient("nurse-1", "patient-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe("updatePatient", () => {
    it("should update the owner's patient and record the audit", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(patient);

      await expect(
        updatePatient("nurse-1", "patient-1", patientData),
      ).resolves.toEqual(patientResponse);

      expect(patientRepository.findByIdForOwner).toHaveBeenCalledWith(
        "patient-1",
        "nurse-1",
      );
      expect(patientRepository.update).toHaveBeenCalledWith(
        patient,
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
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(null);

      await expect(
        updatePatient("nurse-1", "patient-1", patientData),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(patientRepository.update).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when the patient is archived", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(createdAt),
      );

      await expect(
        updatePatient("nurse-1", "patient-1", patientData),
      ).rejects.toThrow(messages.PATIENT_ARCHIVED);
      expect(patientRepository.update).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe("archivePatient", () => {
    it("should archive the owner's patient and record the audit", async () => {
      const active = buildPatient();
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(active);

      await archivePatient("nurse-1", "patient-1");

      expect(patientRepository.setArchivedAt).toHaveBeenCalledWith(
        active,
        expect.any(Date),
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "nurse-1",
        action: "patient.archive",
        resourceType: "patient",
        resourceId: "patient-1",
        patientId: "patient-1",
      });
    });

    it("should throw NotFoundException when the patient is not found", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(null);

      await expect(
        archivePatient("nurse-1", "patient-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(patientRepository.setArchivedAt).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when the patient is already archived", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(createdAt),
      );

      await expect(archivePatient("nurse-1", "patient-1")).rejects.toThrow(
        messages.PATIENT_ALREADY_ARCHIVED,
      );
      expect(patientRepository.setArchivedAt).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe("unarchivePatient", () => {
    it("should unarchive the owner's patient and record the audit", async () => {
      const archived = buildPatient(createdAt);
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(archived);

      await unarchivePatient("nurse-1", "patient-1");

      expect(patientRepository.setArchivedAt).toHaveBeenCalledWith(
        archived,
        null,
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "nurse-1",
        action: "patient.unarchive",
        resourceType: "patient",
        resourceId: "patient-1",
        patientId: "patient-1",
      });
    });

    it("should throw ConflictException when the patient is not archived", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(),
      );

      await expect(unarchivePatient("nurse-1", "patient-1")).rejects.toThrow(
        ConflictException,
      );
      expect(patientRepository.setArchivedAt).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });
});
