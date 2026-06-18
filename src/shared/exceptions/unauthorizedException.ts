import { HTTPStatusCode } from "../httpStatusCode";
import { HttpException } from "./httpException";

export class UnauthorizedException extends HttpException {
  constructor(message: string) {
    super(message, HTTPStatusCode.Unauthorized, null);
  }
}
