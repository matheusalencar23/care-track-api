import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAttachment,
  generateThumbnail,
  getDownload,
  getThumbnails,
  listAttachments,
} from "../../src/modules/attachment/attachment.service.js";
import * as auditLogService from "../../src/modules/audit/auditLog.service.js";
import * as attachmentRepository from "../../src/modules/attachment/attachment.repository.js";
import * as attachmentFile from "../../src/modules/attachment/attachment.file.js";
import * as attachmentThumbnail from "../../src/modules/attachment/attachment.thumbnail.js";
import * as consentService from "../../src/modules/consent/consent.service.js";
import * as storageService from "../../src/services/storage/storage.service.js";
import { messages } from "../../src/shared/messages.js";

vi.mock("../../src/modules/attachment/attachment.repository.js", () => ({
  save: vi.fn(),
  findByIdForPatient: vi.fn(),
  listForPatient: vi.fn(),
  findManyForPatient: vi.fn(),
  setThumbnail: vi.fn(),
}));

vi.mock("../../src/modules/attachment/attachment.thumbnail.js", () => ({
  storeThumbnail: vi.fn(),
  storeThumbnailFromStorage: vi.fn(),
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
  assertPatientExists: vi.fn(),
}));

vi.mock("../../src/modules/consent/consent.service.js", () => ({
  hasActiveConsent: vi.fn(),
}));

vi.mock("../../src/modules/audit/auditLog.service.js", () => ({
  record: vi.fn(),
  recordMany: vi.fn(),
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

  it("should save the thumbnail generated from the file without metadata", async () => {
    vi.mocked(attachmentFile.detectContentType).mockResolvedValue("image/png");
    vi.mocked(consentService.hasActiveConsent).mockResolvedValue(true);
    vi.mocked(attachmentThumbnail.storeThumbnail).mockResolvedValue(
      "thumbnails/key",
    );

    await createAttachment("owner-1", "patient-1", file);

    expect(attachmentThumbnail.storeThumbnail).toHaveBeenCalledWith(
      file.path,
      "image/png",
    );
    expect(
      vi.mocked(attachmentFile.removeImageMetadata).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(attachmentThumbnail.storeThumbnail).mock
        .invocationCallOrder[0] as number,
    );
    expect(attachmentRepository.save).toHaveBeenCalledWith(
      "owner-1",
      "patient-1",
      expect.objectContaining({ thumbnailStorageKey: "thumbnails/key" }),
    );
  });

  it("should save the attachment without thumbnail when it is not generated", async () => {
    vi.mocked(attachmentFile.detectContentType).mockResolvedValue("image/png");
    vi.mocked(consentService.hasActiveConsent).mockResolvedValue(true);
    vi.mocked(attachmentThumbnail.storeThumbnail).mockResolvedValue(null);

    await createAttachment("owner-1", "patient-1", file);

    expect(attachmentRepository.save).toHaveBeenCalledWith(
      "owner-1",
      "patient-1",
      expect.objectContaining({ thumbnailStorageKey: null }),
    );
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

describe("attachmentService.listAttachments", () => {
  const query = { status: "active" as const, limit: 2 };
  const stored = (id: string) =>
    ({
      id,
      patientId: "patient-1",
      recordId: "record-1",
      fileName: "foto.png",
      contentType: "image/png",
      size: 10,
      sha256: "hash",
      storageKey: "attachments/key",
      createdAt: new Date("2026-11-11T10:00:00Z"),
    }) as unknown as Attachment;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the page without the storage key and audit the list", async () => {
    vi.mocked(attachmentRepository.listForPatient).mockResolvedValue({
      items: [stored("attachment-2"), stored("attachment-1")],
      hasMore: true,
    });

    const page = await listAttachments("owner-1", "patient-1", query);

    expect(attachmentRepository.listForPatient).toHaveBeenCalledWith(
      "owner-1",
      "patient-1",
      query,
    );
    expect(page.nextCursor).toBe("attachment-1");
    expect(page.items.map((item) => item.id)).toEqual([
      "attachment-2",
      "attachment-1",
    ]);
    expect(page.items[0]).not.toHaveProperty("storageKey");
    expect(auditLogService.record).toHaveBeenCalledWith({
      userId: "owner-1",
      action: "attachment.list",
      resourceType: "attachment",
      patientId: "patient-1",
    });
    expect(storageService.createDownloadUrl).not.toHaveBeenCalled();
  });

  it("should return no cursor on the last page", async () => {
    vi.mocked(attachmentRepository.listForPatient).mockResolvedValue({
      items: [stored("attachment-1")],
      hasMore: false,
    });

    const page = await listAttachments("owner-1", "patient-1", query);

    expect(page.nextCursor).toBeNull();
  });
});

describe("attachmentService.getThumbnails", () => {
  const stored = (id: string, thumbnailStorageKey: string | null) =>
    ({ id, thumbnailStorageKey }) as unknown as Attachment;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageService.createDownloadUrl).mockImplementation(
      async (key) => `https://storage/${key}`,
    );
  });

  it("should sign the thumbnails inline and audit only the released ones", async () => {
    vi.mocked(attachmentRepository.findManyForPatient).mockResolvedValue([
      stored("pdf", null),
      stored("photo", "thumbnails/photo"),
    ]);
    vi.mocked(consentService.hasActiveConsent).mockResolvedValue(true);

    const result = await getThumbnails("owner-1", "patient-1", [
      "photo",
      "pdf",
    ]);

    expect(result.items).toEqual([
      {
        attachmentId: "photo",
        status: "available",
        thumbnailUrl: "https://storage/thumbnails/photo",
        thumbnailUrlExpiresAt: expect.any(Date),
      },
      {
        attachmentId: "pdf",
        status: "unavailable",
        thumbnailUrl: null,
        thumbnailUrlExpiresAt: null,
      },
    ]);
    expect(storageService.createDownloadUrl).toHaveBeenCalledWith(
      "thumbnails/photo",
      "inline",
    );
    expect(auditLogService.recordMany).toHaveBeenCalledWith([
      {
        userId: "owner-1",
        action: "attachment.thumbnail",
        resourceType: "attachment",
        resourceId: "photo",
        patientId: "patient-1",
      },
    ]);
  });

  it("should not sign anything without consent", async () => {
    vi.mocked(attachmentRepository.findManyForPatient).mockResolvedValue([
      stored("photo", "thumbnails/photo"),
    ]);
    vi.mocked(consentService.hasActiveConsent).mockResolvedValue(false);

    const result = await getThumbnails("owner-1", "patient-1", ["photo"]);

    expect(result.items[0]).toMatchObject({
      status: "consent_required",
      thumbnailUrl: null,
    });
    expect(storageService.createDownloadUrl).not.toHaveBeenCalled();
    expect(auditLogService.recordMany).toHaveBeenCalledWith([]);
  });

  it("should not check the consent when no attachment has a thumbnail", async () => {
    vi.mocked(attachmentRepository.findManyForPatient).mockResolvedValue([
      stored("pdf", null),
    ]);

    await getThumbnails("owner-1", "patient-1", ["pdf"]);

    expect(consentService.hasActiveConsent).not.toHaveBeenCalled();
  });

  it("should fail when an attachment is not found", async () => {
    vi.mocked(attachmentRepository.findManyForPatient).mockResolvedValue([
      stored("photo", "thumbnails/photo"),
    ]);

    await expect(
      getThumbnails("owner-1", "patient-1", ["photo", "other"]),
    ).rejects.toThrow(messages.ATTACHMENT_NOT_FOUND);

    expect(auditLogService.recordMany).not.toHaveBeenCalled();
    expect(storageService.createDownloadUrl).not.toHaveBeenCalled();
  });
});

