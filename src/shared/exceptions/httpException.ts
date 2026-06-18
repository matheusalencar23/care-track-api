export class HttpException extends Error {
  protected _statusCode: number;
  protected _errors: any;

  get statusCode() {
    return this._statusCode;
  }

  constructor(message: string, statusCode: number, errors: any) {
    super(message);
    this._statusCode = statusCode;
    this._errors = errors;
  }

  toJson(): Record<string, unknown> {
    return {
      message: this.message,
    };
  }
}
