import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { ExifTool } from "exiftool-vendored";
import { fileTypeFromFile } from "file-type";
import { ATTACHMENT_CONTENT_TYPES } from "./attachment.model.js";

const exiftool = new ExifTool({ maxProcs: 2 });

const REMOVE_METADATA_ARGS = [
  "-all=",
  "-tagsFromFile",
  "@",
  "-Orientation",
  "-ICC_Profile",
  "-overwrite_original",
];

export const detectContentType = async (filePath: string) => {
  const mime = (await fileTypeFromFile(filePath))?.mime as string | undefined;

  return (ATTACHMENT_CONTENT_TYPES as readonly (string | undefined)[]).includes(
    mime,
  )
    ? (mime as string)
    : null;
};

export const isImage = (contentType: string) =>
  contentType.startsWith("image/");

export const isVideo = (contentType: string) =>
  contentType.startsWith("video/");

export const removeImageMetadata = async (filePath: string) => {
  await exiftool.write(
    filePath,
    {},
    { writeArgs: REMOVE_METADATA_ARGS, ignoreMinorErrors: true },
  );

  const tags = await exiftool.read(filePath);

  if (Object.keys(tags).some((tag) => tag.startsWith("GPS"))) {
    throw new Error("The image metadata could not be removed");
  }
};

export const describeFile = async (filePath: string) => {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);

  return {
    size: (await stat(filePath)).size,
    sha256: hash.digest("hex"),
  };
};

export const closeFileProcessing = async () => {
  await exiftool.end();
};
