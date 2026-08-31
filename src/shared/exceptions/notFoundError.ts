import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class NotFoundException extends HttpException {
  constructor(message: string) {
    super(message, HTTPStatusCode.NotFound, null);
  }
}
