import { MessageCode } from "../messages.js";
import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";
import type { ValidationIssue } from "./unprocessableEntityException.js";

export class ConflictException extends HttpException {
  constructor(code: MessageCode, errors?: ValidationIssue[]) {
    super(code, HTTPStatusCode.Conflict, errors ?? null);
  }

  toJson() {
    if (!this._errors) {
      return super.toJson();
    }

    return {
      code: this.code,
      message: this.message,
      errors: this._errors,
      timestamp: this.timestamp,
    };
  }
}
