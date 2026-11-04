import { MessageCode } from "../messages.js";
import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export class UnprocessableEntityException extends HttpException {
  constructor(code: MessageCode, errors: string[]) {
    super(code, HTTPStatusCode.UnprocessableEntity, errors);
  }

  toJson() {
    return {
      code: this.code,
      message: this.message,
      errors: this._errors,
      timestamp: this.timestamp,
    };
  }
}
