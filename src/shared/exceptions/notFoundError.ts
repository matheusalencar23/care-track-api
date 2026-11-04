import { MessageCode } from "../messages.js";
import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class NotFoundException extends HttpException {
  constructor(code: MessageCode) {
    super(code, HTTPStatusCode.NotFound, null);
  }
}
