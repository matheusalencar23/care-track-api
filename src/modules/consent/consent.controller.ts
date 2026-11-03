import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import * as consentService from "./consent.service.js";
import { UnauthorizedException } from "../../shared/exceptions/index.js";
import { messages } from "../../shared/messages.js";

export const grant = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Granting consent...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const { type, method, grantor, representativeName, collectedAt } = req.body;

    const consent = await consentService.grantConsent(
      req.user.id,
      req.params["id"] as string,
      { type, method, grantor, representativeName, collectedAt },
    );

    return res.status(201).json(consent);
  } catch (err) {
    AppLogger.error("Error granting consent");
    return next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  AppLogger.info("Listing consents...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const consents = await consentService.listConsents(
      req.user.id,
      req.params["id"] as string,
    );

    return res.json(consents);
  } catch (err) {
    AppLogger.error("Error listing consents");
    return next(err);
  }
};

export const revoke = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Revoking consent...");

  try {
    if (!req.user) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    const consent = await consentService.revokeConsent(
      req.user.id,
      req.params["id"] as string,
      req.params["consentId"] as string,
      req.body?.reason,
    );

    return res.json(consent);
  } catch (err) {
    AppLogger.error("Error revoking consent");
    return next(err);
  }
};
