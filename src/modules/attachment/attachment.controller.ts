import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import * as attachmentService from "./attachment.service.js";
import { UnauthorizedException } from "../../shared/exceptions/index.js";
import {
  AttachmentDownloadQuerySchema,
  ListAttachmentsQuerySchema,
} from "./attachment.schema.js";

export const assertCanUpload = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }

    await attachmentService.assertCanUpload(
      req.user.id,
      req.params["id"] as string,
    );

    return next();
  } catch (err) {
    return next(err);
  }
};

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Uploading attachment...");

  try {
    if (!req.user || !req.file) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }

    const attachment = await attachmentService.createAttachment(
      req.user.id,
      req.params["id"] as string,
      { path: req.file.path, fileName: req.body.fileName.trim() },
    );

    return res.status(201).json(attachment);
  } catch (err) {
    AppLogger.error("Error uploading attachment");
    return next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  AppLogger.info("Listing attachments...");

  try {
    if (!req.user) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }

    const page = await attachmentService.listAttachments(
      req.user.id,
      req.params["id"] as string,
      ListAttachmentsQuerySchema.parse(req.query),
    );

    return res.json(page);
  } catch (err) {
    AppLogger.error("Error listing attachments");
    return next(err);
  }
};

export const download = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Getting attachment download...");

  try {
    if (!req.user) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }

    const attachment = await attachmentService.getDownload(
      req.user.id,
      req.params["id"] as string,
      req.params["attachmentId"] as string,
      AttachmentDownloadQuerySchema.parse(req.query).disposition,
    );

    return res.json(attachment);
  } catch (err) {
    AppLogger.error("Error getting attachment download");
    return next(err);
  }
};
