import jwt, { JwtPayload } from "jsonwebtoken";
import { UnauthorizedException } from "../shared/exceptions/index.js";
import { JWT_SECRET } from "../config/secrets.js";
import { messages } from "../shared/messages.js";

export const generateToken = (
  body: Record<string, unknown>,
  expiresAt: number,
) => {
  return jwt.sign({ ...body, exp: expiresAt }, JWT_SECRET);
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (err) {
    if (
      err instanceof jwt.TokenExpiredError ||
      err instanceof jwt.JsonWebTokenError
    ) {
      throw new UnauthorizedException(messages.UNAUTHORIZED);
    }

    throw err;
  }
};
