import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HTTPStatusCode.TooManyRequests, null);
  }
}
