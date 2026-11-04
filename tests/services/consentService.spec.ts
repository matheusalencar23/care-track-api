import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  grantConsent,
  hasActiveConsent,
  listConsents,
  revokeConsent,
} from "../../src/modules/consent/consent.service.js";
import * as consentRepository from "../../src/modules/consent/consent.repository.js";
import * as patientRepository from "../../src/modules/patient/patient.repository.js";
import * as auditLogService from "../../src/modules/audit/auditLog.service.js";
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "../../src/shared/exceptions/index.js";
import { messages } from "../../src/shared/messages.js";
import { withOwnerScope } from "../../src/db/db.js";

vi.mock("../../src/modules/consent/consent.repository.js", () => ({
  save: vi.fn(),
  listForPatient: vi.fn(),
  findByIdForPatient: vi.fn(),
  findActive: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("../../src/modules/patient/patient.repository.js", () => ({
  findByIdForOwner: vi.fn(),
}));

vi.mock("../../src/modules/audit/auditLog.service.js", () => ({
  record: vi.fn(),
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

type Patient = Awaited<ReturnType<typeof patientRepository.findByIdForOwner>>;
type Consent = Awaited<ReturnType<typeof consentRepository.save>>;

const patientId = randomUUID();
const createdAt = new Date("2026-11-03T10:00:00.000Z");

const buildPatient = (
  birthDate = "1950-03-15",
  archivedAt: Date | null = null,
) =>
  ({
    id: patientId,
    birthDate,
    archivedAt,
  }) as unknown as Patient;

const buildConsent = (status: "active" | "revoked" = "active") =>
  ({
    id: "consent-1",
    patientId,
    type: "image_capture",
    method: "written",
    grantor: "patient",
    representativeName: null,
    collectedAt: createdAt,
    status,
    revokedAt: null,
    revocationReason: null,
    createdAt,
  }) as unknown as Consent;

const consentData = {
  type: "image_capture" as const,
  method: "written" as const,
  grantor: "patient" as const,
};

describe("consentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(consentRepository.revoke).mockResolvedValue(
      buildConsent("revoked"),
    );
  });

  describe("grantConsent", () => {
    it("should save the consent and record the audit", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(),
      );
      vi.mocked(consentRepository.findActive).mockResolvedValue(null);
      vi.mocked(consentRepository.save).mockResolvedValue(buildConsent());

      const consent = await grantConsent("owner-1", patientId, consentData);

      expect(consent).toMatchObject({
        id: "consent-1",
        patientId,
        status: "active",
      });
      expect(patientRepository.findByIdForOwner).toHaveBeenCalledWith(
        patientId,
        "owner-1",
      );
      expect(consentRepository.save).toHaveBeenCalledWith(
        "owner-1",
        patientId,
        consentData,
        expect.any(Date),
      );
      expect(withOwnerScope).toHaveBeenCalledWith(
        "owner-1",
        expect.any(Function),
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "owner-1",
        action: "consent.grant",
        resourceType: "consent",
        resourceId: "consent-1",
        patientId,
      });
    });

    it("should use the informed collection date", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(),
      );
      vi.mocked(consentRepository.findActive).mockResolvedValue(null);
      vi.mocked(consentRepository.save).mockResolvedValue(buildConsent());

      await grantConsent("owner-1", patientId, {
        ...consentData,
        collectedAt: "2026-01-10T17:30:00Z",
      });

      expect(consentRepository.save).toHaveBeenCalledWith(
        "owner-1",
        patientId,
        expect.anything(),
        new Date("2026-01-10T17:30:00Z"),
      );
    });

    it("should throw NotFoundException when the patient is not found", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(null);

      await expect(
        grantConsent("owner-1", patientId, consentData),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(consentRepository.save).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when the patient is archived", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient("1950-03-15", createdAt),
      );

      await expect(
        grantConsent("owner-1", patientId, consentData),
      ).rejects.toThrow(messages.PATIENT_ARCHIVED);
      expect(consentRepository.save).not.toHaveBeenCalled();
    });

    it("should require a legal representative for a minor", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient("2010-01-01"),
      );

      await expect(
        grantConsent("owner-1", patientId, {
          ...consentData,
          collectedAt: "2027-12-31T23:59:59Z",
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(consentRepository.save).not.toHaveBeenCalled();
    });

    it("should accept the patient as grantor on the 18th birthday", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient("2010-01-01"),
      );
      vi.mocked(consentRepository.findActive).mockResolvedValue(null);
      vi.mocked(consentRepository.save).mockResolvedValue(buildConsent());

      await grantConsent("owner-1", patientId, {
        ...consentData,
        collectedAt: "2028-01-01T00:00:00Z",
      });

      expect(consentRepository.save).toHaveBeenCalled();
    });

    it("should throw ConflictException when there is an active consent of the type", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(),
      );
      vi.mocked(consentRepository.findActive).mockResolvedValue(buildConsent());

      await expect(
        grantConsent("owner-1", patientId, consentData),
      ).rejects.toThrow(messages.CONSENT_ALREADY_ACTIVE);
      expect(consentRepository.save).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe("listConsents", () => {
    it("should list the patient's consents and record the audit", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(),
      );
      vi.mocked(consentRepository.listForPatient).mockResolvedValue([
        buildConsent(),
      ]);

      const consents = await listConsents("owner-1", patientId);

      expect(consents).toHaveLength(1);
      expect(consentRepository.listForPatient).toHaveBeenCalledWith(
        "owner-1",
        patientId,
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "owner-1",
        action: "consent.list",
        resourceType: "consent",
        patientId,
      });
    });

    it("should throw NotFoundException without recording when the patient is not found", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(null);

      await expect(listConsents("owner-1", patientId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(consentRepository.listForPatient).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe("revokeConsent", () => {
    it("should revoke the consent and record the audit", async () => {
      const consent = buildConsent();
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(),
      );
      vi.mocked(consentRepository.findByIdForPatient).mockResolvedValue(
        consent,
      );

      await expect(
        revokeConsent("owner-1", patientId, "consent-1", "Pedido"),
      ).resolves.toMatchObject({ id: "consent-1", status: "revoked" });

      expect(consentRepository.findByIdForPatient).toHaveBeenCalledWith(
        "consent-1",
        "owner-1",
        patientId,
      );
      expect(consentRepository.revoke).toHaveBeenCalledWith(
        "consent-1",
        "owner-1",
        "Pedido",
      );
      expect(auditLogService.record).toHaveBeenCalledWith({
        userId: "owner-1",
        action: "consent.revoke",
        resourceType: "consent",
        resourceId: "consent-1",
        patientId,
      });
    });

    it("should store a missing or blank reason as null", async () => {
      const consent = buildConsent();
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(),
      );
      vi.mocked(consentRepository.findByIdForPatient).mockResolvedValue(
        consent,
      );

      await revokeConsent("owner-1", patientId, "consent-1", "");

      expect(consentRepository.revoke).toHaveBeenCalledWith(
        "consent-1",
        "owner-1",
        null,
      );
    });

    it("should revoke even when the patient is archived", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient("1950-03-15", createdAt),
      );
      vi.mocked(consentRepository.findByIdForPatient).mockResolvedValue(
        buildConsent(),
      );

      await revokeConsent("owner-1", patientId, "consent-1", undefined);

      expect(consentRepository.revoke).toHaveBeenCalled();
    });

    it("should throw NotFoundException when the consent is not found", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(),
      );
      vi.mocked(consentRepository.findByIdForPatient).mockResolvedValue(null);

      await expect(
        revokeConsent("owner-1", patientId, "consent-1", undefined),
      ).rejects.toThrow(messages.CONSENT_NOT_FOUND);
      expect(consentRepository.revoke).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when the consent is already revoked", async () => {
      vi.mocked(patientRepository.findByIdForOwner).mockResolvedValue(
        buildPatient(),
      );
      vi.mocked(consentRepository.findByIdForPatient).mockResolvedValue(
        buildConsent("revoked"),
      );

      await expect(
        revokeConsent("owner-1", patientId, "consent-1", undefined),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(consentRepository.revoke).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe("hasActiveConsent", () => {
    it("should tell whether there is an active consent of the type", async () => {
      vi.mocked(consentRepository.findActive).mockResolvedValueOnce(
        buildConsent(),
      );
      await expect(
        hasActiveConsent("owner-1", patientId, "image_capture"),
      ).resolves.toBe(true);

      vi.mocked(consentRepository.findActive).mockResolvedValueOnce(null);
      await expect(
        hasActiveConsent("owner-1", patientId, "image_capture"),
      ).resolves.toBe(false);

      expect(consentRepository.findActive).toHaveBeenCalledWith(
        "owner-1",
        patientId,
        "image_capture",
      );
    });
  });
});
