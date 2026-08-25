import { beforeEach, describe, expect, it, vi } from "vitest";

import { me, signin, signup } from "../../src/controllers/userController.js";

import { createUser } from "../../src/services/userService.js";
import { login } from "../../src/services/authenticationService.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

vi.mock("../../src/services/userService.js", () => ({
  createUser: vi.fn(),
}));

vi.mock("../../src/services/authenticationService.js", () => ({
  login: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a user and return 201", async () => {
    vi.mocked(createUser).mockResolvedValue(undefined);

    const req = createMockRequest({
      body: {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      },
    });

    const json = vi.fn();
    const res = createMockResponse(json);
    const next = createMockNext();

    await signup(req, res, next);

    expect(createUser).toHaveBeenCalledWith(
      "John Doe",
      "john@example.com",
      "password123",
    );

    expect(res.status).toHaveBeenCalledWith(201);

    expect(json).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("should call next when createUser throws", async () => {
    const error = new Error("User already exists");

    vi.mocked(createUser).mockRejectedValue(error);

    const req = createMockRequest({
      body: {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      },
    });

    const res = createMockResponse();
    const next = createMockNext();

    await signup(req, res, next);

    expect(next).toHaveBeenCalledWith(error);

    expect(res.status).not.toHaveBeenCalled();
  });

});

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
    const error = new Error("Invalid credentials");

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
  it("should return the authenticated user's public data", async () => {
    const req = createMockRequest({
      user: {
        name: "John Doe",
        email: "john@example.com",
      },
    });

    const res = createMockResponse();

    await me(req, res);

    expect(res.json).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
    });
  });
});