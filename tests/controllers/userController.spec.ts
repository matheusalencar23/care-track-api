import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  me,
  resendValidation,
  signin,
  signup,
  validate,
} from "../../src/modules/user/user.controller.js";

import {
  createUser,
  resendValidation as resendValidationService,
  validateUser,
} from "../../src/modules/user/user.service.js";
import { login } from "../../src/modules/auth/auth.service.js";
import { UnauthorizedException } from "../../src/shared/exceptions/index.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";
import { messages } from "../../src/shared/messages.js";

vi.mock("../../src/modules/user/user.service.js", () => ({
  createUser: vi.fn(),
  validateUser: vi.fn(),
  resendValidation: vi.fn(),
}));

vi.mock("../../src/modules/auth/auth.service.js", () => ({
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

describe("validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should validate the user and return 200", async () => {
    vi.mocked(validateUser).mockResolvedValue(undefined);

    const req = createMockRequest({ query: { token: "some-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await validate(req, res, next);

    expect(validateUser).toHaveBeenCalledWith("some-token");
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next with UnprocessableEntityException when token is missing", async () => {
    const req = createMockRequest({ query: {} });
    const res = createMockResponse();
    const next = createMockNext();

    await validate(req, res, next);

    expect(validateUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 422 }),
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  it("should call next when validateUser throws", async () => {
    const error = new Error("Invalid token!");
    vi.mocked(validateUser).mockRejectedValue(error);

    const req = createMockRequest({ query: { token: "some-token" } });
    const res = createMockResponse();
    const next = createMockNext();

    await validate(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("resendValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resend the validation email and return 200", async () => {
    vi.mocked(resendValidationService).mockResolvedValue(undefined);

    const req = createMockRequest({ body: { email: "john@example.com" } });
    const res = createMockResponse();

    await resendValidation(req, res);

    expect(resendValidationService).toHaveBeenCalledWith("john@example.com");
    expect(res.json).toHaveBeenCalled();
  });

  it("should still return 200 when resendValidation throws, to avoid leaking whether the email exists", async () => {
    vi.mocked(resendValidationService).mockRejectedValue(
      new Error("User not found!"),
    );

    const req = createMockRequest({ body: { email: "ghost@example.com" } });
    const res = createMockResponse();

    await resendValidation(req, res);

    expect(res.json).toHaveBeenCalled();
  });
});
