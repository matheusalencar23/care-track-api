import { AppError } from "./appError";

export class ValidationError extends AppError {
  private _errors: string[];

  public get errors() {
    return this._errors;
  }

  constructor(errors: string | string[]) {
    super("Validation Error", 400);
    this._errors = typeof errors === "string" ? [errors] : errors;
  }

  toJson() {
    return {
      message: this.message,
      errors: this._errors,
    };
  }
}
