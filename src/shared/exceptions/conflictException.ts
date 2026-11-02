import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class ConflictException extends HttpException {
  constructor(message: string) {
    super(message, HTTPStatusCode.Conflict, null);
  }
}
