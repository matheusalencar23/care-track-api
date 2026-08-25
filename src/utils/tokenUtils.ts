import jwt from "jsonwebtoken";
import { JwtUserPayload } from "../models/jwtUserPayload.js";
import { UnauthorizedException } from "../shared/exceptions/unauthorizedException.js";
import { JWT_SECRET } from "../config/secrets.js";

export const generateToken = (body: Record<string, any>) => {
  return jwt.sign(body, JWT_SECRET, {
    expiresIn: "15m",
  });
};

export const verifyToken = (token: string): JwtUserPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtUserPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedException("Unauthorized");
    }

    throw err;
  }
};
