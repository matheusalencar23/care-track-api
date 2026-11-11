import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  storeThumbnail,
  storeThumbnailFromStorage,
} from "../../src/modules/attachment/attachment.thumbnail.js";
import * as storageService from "../../src/services/storage/storage.service.js";
import { AppLogger } from "../../src/shared/appLogger.js";

vi.mock("../../src/services/storage/storage.service.js", () => ({
  putObject: vi.fn(),
  downloadObject: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("attachmentThumbnail.storeThumbnail", () => {
  let dir: string;
  let source: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    dir = await mkdtemp(join(tmpdir(), "thumbnail-test-"));
    source = join(dir, "upload");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("should store a WebP thumbnail and remove the temporary file", async () => {
    await sharp({
      create: { width: 640, height: 480, channels: 3, background: "#c33" },
    })
      .jpeg()
      .toFile(source);

    const key = await storeThumbnail(source, "image/jpeg");

    expect(key).toMatch(/^thumbnails\//);
    expect(storageService.putObject).toHaveBeenCalledWith(
      key,
      `${source}.thumbnail.webp`,
      "image/webp",
      expect.any(Number),
    );
    expect(await readdir(dir)).toEqual(["upload"]);
  });

  it("should skip files that are not images", async () => {
    await writeFile(source, "%PDF-1.4");

    expect(await storeThumbnail(source, "application/pdf")).toBeNull();
    expect(storageService.putObject).not.toHaveBeenCalled();
  });

  it("should return null and log when the image cannot be read", async () => {
    await writeFile(source, "not an image");

    expect(await storeThumbnail(source, "image/png")).toBeNull();
    expect(storageService.putObject).not.toHaveBeenCalled();
    expect(AppLogger.warn).toHaveBeenCalledWith(
      "Thumbnail generation failed",
      expect.any(Object),
    );
    expect(await readdir(dir)).toEqual(["upload"]);
  });

  it("should return null when the storage fails", async () => {
    await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#c33" },
    })
      .png()
      .toFile(source);
    vi.mocked(storageService.putObject).mockRejectedValue(new Error("down"));

    expect(await storeThumbnail(source, "image/png")).toBeNull();
    expect(await readdir(dir)).toEqual(["upload"]);
  });
});

describe("attachmentThumbnail.storeThumbnailFromStorage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should generate the thumbnail from the stored file", async () => {
    let source = "";
    vi.mocked(storageService.downloadObject).mockImplementation(
      async (_key, path) => {
        source = path;
        await sharp({
          create: { width: 20, height: 10, channels: 3, background: "#c33" },
        })
          .png()
          .toFile(path);
      },
    );

    const key = await storeThumbnailFromStorage(
      "attachments/key",
      "image/png",
      "attachment-1",
    );

    expect(key).toMatch(/^thumbnails\//);
    expect(storageService.downloadObject).toHaveBeenCalledWith(
      "attachments/key",
      expect.any(String),
    );
    await expect(readdir(join(source, ".."))).rejects.toThrow();
  });

  it("should return null when the stored file cannot be read", async () => {
    vi.mocked(storageService.downloadObject).mockRejectedValue(
      new Error("missing"),
    );

    expect(
      await storeThumbnailFromStorage(
        "attachments/key",
        "image/png",
        "attachment-1",
      ),
    ).toBeNull();
    expect(storageService.putObject).not.toHaveBeenCalled();
    expect(AppLogger.warn).toHaveBeenCalledWith(
      "Thumbnail source download failed",
      expect.objectContaining({ attachmentId: "attachment-1" }),
    );
  });
});
