import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestLoggerMiddleware } from "../../src/middlewares/requestLogger.middleware.js";
import { AppLogger } from "../../src/shared/appLogger.js";
import { getRequestId } from "../../src/shared/requestContext.js";

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createRequest = (
  originalUrl: string,
  headers: Record<string, string> = {},
) =>
  ({
    method: "GET",
    originalUrl,
    header: (name: string) => headers[name.toLowerCase()],
  }) as unknown as Request;

const createResponse = () => {
  const res = new EventEmitter() as EventEmitter & {
    statusCode: number;
    setHeader: ReturnType<typeof vi.fn>;
  };
  res.statusCode = 200;
  res.setHeader = vi.fn();
  return res as unknown as Response & EventEmitter & { statusCode: number };
};

describe("requestLoggerMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate a request id, expose it in the response and in the request context", () => {
    const res = createResponse();
    let requestIdInsideRequest: string | undefined;

    requestLoggerMiddleware(createRequest("/api/v1/health"), res, () => {
      requestIdInsideRequest = getRequestId();
    });

    expect(requestIdInsideRequest).toEqual(expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith(
      "x-request-id",
      requestIdInsideRequest,
    );
    expect(getRequestId()).toBeUndefined();
  });

  it("should reuse a valid incoming x-request-id", () => {
    const res = createResponse();

    requestLoggerMiddleware(
      createRequest("/api/v1/health", { "x-request-id": "abc-123" }),
      res,
      vi.fn(),
    );

    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "abc-123");
  });

  it("should ignore an incoming x-request-id with unsafe characters", () => {
    const res = createResponse();

    requestLoggerMiddleware(
      createRequest("/api/v1/health", { "x-request-id": "bad id\nINJECTED" }),
      res,
      vi.fn(),
    );

    expect(res.setHeader).not.toHaveBeenCalledWith(
      "x-request-id",
      "bad id\nINJECTED",
    );
  });

  it("should log the request without the query string when it finishes", () => {
    const res = createResponse();

    requestLoggerMiddleware(
      createRequest("/api/v1/users/validate?token=secret-token"),
      res,
      vi.fn(),
    );
    res.emit("finish");

    expect(AppLogger.info).toHaveBeenCalledWith(
      "Request completed",
      expect.objectContaining({
        method: "GET",
        path: "/api/v1/users/validate",
        statusCode: 200,
        durationMs: expect.any(Number),
      }),
    );
    expect(JSON.stringify(vi.mocked(AppLogger.info).mock.calls)).not.toContain(
      "secret-token",
    );
  });

  it.each([
    [404, "warn"],
    [500, "error"],
  ] as const)(
    "should log a %i response as %s",
    (statusCode, level) => {
      const res = createResponse();

      requestLoggerMiddleware(createRequest("/api/v1/x"), res, vi.fn());
      res.statusCode = statusCode;
      res.emit("finish");

      expect(AppLogger[level]).toHaveBeenCalledWith(
        "Request completed",
        expect.objectContaining({ statusCode }),
      );
    },
  );
});
