import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAttachment,
  getDownload,
} from "../../src/modules/attachment/attachment.service.js";
import * as auditLogService from "../../src/modules/audit/auditLog.service.js";
import * as attachmentRepository from "../../src/modules/attachment/attachment.repository.js";
import * as attachmentFile from "../../src/modules/attachment/attachment.file.js";
import * as consentService from "../../src/modules/consent/consent.service.js";
import * as storageService from "../../src/services/storage/storage.service.js";
import { messages } from "../../src/shared/messages.js";

vi.mock("../../src/modules/attachment/attachment.repository.js", () => ({
  save: vi.fn(),
  findByIdForPatient: vi.fn(),
}));

vi.mock("../../src/modules/attachment/attachment.file.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/modules/attachment/attachment.file.js")
  >("../../src/modules/attachment/attachment.file.js");
  return {
    isImage: actual.isImage,
    isVideo: actual.isVideo,
    detectContentType: vi.fn(),
    removeImageMetadata: vi.fn(),
    describeFile: vi.fn(),
  };
});

vi.mock("../../src/modules/patient/patient.service.js", () => ({
  assertPatientIsActive: vi.fn(),
}));

vi.mock("../../src/modules/consent/consent.service.js", () => ({
  hasActiveConsent: vi.fn(),
}));

vi.mock("../../src/modules/audit/auditLog.service.js", () => ({
  record: vi.fn(),
}));

vi.mock("../../src/services/storage/storage.service.js", () => ({
  putObject: vi.fn(),
  createDownloadUrl: vi.fn(),
  DOWNLOAD_URL_TTL_SECONDS: 300,
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

type Attachment = Awaited<ReturnType<typeof attachmentRepository.save>>;

const file = { path: "/tmp/upload", fileName: "foto.png" };

describe("attachmentService.createAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(attachmentFile.describeFile).mockResolvedValue({
      size: 10,
      sha256: "hash",
    });
    vi.mocked(attachmentRepository.save).mockResolvedValue({
      id: "attachment-1",
    } as unknown as Attachment);
  });

  it.each(["image/png", "video/mp4"])(
    "should refuse a %s without consent before storing it",
    async (contentType) => {
      vi.mocked(attachmentFile.detectContentType).mockResolvedValue(
        contentType,
      );
      vi.mocked(consentService.hasActiveConsent).mockResolvedValue(false);

      await expect(
        createAttachment("owner-1", "patient-1", file),
      ).rejects.toThrow(messages.ATTACHMENT_CONSENT_REQUIRED);

      expect(consentService.hasActiveConsent).toHaveBeenCalledWith(
        "owner-1",
        "patient-1",
        "image_capture",
      );
      expect(attachmentFile.removeImageMetadata).not.toHaveBeenCalled();
      expect(storageService.putObject).not.toHaveBeenCalled();
      expect(attachmentRepository.save).not.toHaveBeenCalled();
    },
  );

  it("should check the consent again before saving", async () => {
    vi.mocked(attachmentFile.detectContentType).mockResolvedValue("image/png");
    vi.mocked(consentService.hasActiveConsent)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(
      createAttachment("owner-1", "patient-1", file),
    ).rejects.toThrow(messages.ATTACHMENT_CONSENT_REQUIRED);

    expect(consentService.hasActiveConsent).toHaveBeenCalledTimes(2);
    expect(attachmentRepository.save).not.toHaveBeenCalled();
  });

  it("should not ask for consent for a PDF", async () => {
    vi.mocked(attachmentFile.detectContentType).mockResolvedValue(
      "application/pdf",
    );

    await createAttachment("owner-1", "patient-1", file);

    expect(consentService.hasActiveConsent).not.toHaveBeenCalled();
    expect(attachmentRepository.save).toHaveBeenCalled();
  });
});

describe("attachmentService.getDownload", () => {
  const stored = (contentType: string) =>
    ({
      id: "attachment-1",
      patientId: "patient-1",
      contentType,
      storageKey: "attachments/key",
    }) as unknown as Attachment;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageService.createDownloadUrl).mockResolvedValue(
      "https://storage/signed",
    );
  });

  it.each(["image/png", "video/mp4"])(
    "should not sign a URL for a %s without consent",
    async (contentType) => {
      vi.mocked(attachmentRepository.findByIdForPatient).mockResolvedValue(
        stored(contentType),
      );
      vi.mocked(consentService.hasActiveConsent).mockResolvedValue(false);

      await expect(
        getDownload("owner-1", "patient-1", "attachment-1"),
      ).rejects.toThrow(messages.ATTACHMENT_CONSENT_REQUIRED);

      expect(storageService.createDownloadUrl).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    },
  );

  it("should sign a URL for a PDF without asking for consent", async () => {
    vi.mocked(attachmentRepository.findByIdForPatient).mockResolvedValue(
      stored("application/pdf"),
    );

    await expect(
      getDownload("owner-1", "patient-1", "attachment-1"),
    ).resolves.toMatchObject({ downloadUrl: "https://storage/signed" });

    expect(consentService.hasActiveConsent).not.toHaveBeenCalled();
    expect(storageService.createDownloadUrl).toHaveBeenCalledWith(
      "attachments/key",
      "attachment",
    );
  });

  it("should sign an inline URL when asked", async () => {
    vi.mocked(attachmentRepository.findByIdForPatient).mockResolvedValue(
      stored("application/pdf"),
    );

    await getDownload("owner-1", "patient-1", "attachment-1", "inline");

    expect(storageService.createDownloadUrl).toHaveBeenCalledWith(
      "attachments/key",
      "inline",
    );
  });
});
