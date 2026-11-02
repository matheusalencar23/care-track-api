import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import * as authService from "./auth.service.js";
import { NODE_ENV } from "../../config/secrets.js";
import { UnauthorizedException } from "../../shared/exceptions/index.js";

export const signin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email, password } = req.body;
  AppLogger.info("Signing in...");

  try {
    const token = await authService.login(email, password);

    res.cookie("token", token, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600000,
    });

    res.send();
  } catch (err) {
    AppLogger.error(`Error signing in: ${err}`);
    return next(err);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  AppLogger.info("Getting me...");
  const user = req.user;

  try {
    if (!user) {
      throw new UnauthorizedException("Unauthorized");
    }

    return res.json({
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    AppLogger.error(`Error getting me: ${err}`);
    return next(err);
  }
};

export const signout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info(`Signing out...`);

  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(204).send();
  } catch (err) {
    AppLogger.error(`Error signing out: ${err}`);
    return next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  AppLogger.info("Requesting password reset...");

  try {
    await authService.requestPasswordReset(email);
  } catch (err) {
    AppLogger.error("Error requesting password reset");
    if (err instanceof Error && err.stack) {
      AppLogger.error(err.stack);
    }
  }

  // Sempre 200, para não permitir enumeração de usuários
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

    // Sessões abertas antes da troca deixam de valer (ver
    // authenticationMiddleware); remove também o cookie deste navegador
    res.clearCookie("token", {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.json();
  } catch (err) {
    AppLogger.error("Error resetting password");
    return next(err);
  }
};
