import { JwtPayload } from "jsonwebtoken";

export interface JwtUserPayload extends JwtPayload {
  _id: string;
}
