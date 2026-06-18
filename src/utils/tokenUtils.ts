import jwt from "jsonwebtoken";
import { JwtUserPayload } from "../models/jwtuserpayload";

const JWT_SECRET = process.env.JWT_SECRET ?? "";

export const generateToken = (body: Record<string, any>) =>
  jwt.sign(body, JWT_SECRET, {
    expiresIn: "15m",
  });

export const verifyToken = (token: string): JwtUserPayload =>
  jwt.verify(token, JWT_SECRET) as JwtUserPayload;
