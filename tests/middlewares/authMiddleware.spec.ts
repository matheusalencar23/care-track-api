import { beforeEach, describe, expect, it, vi } from "vitest";

import jwt from "jsonwebtoken";
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
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
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
      id: "123",
      name: "John Doe",
      email: "john@example.com",
      password: "hashed-password",
      coren: "123456",
      corenState: "SP",
    } as never);

    const req = createMockRequest({ cookies: { token: "valid-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ _id: "123" });
    expect(req.user).toEqual({
      id: "123",
      name: "John Doe",
      email: "john@example.com",
      coren: "123456",
      corenState: "SP",
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

  it("should call next with UnauthorizedException when the token has an invalid signature", async () => {
    const actualTokenUtils = await vi.importActual<typeof tokenUtils>(
      "../../src/utils/token.utils.js",
    );
    vi.mocked(tokenUtils.verifyToken).mockImplementation(
      actualTokenUtils.verifyToken,
    );

    const forgedToken = jwt.sign({ _id: "123" }, "wrong-secret");

    const req = createMockRequest({ cookies: { token: forgedToken } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    expect(next).not.toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500 }),
    );
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it("should reject a token issued before the last password change", async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 60;
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({
      _id: "123",
      iat: issuedAt,
    } as never);
    vi.mocked(User.findOne).mockResolvedValue({
      id: "123",
      passwordChangedAt: new Date((issuedAt + 1) * 1000),
    } as never);

    const req = createMockRequest({ cookies: { token: "old-token" } });
    const next = createMockNext();

    await authenticationMiddleware(req, createMockResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    expect(req.user).toBeUndefined();
  });

  it("should accept a token issued in the same second as the password change", async () => {
    const issuedAt = Math.floor(Date.now() / 1000);
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({
      _id: "123",
      iat: issuedAt,
    } as never);
    vi.mocked(User.findOne).mockResolvedValue({
      id: "123",
      name: "John Doe",
      email: "john@example.com",
      passwordChangedAt: new Date(issuedAt * 1000 + 500),
    } as never);

    const req = createMockRequest({ cookies: { token: "new-token" } });
    const next = createMockNext();

    await authenticationMiddleware(req, createMockResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
