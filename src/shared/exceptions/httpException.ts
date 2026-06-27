export class HttpException extends Error {
  protected _statusCode: number;
  protected _errors: any;
  protected _timestamp: string;

  get statusCode() {
    return this._statusCode;
  }

  get timestamp() {
    return this._timestamp;
  }

  constructor(message: string, statusCode: number, errors: any) {
    super(message);
    this._statusCode = statusCode;
    this._errors = errors;
    this._timestamp = new Date().toISOString();
  }

  toJson(): Record<string, unknown> {
    return {
      message: this.message,
      timestamp: this.timestamp
    };
  }
}
