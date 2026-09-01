import { describe, expect, it, vi } from "vitest";

import { errorMiddleware } from "../../src/middlewares/error.middleware.js";
import { NotFoundException } from "../../src/shared/exceptions/index.js";
import { createMockRequest, createMockResponse } from "../helpers/expressMock.js";

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("errorMiddleware", () => {
  it("should respond with the exception's own status code and json when it is an HttpException", () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    const error = new NotFoundException("User not found!");

    errorMiddleware(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "User not found!" }),
    );
  });

  it("should respond with a generic 500 for a plain Error", () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    errorMiddleware(new Error("Something broke"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });

  it("should respond with a generic 500 even when the thrown value is not an Error instance", () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    errorMiddleware("just a string", req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});
