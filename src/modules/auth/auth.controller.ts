import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import { login } from "./auth.service.js";
import { NODE_ENV } from "../../config/secrets.js";
import { UnauthorizedException } from "../../shared/exceptions/index.js";

export const signin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email, password } = req.body;
  AppLogger.info(`Signing in {email=${email}}`);

  try {
    const token = await login(email, password);

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
