import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import { errorDetails } from "../../shared/errorDetails.js";
import * as userService from "./user.service.js";
import { UnprocessableEntityException } from "../../shared/exceptions/index.js";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { name, email, password, coren, corenState, acceptedTermsVersion } =
    req.body;
  AppLogger.info("Creating user...");

  try {
    await userService.createUser({
      name,
      email,
      password,
      coren,
      corenState,
      acceptedTermsVersion,
    });
    AppLogger.info(`User created successfully`);
    res.status(201).json({
      name,
      email,
      coren,
      corenState,
    });
  } catch (err) {
    AppLogger.error("Error creating user", errorDetails(err));
    return next(err);
  }
};

export const validate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  AppLogger.info("Validating token...");
  const token = req.query["token"] as string;

  try {
    if (!token) {
      throw new UnprocessableEntityException("INVALID_LINK_TOKEN", []);
    }

    await userService.validateUser(token);

    return res.json();
  } catch (err) {
    AppLogger.error(`Error validating user`);
    return next(err);
  }
};

export const resendValidation = async (req: Request, res: Response) => {
  const { email } = req.body;
  AppLogger.info("Resending confirmation email...");

  try {
    await userService.resendValidation(email);

    return res.json();
  } catch (err) {
    AppLogger.error("Error resending validation", errorDetails(err));
    return res.json();
  }
};
