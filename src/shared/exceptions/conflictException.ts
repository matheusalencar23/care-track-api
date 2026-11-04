import { MessageCode } from "../messages.js";
import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class ConflictException extends HttpException {
  constructor(code: MessageCode) {
    super(code, HTTPStatusCode.Conflict, null);
  }
}
