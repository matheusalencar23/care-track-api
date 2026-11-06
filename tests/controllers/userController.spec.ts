import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resendValidation,
  signup,
  validate,
} from "../../src/modules/user/user.controller.js";

import {
  createUser,
  resendValidation as resendValidationService,
  validateUser,
} from "../../src/modules/user/user.service.js";
import { CURRENT_TERMS_VERSION } from "../../src/modules/terms/terms.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

vi.mock("../../src/modules/user/user.service.js", () => ({
  createUser: vi.fn(),
  validateUser: vi.fn(),
  resendValidation: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
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
        coren: "123456",
        corenState: "SP",
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
      },
    });

    const json = vi.fn();
    const res = createMockResponse(json);
    const next = createMockNext();

    await signup(req, res, next);

    expect(createUser).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      coren: "123456",
      corenState: "SP",
      acceptedTermsVersion: CURRENT_TERMS_VERSION,
    });

    expect(res.status).toHaveBeenCalledWith(201);

    expect(json).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
      coren: "123456",
      corenState: "SP",
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
        coren: "123456",
        corenState: "SP",
      },
    });

    const res = createMockResponse();
    const next = createMockNext();

    await signup(req, res, next);

    expect(next).toHaveBeenCalledWith(error);

    expect(res.status).not.toHaveBeenCalled();
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
