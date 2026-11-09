import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  archivePatient,
  assertPatientExists,
  assertPatientIsActive,
  createPatient,
  getPatient,
  listPatients,
  unarchivePatient,
  updatePatient,
} from "../../src/modules/patient/patient.service.js";
import * as patientRepository from "../../src/modules/patient/patient.repository.js";
import * as auditLogService from "../../src/modules/audit/auditLog.service.js";
import * as consentRepository from "../../src/modules/consent/consent.repository.js";
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "../../src/shared/exceptions/index.js";
import { messages } from "../../src/shared/messages.js";
import { withOwnerScope } from "../../src/db/db.js";

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

vi.mock("../../src/modules/consent/consent.repository.js", () => ({
  findEarliestCollectedAt: vi.fn(),
}));

vi.mock(
  "../../src/db/db.js",
  async () => (await import("../helpers/dbMock.js")).dbModuleMock,
);

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
    birthDate: "1950-03-15",
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
      expect(withOwnerScope).toHaveBeenCalledWith(
        "nurse-1",
        expect.any(Function),
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

  describe("assertPatientExists", () => {
    it("should resolve for a patient of the owner, even archived, without recording", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue({
        ...patient,
        archivedAt: new Date(),
      });

      await expect(
        assertPatientExists("nurse-1", "patient-1"),
      ).resolves.toBeUndefined();
      expect(withOwnerScope).toHaveBeenCalledWith(
        "nurse-1",
        expect.any(Function),
      );
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the patient is not found", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(null);

      await expect(
        assertPatientExists("nurse-1", "patient-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("assertPatientIsActive", () => {
    it("should resolve for an active patient of the owner without recording", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(patient);

      await expect(
        assertPatientIsActive("nurse-1", "patient-1"),
      ).resolves.toBeUndefined();

      expect(withOwnerScope).toHaveBeenCalledWith(
        "nurse-1",
        expect.any(Function),
      );
      expect(patientRepository.findByIdForOwner).toHaveBeenCalledWith(
        "patient-1",
        "nurse-1",
      );
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the patient is not found", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(null);

      await expect(
        assertPatientIsActive("nurse-1", "patient-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should throw ConflictException when the patient is archived", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue({
        ...patient,
        archivedAt: new Date(),
      });

      const promise = assertPatientIsActive("nurse-1", "patient-1");

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(messages.PATIENT_ARCHIVED);
    });
  });

  describe("updatePatient", () => {
    it("should update the owner's patient and record the audit", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(patient);
      vi.mocked(patientRepository.update).mockResolvedValue(patient);

      await expect(
        updatePatient("nurse-1", "patient-1", patientData),
      ).resolves.toEqual(patientResponse);

      expect(patientRepository.findByIdForOwner).toHaveBeenCalledWith(
        "patient-1",
        "nurse-1",
        "update",
      );
      expect(consentRepository.findEarliestCollectedAt).not.toHaveBeenCalled();
      expect(patientRepository.update).toHaveBeenCalledWith(
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

    it("should refuse a new birth date after the earliest consent", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(patient);
      vi.mocked(consentRepository.findEarliestCollectedAt).mockResolvedValue(
        new Date("2020-03-10T12:00:00Z"),
      );

      const promise = updatePatient("nurse-1", "patient-1", {
        ...patientData,
        birthDate: "2020-03-11",
      });

      await expect(promise).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      await expect(promise).rejects.toMatchObject({
        code: "PATIENT_BIRTH_DATE_AFTER_CONSENT",
      });
      expect(consentRepository.findEarliestCollectedAt).toHaveBeenCalledWith(
        "nurse-1",
        "patient-1",
      );
      expect(patientRepository.update).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it.each([
      ["no consent", null],
      ["a consent on the new birth date", new Date("2020-03-11T00:00:00Z")],
    ])("should accept a new birth date with %s", async (_name, earliest) => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(patient);
      vi.mocked(patientRepository.update).mockResolvedValue(patient);
      vi.mocked(consentRepository.findEarliestCollectedAt).mockResolvedValue(
        earliest,
      );

      await updatePatient("nurse-1", "patient-1", {
        ...patientData,
        birthDate: "2020-03-11",
      });

      expect(patientRepository.update).toHaveBeenCalled();
    });
  });

  describe("archivePatient", () => {
    it("should archive the owner's patient and record the audit", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(),
      );
      vi.mocked(patientRepository.setArchivedAt).mockResolvedValue(
        buildPatient(createdAt),
      );

      await expect(archivePatient("nurse-1", "patient-1")).resolves.toEqual({
        ...patientResponse,
        archivedAt: createdAt,
      });

      expect(patientRepository.setArchivedAt).toHaveBeenCalledWith(
        "patient-1",
        "nurse-1",
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
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(createdAt),
      );
      vi.mocked(patientRepository.setArchivedAt).mockResolvedValue(
        buildPatient(),
      );

      await expect(unarchivePatient("nurse-1", "patient-1")).resolves.toEqual(
        patientResponse,
      );

      expect(patientRepository.setArchivedAt).toHaveBeenCalledWith(
        "patient-1",
        "nurse-1",
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
