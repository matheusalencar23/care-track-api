import { HTTPStatusCode } from "../httpStatusCode";
import { HttpException } from "./httpException";

export class BadRequestException extends HttpException {
  constructor(message: string) {
    super(message, HTTPStatusCode.BadRequest, null);
  }
}
