import { describe, expect, it, vi } from "vitest";
import z from "zod";

import { schemaValidationMiddleware } from "../../src/middlewares/schemaValidation.middleware.js";
import { UnprocessableEntityException } from "../../src/shared/exceptions/index.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

const TestSchema = z.object({
  body: z.object({
    email: z.email("Email inválido"),
  }),
});

describe("schemaValidationMiddleware", () => {
  it("should call next without arguments when the payload is valid", async () => {
    const middleware = schemaValidationMiddleware(TestSchema);

    const req = createMockRequest({ body: { email: "john@example.com" } });
    const res = createMockResponse();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should call next with UnprocessableEntityException listing the validation errors", async () => {
    const middleware = schemaValidationMiddleware(TestSchema);

    const req = createMockRequest({ body: { email: "not-an-email" } });
    const res = createMockResponse();
    const next = createMockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnprocessableEntityException));

    const [errorArg] = vi.mocked(next).mock.calls[0] ?? [];
    expect(errorArg).toBeInstanceOf(UnprocessableEntityException);
    expect(
      (errorArg as unknown as UnprocessableEntityException).toJson().errors,
    ).toEqual(["Email inválido"]);
  });
});
