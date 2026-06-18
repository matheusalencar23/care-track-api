import { NextFunction, Request, Response } from "express";
import User from "../models/user";
import { AppLogger } from "../shared/appLogger";
import { generateToken } from "../utils/tokenUtils";
import { BadRequestException } from "../shared/exceptions/badRequestError";
import { HttpException } from "../shared/exceptions/httpException";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { name, email, password } = req.body;
  AppLogger.info(`Create user {name=${name}, email=${email}}`);

  try {
    const userAlreadyExists = await User.findOne({ email });

    if (userAlreadyExists) {
      return next(new BadRequestException("User already exists"));
    }

    const _user = new User({
      name,
      email,
      password,
    });

    await _user.save();

    AppLogger.info(`User created successfully`);
    res.status(201).json({
      name,
      email,
    });
  } catch (err) {
    AppLogger.error(`Error creating user: ${err}}`);
    return next(new HttpException("Internal Server Error", 500, null));
  }
};

export const signin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return next(new BadRequestException("Invalid credentials"));
    }

    const isPasswordMatched = await user.authenticate(password);

    if (!isPasswordMatched) {
      return next(new BadRequestException("Invalid credentials"));
    }

    const token = generateToken({ _id: user._id });

    res.json({
      token,
    });
  } catch (err) {
    AppLogger.error(`Error logging in: ${err}}`);
    return next(new HttpException("Internal Server Error", 500, null));
  }
};
