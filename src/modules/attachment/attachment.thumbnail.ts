import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import * as storageService from "../../services/storage/storage.service.js";
import { AppLogger } from "../../shared/appLogger.js";
import { errorDetails } from "../../shared/errorDetails.js";
import { isImage } from "./attachment.file.js";

export const THUMBNAIL_MAX_SIZE = 320;
export const THUMBNAIL_CONTENT_TYPE = "image/webp";

export const createThumbnail = async (
  sourcePath: string,
  targetPath: string,
) => {
  await sharp(sourcePath)
    .rotate()
    .resize(THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toFile(targetPath);
};

export const storeThumbnail = async (
  sourcePath: string,
  contentType: string,
  attachmentId?: string,
) => {
  if (!isImage(contentType)) {
    return null;
  }

  const thumbnailPath = `${sourcePath}.thumbnail.webp`;
  const storageKey = `thumbnails/${randomUUID()}`;

  try {
    await createThumbnail(sourcePath, thumbnailPath);
    await storageService.putObject(
      storageKey,
      thumbnailPath,
      THUMBNAIL_CONTENT_TYPE,
      (await stat(thumbnailPath)).size,
    );

    return storageKey;
  } catch (err) {
    AppLogger.warn("Thumbnail generation failed", {
      ...(attachmentId ? { attachmentId } : {}),
      ...errorDetails(err),
    });
    return null;
  } finally {
    await rm(thumbnailPath, { force: true });
  }
};

export const storeThumbnailFromStorage = async (
  storageKey: string,
  contentType: string,
  attachmentId: string,
) => {
  const workDir = await mkdtemp(join(tmpdir(), "care-track-thumbnail-"));
  const sourcePath = join(workDir, "source");

  try {
    await storageService.downloadObject(storageKey, sourcePath);
    return await storeThumbnail(sourcePath, contentType, attachmentId);
  } catch (err) {
    AppLogger.warn("Thumbnail source download failed", {
      attachmentId,
      ...errorDetails(err),
    });
    return null;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
};
