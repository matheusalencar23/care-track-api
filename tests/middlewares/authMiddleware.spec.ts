import { beforeEach, describe, expect, it, vi } from "vitest";

import jwt from "jsonwebtoken";
import { authenticationMiddleware } from "../../src/modules/auth/auth.middleware.js";
import * as userRepository from "../../src/modules/user/user.repository.js";
import * as tokenUtils from "../../src/utils/token.utils.js";
import { UnauthorizedException } from "../../src/shared/exceptions/index.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

vi.mock("../../src/modules/user/user.repository.js", () => ({
  findById: vi.fn(),
}));

vi.mock("../../src/utils/token.utils.js", () => ({
  verifyToken: vi.fn(),
  generateToken: vi.fn(() => "renewed-token"),
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
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({
      sub: "123",
      iat: Math.floor(Date.now() / 1000),
    } as never);
    vi.mocked(userRepository.findById).mockResolvedValue(null as never);

    const req = createMockRequest({ cookies: { token: "valid-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
  });

  it("should attach the user to the request and call next when the token is valid", async () => {
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({
      sub: "123",
      iat: Math.floor(Date.now() / 1000),
    } as never);
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: "123",
      name: "John Doe",
      email: "john@example.com",
      passwordHash: "hashed-password",
      coren: "123456",
      corenState: "SP",
    } as never);

    const req = createMockRequest({ cookies: { token: "valid-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(userRepository.findById).toHaveBeenCalledWith("123");
    expect(req.user).toEqual({
      id: "123",
      name: "John Doe",
      email: "john@example.com",
      coren: "123456",
      corenState: "SP",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("should renew the session keeping the login time", async () => {
    const now = Math.floor(Date.now() / 1000);
    const authTime = now - 60 * 60;
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({
      sub: "123",
      auth_time: authTime,
      iat: now - 60,
    } as never);
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: "123",
      passwordChangedAt: null,
    } as never);

    const req = createMockRequest({ cookies: { token: "valid-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(tokenUtils.generateToken).toHaveBeenCalledWith(
      { sub: "123", auth_time: authTime },
      expect.any(Number),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "token",
      "renewed-token",
      expect.objectContaining({ httpOnly: true, sameSite: "strict" }),
    );
    expect(res.getHeader("X-Session-Expires-At")).toBe(
      req.sessionExpiresAt?.toISOString(),
    );
    expect(req.sessionExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(next).toHaveBeenCalledWith();
  });

  it("should use the issue time as login time for tokens without auth_time", async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 60;
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({
      sub: "123",
      iat: issuedAt,
    } as never);
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: "123",
      passwordChangedAt: null,
    } as never);

    const req = createMockRequest({ cookies: { token: "legacy-token" } });
    const next = createMockNext();

    await authenticationMiddleware(req, createMockResponse(), next);

    expect(tokenUtils.generateToken).toHaveBeenCalledWith(
      { sub: "123", auth_time: issuedAt },
      expect.any(Number),
    );
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject a renewed session whose login happened before the last password change", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({
      sub: "123",
      auth_time: now - 60,
      iat: now,
    } as never);
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: "123",
      passwordChangedAt: new Date((now - 30) * 1000),
    } as never);

    const req = createMockRequest({ cookies: { token: "renewed-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("should call next with UnauthorizedException when the token has no subject", async () => {
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({ _id: "123" } as never);

    const req = createMockRequest({ cookies: { token: "legacy-token" } });
    const next = createMockNext();

    await authenticationMiddleware(req, createMockResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    expect(userRepository.findById).not.toHaveBeenCalled();
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
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({
      sub: "123",
      iat: Math.floor(Date.now() / 1000),
    } as never);
    vi.mocked(userRepository.findById).mockRejectedValue(
      new Error("DB is down"),
    );

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

    const forgedToken = jwt.sign({ sub: "123" }, "wrong-secret");

    const req = createMockRequest({ cookies: { token: forgedToken } });
    const res = createMockResponse();
    const next = createMockNext();

    await authenticationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    expect(next).not.toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500 }),
    );
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it("should reject a token issued before the last password change", async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 60;
    vi.mocked(tokenUtils.verifyToken).mockReturnValue({
      sub: "123",
      iat: issuedAt,
    } as never);
    vi.mocked(userRepository.findById).mockResolvedValue({
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
      sub: "123",
      iat: issuedAt,
    } as never);
    vi.mocked(userRepository.findById).mockResolvedValue({
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
