import { beforeEach, describe, expect, it, vi } from "vitest";

import { authenticationMiddleware } from "../../src/modules/auth/auth.middleware.js";
import User from "../../src/modules/user/user.model.js";
import * as tokenUtils from "../../src/utils/token.utils.js";
import { UnauthorizedException } from "../../src/shared/exceptions/index.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

vi.mock("../../src/modules/user/user.model.js", () => ({
  default: { findOne: vi.fn() },
}));

vi.mock("../../src/utils/token.utils.js", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("authenticationMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call next with UnauthorizedException when there is no token cookie", async () => {
    const req = createMockRequest({ cookies: {} });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    expect(tokenUtils.verifyToken).not.toHaveBeenCalled();
  });

  it("should call next with UnauthorizedException when the token does not resolve to a user", async () => {
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({ _id: "123" } as never);
    vi.mocked(User.findOne).mockResolvedValue(null as never);

    const req = createMockRequest({ cookies: { token: "valid-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
  });

  it("should attach the user to the request and call next when the token is valid", async () => {
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({ _id: "123" } as never);
    vi.mocked(User.findOne).mockResolvedValue({
      name: "John Doe",
      email: "john@example.com",
    } as never);

    const req = createMockRequest({ cookies: { token: "valid-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(req.user).toEqual({
      name: "John Doe",
      email: "john@example.com",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("should call next with UnauthorizedException (not a generic 500) when the token is expired", async () => {
    vi.mocked(tokenUtils.verifyToken).mockImplementation(() => {
      throw new UnauthorizedException("Unauthorized");
    });

    const req = createMockRequest({ cookies: { token: "expired-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
  });

  it("should call next with a generic HttpException for unexpected errors", async () => {
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({ _id: "123" } as never);
    vi.mocked(User.findOne).mockRejectedValue(new Error("DB is down"));

    const req = createMockRequest({ cookies: { token: "valid-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500 }),
    );
  });
});
