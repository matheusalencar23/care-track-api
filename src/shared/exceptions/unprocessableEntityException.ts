import { MessageCode } from "../messages.js";
import { HTTPStatusCode } from "../httpStatusCode.js";
import { HttpException } from "./httpException.js";

export interface ValidationIssue {
  location: "body" | "query" | "params";
  path: string;
  message: string;
}

export class UnprocessableEntityException extends HttpException {
  constructor(code: MessageCode, errors: ValidationIssue[]) {
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
