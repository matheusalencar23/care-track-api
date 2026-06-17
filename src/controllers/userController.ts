import { NextFunction, Request, Response } from "express";
import User from "../models/user";
import { AppError } from "../shared/appError";
import bcrypt from "bcryptjs";
import { AppLogger } from "../shared/appLogger";
import jwt from "jsonwebtoken";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { name, email, password } = req.body;
  AppLogger.info(`Start saving user {name=${name}, email=${email}}`);

  try {
    const userAlreadyExists = await User.findOne({ email });

    if (userAlreadyExists) {
      return next(new AppError("User already exists", 400));
    }

    const hash_password = await bcrypt.hash(password, 10);

    const _user = new User({
      name,
      email,
      hash_password,
    });

    const savedUser = await _user.save();

    res.status(201).json({
      name,
      email,
    });

    AppLogger.info(`User save successfully`);
  } catch (err) {
    AppLogger.error(`Error while saving the user: ${err}}`);
    return next(new AppError("Error while saving the user", 500));
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
      return next(new AppError("Invalid credentials", 400));
    }

    const isPasswordMatched = await user.authenticate(password);

    if (!isPasswordMatched) {
      return next(new AppError("Invalid credentials", 400));
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET ?? "", {
      expiresIn: 10,
    });

    res.json({
      token,
    });
  } catch (err) {
    AppLogger.error(`Error logging in: ${err}}`);
    return next(new AppError("Error logging in", 500));
  }
};
