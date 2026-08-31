import jwt, { JwtPayload } from "jsonwebtoken";
import { UnauthorizedException } from "../shared/exceptions/index.js";
import { JWT_SECRET } from "../config/secrets.js";

interface JwtUserPayload extends JwtPayload {
  _id: string;
}

export const generateToken = (body: Record<string, unknown>) => {
  return jwt.sign(body, JWT_SECRET, {
    expiresIn: "1h",
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
