import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import * as recordService from "./record.service.js";
import { UnauthorizedException } from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";

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

    const { id, name, coren, corenState } = req.user;

    const record = await recordService.createRecord(
      { id, name, coren, corenState },
      req.params["id"] as string,
      req.body.content.trim(),
    );

    return res.status(201).json(record);
  } catch (err) {
    AppLogger.error("Error creating record");
    return next(err);
  }
};
