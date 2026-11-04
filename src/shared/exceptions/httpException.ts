import { MessageCode, messages } from "../messages.js";

export class HttpException extends Error {
  protected _code: MessageCode;
  protected _statusCode: number;
  protected _errors: unknown;
  protected _timestamp: string;

  get code() {
    return this._code;
  }

  get statusCode() {
    return this._statusCode;
  }

  get timestamp() {
    return this._timestamp;
  }

  constructor(code: MessageCode, statusCode: number, errors: unknown) {
    super(messages[code]);
    this._code = code;
    this._statusCode = statusCode;
    this._errors = errors;
    this._timestamp = new Date().toISOString();
  }

  toJson(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
    };
  }
}
