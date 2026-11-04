import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorMiddleware } from "../../src/middlewares/error.middleware.js";
import {
  HttpException,
  NotFoundException,
} from "../../src/shared/exceptions/index.js";
import { AppLogger } from "../../src/shared/appLogger.js";
import {
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";
import { messages } from "../../src/shared/messages.js";
import { uniqueViolation } from "../helpers/dbMock.js";

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("errorMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should respond with the exception's own status code and json when it is an HttpException", () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    const error = new NotFoundException("USER_NOT_FOUND");

    errorMiddleware(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      code: "USER_NOT_FOUND",
      message: messages.USER_NOT_FOUND,
      timestamp: error.timestamp,
    });
  });

  it("should respond with a generic 500 for a plain Error", () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    errorMiddleware(new Error("Something broke"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: "INTERNAL_SERVER_ERROR",
      message: messages.INTERNAL_SERVER_ERROR,
    });
  });

  it("should respond with a generic 500 even when the thrown value is not an Error instance", () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    errorMiddleware("just a string", req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: "INTERNAL_SERVER_ERROR",
      message: messages.INTERNAL_SERVER_ERROR,
    });
  });

  it("should respond with 409 for a duplicate key error without leaking the duplicated value", () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    const error = uniqueViolation("john@example.com");

    errorMiddleware(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CONFLICT", message: messages.CONFLICT }),
    );

    const responseBody = JSON.stringify(vi.mocked(res.json).mock.calls);
    const logged = JSON.stringify([
      ...vi.mocked(AppLogger.warn).mock.calls,
      ...vi.mocked(AppLogger.error).mock.calls,
    ]);
    expect(responseBody).not.toContain("john@example.com");
    expect(logged).not.toContain("john@example.com");
  });

  it("should not log the query params of an unexpected database error", () => {
    const error = uniqueViolation("52998224725");
    error.cause = Object.assign(error.cause as object, { code: "42501" });

    errorMiddleware(
      error,
      createMockRequest({}),
      createMockResponse(),
      vi.fn(),
    );

    const logged = JSON.stringify(vi.mocked(AppLogger.error).mock.calls);
    expect(logged).toContain("42501");
    expect(logged).not.toContain("52998224725");
  });

  it("should log client errors (4xx) as warn", () => {
    const res = createMockResponse();

    errorMiddleware(
      new NotFoundException("USER_NOT_FOUND"),
      createMockRequest({}),
      res,
      vi.fn(),
    );

    expect(AppLogger.warn).toHaveBeenCalledWith(messages.USER_NOT_FOUND, {
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
    expect(AppLogger.error).not.toHaveBeenCalled();
  });

  it("should log server errors (5xx) as error", () => {
    const res = createMockResponse();

    errorMiddleware(
      new HttpException("INTERNAL_SERVER_ERROR", 500, null),
      createMockRequest({}),
      res,
      vi.fn(),
    );

    expect(AppLogger.error).toHaveBeenCalledWith(
      messages.INTERNAL_SERVER_ERROR,
      { statusCode: 500, code: "INTERNAL_SERVER_ERROR" },
    );
    expect(AppLogger.warn).not.toHaveBeenCalled();
  });
});
