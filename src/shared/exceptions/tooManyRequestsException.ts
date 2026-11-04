import { MessageCode } from "../messages.js";
import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class TooManyRequestsException extends HttpException {
  constructor(code: MessageCode) {
    super(code, HTTPStatusCode.TooManyRequests, null);
  }
}
