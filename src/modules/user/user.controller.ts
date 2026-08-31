import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import * as userService from "./user.service.js";
import { login } from "../auth/auth.service.js";
import { NODE_ENV } from "../../config/secrets.js";
import {
  UnauthorizedException,
  UnprocessableEntityException,
} from "../../shared/exceptions/index.js";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { name, email, password } = req.body;
  AppLogger.info(`Create user {name=${name}, email=${email}}`);

  try {
    await userService.createUser(name, email, password);
    AppLogger.info(`User created successfully`);
    res.status(201).json({
      name,
      email,
    });
  } catch (err) {
    AppLogger.error(`Error creating user: ${err}}`);
    return next(err);
  }
};

export const signin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email, password } = req.body;
  AppLogger.info(`Logging in {email=${email}}`);

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
    AppLogger.error(`Error logging in: ${err}`);
    return next(err);
  }
};

export const me = async (req: Request, res: Response) => {
  AppLogger.info("Getting me...");
  const user = req.user;

  if (!user) {
    throw new UnauthorizedException("Unauthorized");
  }

  return res.json({
    name: user.name,
    email: user.email,
  });
};

export const validate = async (req: Request, res: Response) => {
  AppLogger.info("Validating token...");
  const token = req.query["token"] as string;

  if (!token) {
    throw new UnprocessableEntityException("Invalide validation token!", []);
  }

  await userService.validateUser(token);

  return res.json();
};

export const resendValidation = async (req: Request, res: Response) => {
  const { email } = req.body;
  AppLogger.info(`Resending confirmation email {email=${email}}`);

  await userService.resendValidation(email);

  return res.json();
};
