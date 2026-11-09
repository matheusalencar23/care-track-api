import { mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import { ATTACHMENT_MAX_SIZE_BYTES } from "../../config/secrets.js";
import { AppLogger } from "../../shared/appLogger.js";
import { errorDetails } from "../../shared/errorDetails.js";
import {
  BadRequestException,
  HttpException,
  UnprocessableEntityException,
} from "../../shared/exceptions/index.js";
import { HTTPStatusCode } from "../../shared/httpStatusCode.js";

const FILE_FIELD = "file";

export const UPLOAD_DIR = join(tmpdir(), "care-track-uploads");

mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });

const receiveFile = multer({
  dest: UPLOAD_DIR,
  defParamCharset: "utf8",
  limits: { fileSize: ATTACHMENT_MAX_SIZE_BYTES, files: 1, fields: 0 },
}).single(FILE_FIELD);

const missingFile = () =>
  new UnprocessableEntityException("VALIDATION_FAILED", [
    { location: "body", path: FILE_FIELD, message: "O arquivo é obrigatório" },
  ]);

const toUploadError = (err: unknown) => {
  if (err instanceof MulterError) {
    return err.code === "LIMIT_FILE_SIZE"
      ? new HttpException(
          "ATTACHMENT_TOO_LARGE",
          HTTPStatusCode.PayloadTooLarge,
          null,
        )
      : missingFile();
  }

  return (err as NodeJS.ErrnoException).code
    ? err
    : new BadRequestException("INVALID_REQUEST_BODY");
};

export const uploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.once("close", () => {
    if (req.file) {
      rm(req.file.path, { force: true }).catch((err) => {
        AppLogger.error("Error removing temporary upload", errorDetails(err));
      });
    }
  });

  receiveFile(req, res, (err: unknown) => {
    if (err) {
      return next(toUploadError(err));
    }

    if (!req.file) {
      return next(missingFile());
    }

    req.body = { fileName: req.file.originalname };

    return next();
  });
};
