import { MessageCode } from "../messages.js";
import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class UnauthorizedException extends HttpException {
  constructor(code: MessageCode) {
    super(code, HTTPStatusCode.Unauthorized, null);
  }
}
