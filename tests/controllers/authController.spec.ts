import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  forgotPassword,
  me,
  resetPassword,
  signin,
  signout,
} from "../../src/modules/auth/auth.controller.js";
import {
  login,
  requestPasswordReset,
  resetPassword as resetPasswordService,
} from "../../src/modules/auth/auth.service.js";
import { UnauthorizedException } from "../../src/shared/exceptions/index.js";
import { record } from "../../src/modules/audit/auditLog.service.js";
import { messages } from "../../src/shared/messages.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

vi.mock("../../src/modules/auth/auth.service.js", () => ({
  login: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("../../src/modules/audit/auditLog.service.js", () => ({
  record: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("signin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should login and set authentication cookie", async () => {
    vi.mocked(login).mockResolvedValue("jwt-token");

    const req = createMockRequest({
      body: {
        email: "john@example.com",
        password: "password123",
      },
    });

    const res = createMockResponse();
    const next = createMockNext();

    await signin(req, res, next);

    expect(login).toHaveBeenCalledWith("john@example.com", "password123");

    expect(res.cookie).toHaveBeenCalledWith(
      "token",
      "jwt-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        maxAge: 3600000,
      }),
    );

    expect(res.send).toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });

  it("should call next when login throws", async () => {
    const error = new Error(messages.INVALID_CREDENTIALS);

    vi.mocked(login).mockRejectedValue(error);

    const req = createMockRequest({
      body: {
        email: "john@example.com",
        password: "password123",
      },
    });

    const res = createMockResponse();
    const next = createMockNext();

    await signin(req, res, next);

    expect(next).toHaveBeenCalledWith(error);

    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });
});

describe("me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the authenticated user's public data", async () => {
    const req = createMockRequest({
      user: {
        id: "123",
        name: "John Doe",
        email: "john@example.com",
        coren: "123456",
        corenState: "SP",
      },
    });

    const res = createMockResponse();
    const next = createMockNext();

    await me(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
      coren: "123456",
      corenState: "SP",
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("should call next with UnauthorizedException when there is no authenticated user", async () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = createMockNext();

    await me(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("signout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should clear the authentication cookie and respond with 204", async () => {
    const req = createMockRequest({
      user: {
        id: "123",
        name: "John Doe",
        email: "john@example.com",
        coren: "123456",
        corenState: "SP",
      },
    });
    const res = createMockResponse();
    const next = createMockNext();

    await signout(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith({
      userId: "123",
      action: "auth.signout",
      resourceType: "user",
      resourceId: "123",
    });
  });

  it("should call next with UnauthorizedException when there is no authenticated user", async () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = createMockNext();

    await signout(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});

describe("forgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should request the reset and respond 200", async () => {
    const req = createMockRequest({ body: { email: "john@example.com" } });
    const res = createMockResponse();

    await forgotPassword(req, res);

    expect(requestPasswordReset).toHaveBeenCalledWith("john@example.com");
    expect(res.json).toHaveBeenCalled();
  });

  it("should still respond 200 when the service fails", async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(new Error("DB is down"));

    const req = createMockRequest({ body: { email: "john@example.com" } });
    const res = createMockResponse();

    await forgotPassword(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reset the password and clear the authentication cookie", async () => {
    const req = createMockRequest({
      body: { token: "reset-token", password: "new-password" },
    });
    const res = createMockResponse();
    const next = createMockNext();

    await resetPassword(req, res, next);

    expect(resetPasswordService).toHaveBeenCalledWith(
      "reset-token",
      "new-password",
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next when the service throws", async () => {
    const error = new Error("Invalid token!");
    vi.mocked(resetPasswordService).mockRejectedValue(error);

    const req = createMockRequest({
      body: { token: "bad-token", password: "new-password" },
    });
    const res = createMockResponse();
    const next = createMockNext();

    await resetPassword(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
