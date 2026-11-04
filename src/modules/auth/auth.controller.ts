import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import { errorDetails } from "../../shared/errorDetails.js";
import * as authService from "./auth.service.js";
import * as auditLogService from "../audit/auditLog.service.js";
import { clearSessionCookie, setSessionCookie } from "./session.js";
import { UnauthorizedException } from "../../shared/exceptions/index.js";

export const signin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email, password } = req.body;
  AppLogger.info("Signing in...");

  try {
    const session = await authService.login(email, password);

    setSessionCookie(res, session);

    res.json({ sessionExpiresAt: session.expiresAt.toISOString() });
  } catch (err) {
    AppLogger.error("Error signing in", errorDetails(err));
    return next(err);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  AppLogger.info("Getting me...");
  const user = req.user;

  try {
    if (!user || !req.sessionExpiresAt) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }

    return res.json({
      name: user.name,
      email: user.email,
      coren: user.coren,
      corenState: user.corenState,
      sessionExpiresAt: req.sessionExpiresAt.toISOString(),
    });
  } catch (err) {
    AppLogger.error("Error getting me", errorDetails(err));
    return next(err);
  }
};

export const signout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info(`Signing out...`);
  const user = req.user;

  try {
    if (!user) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }

    await auditLogService.record({
      userId: user.id,
      action: "auth.signout",
      resourceType: "user",
      resourceId: user.id,
    });

    clearSessionCookie(res);

    return res.status(204).send();
  } catch (err) {
    AppLogger.error("Error signing out", errorDetails(err));
    return next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  AppLogger.info("Requesting password reset...");

  try {
    await authService.requestPasswordReset(email);
  } catch (err) {
    AppLogger.error("Error requesting password reset", errorDetails(err));
  }

  return res.json();
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { token, password } = req.body;
  AppLogger.info("Resetting password...");

  try {
    await authService.resetPassword(token, password);

    clearSessionCookie(res);

    return res.json();
  } catch (err) {
    AppLogger.error("Error resetting password");
    return next(err);
  }
};
