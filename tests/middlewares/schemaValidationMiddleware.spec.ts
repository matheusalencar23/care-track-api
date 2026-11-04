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
    ).toEqual([{ location: "body", path: "email", message: "Email inválido" }]);
  });

  it("should report where each invalid field is, with nested paths", async () => {
    const schema = z.object({
      params: z.object({ id: z.uuid("ID inválido") }),
      body: z.object({
        items: z.array(z.object({ name: z.string("Nome inválido") })),
      }),
    });
    const middleware = schemaValidationMiddleware(schema);

    const req = createMockRequest({
      params: { id: "123" },
      body: { items: [{ name: 1 }] },
    });
    const next = createMockNext();

    await middleware(req, createMockResponse(), next);

    const [errorArg] = vi.mocked(next).mock.calls[0] ?? [];
    expect(
      (errorArg as unknown as UnprocessableEntityException).toJson().errors,
    ).toEqual(
      expect.arrayContaining([
        { location: "params", path: "id", message: "ID inválido" },
        { location: "body", path: "items.0.name", message: "Nome inválido" },
      ]),
    );
  });

  it("should report an error of the whole body with an empty path", async () => {
    const schema = z.object({
      body: z.object({}).refine(() => false, "Objeto inválido"),
    });
    const middleware = schemaValidationMiddleware(schema);

    const next = createMockNext();

    await middleware(
      createMockRequest({ body: {} }),
      createMockResponse(),
      next,
    );

    const [errorArg] = vi.mocked(next).mock.calls[0] ?? [];
    expect(
      (errorArg as unknown as UnprocessableEntityException).toJson().errors,
    ).toEqual([{ location: "body", path: "", message: "Objeto inválido" }]);
  });
});
