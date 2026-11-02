import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  me,
  signin,
  signout,
} from "../../src/modules/auth/auth.controller.js";
import { login } from "../../src/modules/auth/auth.service.js";
import { UnauthorizedException } from "../../src/shared/exceptions/index.js";
import { messages } from "../../src/shared/messages.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

vi.mock("../../src/modules/auth/auth.service.js", () => ({
  login: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    info: vi.fn(),
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
      },
    });

    const res = createMockResponse();
    const next = createMockNext();

    await me(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
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
    const req = createMockRequest({});
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
  });
});
