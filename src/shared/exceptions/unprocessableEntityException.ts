import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class UnprocessableEntityException extends HttpException {
  constructor(message: string, errors: string[]) {
    super(message, HTTPStatusCode.UnprocessableEntity, errors);
  }

  toJson() {
    return {
      message: this.message,
      errors: this._errors,
      timestamp: this.timestamp,
    };
  }
}
