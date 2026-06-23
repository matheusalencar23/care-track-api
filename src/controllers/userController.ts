import { NextFunction, Request, Response } from "express";
import User from "../models/user";
import { AppLogger } from "../shared/appLogger";
import { generateToken } from "../utils/tokenUtils";
import { BadRequestException } from "../shared/exceptions/badRequestError";
import { HttpException } from "../shared/exceptions/httpException";
import { createUser } from "../services/userService";
import { login } from "../services/authenticationService";

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

    res.json({
      token,
    });
  } catch (err) {
    AppLogger.error(`Error logging in: ${err}}`);
    return next(err);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  return res.json({
    name: user.name,
    email: user.email
  });
};
