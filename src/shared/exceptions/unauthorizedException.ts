import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class UnauthorizedException extends HttpException {
  constructor(message: string) {
    super(message, HTTPStatusCode.Unauthorized, null);
  }
}
