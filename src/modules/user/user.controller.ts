import { NextFunction, Request, Response } from "express";
import { AppLogger } from "../../shared/appLogger.js";
import { createUser } from "./user.service.js";
import { login } from "../auth/auth.service.js";
import { NODE_ENV } from "../../config/secrets.js";
import { UnauthorizedException } from "../../shared/exceptions/unauthorizedException.js";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { name, email, password } = req.body;
  AppLogger.info(`Create user {name=${name}, email=${email}}`);

  try {
    await createUser(name, email, password);
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
    AppLogger.error(`Error logging in: ${err}}`);
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
