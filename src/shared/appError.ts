export class AppError extends Error {
  private _statusCode: number;
  private _errors: string[];

  public get statusCode() {
    return this._statusCode;
  }

  public get errors(): string[] {
    return this._errors;
  }

  constructor(message: string, statusCode: number, errors: string | string[] = []) {
    super(message);
    this._statusCode = statusCode;
    this._errors = typeof errors === "string" ? [errors] : errors;
  }
}