describe("attachmentService.generateThumbnail", () => {
  const stored = (contentType: string, thumbnailStorageKey: string | null) =>
    ({
      id: "attachment-1",
      patientId: "patient-1",
      contentType,
      storageKey: "attachments/key",
      thumbnailStorageKey,
    }) as unknown as Attachment;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(consentService.hasActiveConsent).mockResolvedValue(true);
    vi.mocked(storageService.createDownloadUrl).mockResolvedValue("url");
  });

  it("should generate, save and audit the missing thumbnail", async () => {
    vi.mocked(attachmentRepository.findByIdForPatient).mockResolvedValue(
      stored("image/png", null),
    );
    vi.mocked(attachmentThumbnail.storeThumbnailFromStorage).mockResolvedValue(
      "thumbnails/new",
    );
    vi.mocked(attachmentRepository.findManyForPatient).mockResolvedValue([
      stored("image/png", "thumbnails/new"),
    ]);

    const result = await generateThumbnail(
      "owner-1",
      "patient-1",
      "attachment-1",
    );

    expect(attachmentThumbnail.storeThumbnailFromStorage).toHaveBeenCalledWith(
      "attachments/key",
      "image/png",
      "attachment-1",
    );
    expect(attachmentRepository.setThumbnail).toHaveBeenCalledWith(
      "attachment-1",
      "owner-1",
      "thumbnails/new",
    );
    expect(auditLogService.record).toHaveBeenCalledWith({
      userId: "owner-1",
      action: "attachment.thumbnail_generate",
      resourceType: "attachment",
      resourceId: "attachment-1",
      patientId: "patient-1",
    });
    expect(result).toMatchObject({ status: "available", thumbnailUrl: "url" });
  });

  it("should audit the attempt without saving when the generation fails", async () => {
    vi.mocked(attachmentRepository.findByIdForPatient).mockResolvedValue(
      stored("image/png", null),
    );
    vi.mocked(attachmentThumbnail.storeThumbnailFromStorage).mockResolvedValue(
      null,
    );
    vi.mocked(attachmentRepository.findManyForPatient).mockResolvedValue([
      stored("image/png", null),
    ]);

    const result = await generateThumbnail(
      "owner-1",
      "patient-1",
      "attachment-1",
    );

    expect(attachmentRepository.setThumbnail).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "attachment.thumbnail_generate" }),
    );
    expect(result).toMatchObject({ status: "unavailable", thumbnailUrl: null });
  });

  it("should not generate again when the thumbnail exists", async () => {
    vi.mocked(attachmentRepository.findByIdForPatient).mockResolvedValue(
      stored("image/png", "thumbnails/old"),
    );
    vi.mocked(attachmentRepository.findManyForPatient).mockResolvedValue([
      stored("image/png", "thumbnails/old"),
    ]);

    await generateThumbnail("owner-1", "patient-1", "attachment-1");

    expect(
      attachmentThumbnail.storeThumbnailFromStorage,
    ).not.toHaveBeenCalled();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it("should refuse files that are not images", async () => {
    vi.mocked(attachmentRepository.findByIdForPatient).mockResolvedValue(
      stored("application/pdf", null),
    );

    await expect(
      generateThumbnail("owner-1", "patient-1", "attachment-1"),
    ).rejects.toThrow(messages.ATTACHMENT_THUMBNAIL_NOT_SUPPORTED);

    expect(
      attachmentThumbnail.storeThumbnailFromStorage,
    ).not.toHaveBeenCalled();
  });
});
