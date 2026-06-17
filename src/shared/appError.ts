export class AppError extends Error {
  private _statusCode: number;

  public get statusCode() {
    return this._statusCode;
  }

  constructor(message: string, statusCode: number) {
    super(message);
    this._statusCode = statusCode;
  }

  toJson() {
    return {
      message: this.message,
    };
  }
}
