import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class BadRequestException extends HttpException {
  constructor(message: string) {
    super(message, HTTPStatusCode.BadRequest, null);
  }
}
