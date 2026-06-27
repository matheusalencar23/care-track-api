import { HTTPStatusCode } from "../httpStatusCode";
import { HttpException } from "./httpException";

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
