import { NextFunction, Request, Response } from "express";
import User from "../models/user";
import { AppError } from "../shared/appError";
import bcrypt from "bcryptjs";
import { AppLogger } from "../shared/appLogger";

export class UserController {
  static async signup(req: Request, res: Response, next: NextFunction) {
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

      AppLogger.info(`User save successfully {name=${name}, email=${email}}`);
    } catch (err) {
      AppLogger.error(`Error while saving the user: ${err}}`);
      return next(new AppError("Error while saving the user", 400));
    }
  }
}
