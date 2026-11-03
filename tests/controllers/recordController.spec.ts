import { beforeEach, describe, expect, it, vi } from "vitest";

import { create } from "../../src/modules/record/record.controller.js";
import { createRecord } from "../../src/modules/record/record.service.js";
import { UnauthorizedException } from "../../src/shared/exceptions/index.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

vi.mock("../../src/modules/record/record.service.js", () => ({
  createRecord: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const user = {
  id: "owner-1",
  name: "Maria Silva",
  email: "maria@example.com",
  coren: "123456",
  corenState: "SP" as const,
};

const record = { id: "record-1", version: 1 };

describe("recordController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create the record with the authenticated author and respond 201", async () => {
      vi.mocked(createRecord).mockResolvedValue(record as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1" },
        body: {
          content: "  Paciente estável  ",
          authorId: "someone-else",
          createdAt: "2000-01-01T00:00:00Z",
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await create(req, res, next);

      expect(createRecord).toHaveBeenCalledWith(
        {
          id: "owner-1",
          name: "Maria Silva",
          coren: "123456",
          corenState: "SP",
        },
        "patient-1",
        "Paciente estável",
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(record);
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({
        params: { id: "patient-1" },
        body: { content: "Paciente estável" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await create(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(createRecord).not.toHaveBeenCalled();
    });

    it("should call next when the service throws", async () => {
      const error = new Error("Not found");
      vi.mocked(createRecord).mockRejectedValue(error);
      const req = createMockRequest({
        user,
        params: { id: "patient-1" },
        body: { content: "Paciente estável" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
