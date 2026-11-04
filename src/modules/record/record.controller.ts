import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import * as recordService from "./record.service.js";
import { UnauthorizedException } from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";

const toAuthor = ({
  id,
  name,
  coren,
  corenState,
}: NonNullable<Request["user"]>) => ({ id, name, coren, corenState });

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Creating record...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const record = await recordService.createRecord(
      toAuthor(req.user),
      req.params["id"] as string,
      req.body.content.trim(),
    );

    return res.status(201).json(record);
  } catch (err) {
    AppLogger.error("Error creating record");
    return next(err);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Updating record...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const { content, version, reason } = req.body;

    const record = await recordService.updateRecord(
      toAuthor(req.user),
      req.params["id"] as string,
      req.params["recordId"] as string,
      {
        content: content.trim(),
        version,
        ...(reason !== undefined && { reason: reason.trim() }),
      },
    );

    return res.json(record);
  } catch (err) {
    AppLogger.error("Error updating record");
    return next(err);
  }
};

export const listVersions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Listing record versions...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const versions = await recordService.listRecordVersions(
      req.user.id,
      req.params["id"] as string,
      req.params["recordId"] as string,
    );

    return res.json(versions);
  } catch (err) {
    AppLogger.error("Error listing record versions");
    return next(err);
  }
};

export const voidRecord = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Voiding record...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const { reason, details } = req.body;

    const record = await recordService.voidRecord(
      req.user.id,
      req.params["id"] as string,
      req.params["recordId"] as string,
      {
        reason,
        ...(details !== undefined && { details: details.trim() }),
      },
    );

    return res.json(record);
  } catch (err) {
    AppLogger.error("Error voiding record");
    return next(err);
  }
};
