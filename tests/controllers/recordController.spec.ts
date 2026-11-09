import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  create,
  list,
  listVersions,
  update,
  voidRecord,
} from "../../src/modules/record/record.controller.js";
import {
  createRecord,
  listRecords,
  listRecordVersions,
  updateRecord,
  voidRecord as voidRecordService,
} from "../../src/modules/record/record.service.js";
import { UnauthorizedException } from "../../src/shared/exceptions/index.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

vi.mock("../../src/modules/record/record.service.js", () => ({
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  listRecordVersions: vi.fn(),
  listRecords: vi.fn(),
  voidRecord: vi.fn(),
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
        [],
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
  describe("update", () => {
    const author = {
      id: "owner-1",
      name: "Maria Silva",
      coren: "123456",
      corenState: "SP",
    };

    it("should edit the record with only the known fields", async () => {
      vi.mocked(updateRecord).mockResolvedValue(record as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1", recordId: "record-1" },
        body: {
          content: "  Novo texto  ",
          version: 1,
          reason: "  Correção  ",
          authorId: "someone-else",
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await update(req, res, next);

      expect(updateRecord).toHaveBeenCalledWith(
        author,
        "patient-1",
        "record-1",
        { content: "Novo texto", version: 1, reason: "Correção" },
      );
      expect(res.json).toHaveBeenCalledWith(record);
    });

    it("should not send a reason when none is given", async () => {
      vi.mocked(updateRecord).mockResolvedValue(record as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1", recordId: "record-1" },
        body: { content: "Novo texto", version: 1 },
      });

      await update(req, createMockResponse(), createMockNext());

      expect(updateRecord).toHaveBeenCalledWith(
        author,
        "patient-1",
        "record-1",
        { content: "Novo texto", version: 1 },
      );
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({
        params: { id: "patient-1", recordId: "record-1" },
        body: { content: "Novo texto", version: 1 },
      });
      const next = createMockNext();

      await update(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(updateRecord).not.toHaveBeenCalled();
    });

    it("should call next when the service throws", async () => {
      const error = new Error("Conflict");
      vi.mocked(updateRecord).mockRejectedValue(error);
      const req = createMockRequest({
        user,
        params: { id: "patient-1", recordId: "record-1" },
        body: { content: "Novo texto", version: 1 },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await update(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("listVersions", () => {
    it("should list the versions of the record", async () => {
      const versions = [{ version: 1 }];
      vi.mocked(listRecordVersions).mockResolvedValue(versions as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1", recordId: "record-1" },
      });
      const res = createMockResponse();

      await listVersions(req, res, createMockNext());

      expect(listRecordVersions).toHaveBeenCalledWith(
        "owner-1",
        "patient-1",
        "record-1",
      );
      expect(res.json).toHaveBeenCalledWith(versions);
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({
        params: { id: "patient-1", recordId: "record-1" },
      });
      const next = createMockNext();

      await listVersions(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(listRecordVersions).not.toHaveBeenCalled();
    });
  });
  describe("voidRecord", () => {
    it("should void the record with only the known fields", async () => {
      vi.mocked(voidRecordService).mockResolvedValue(record as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1", recordId: "record-1" },
        body: {
          reason: "other",
          details: "  Registro de teste  ",
          voidedBy: "someone-else",
        },
      });
      const res = createMockResponse();

      await voidRecord(req, res, createMockNext());

      expect(voidRecordService).toHaveBeenCalledWith(
        "owner-1",
        "patient-1",
        "record-1",
        { reason: "other", details: "Registro de teste" },
      );
      expect(res.json).toHaveBeenCalledWith(record);
    });

    it("should not send details when none are given", async () => {
      vi.mocked(voidRecordService).mockResolvedValue(record as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1", recordId: "record-1" },
        body: { reason: "duplicate" },
      });

      await voidRecord(req, createMockResponse(), createMockNext());

      expect(voidRecordService).toHaveBeenCalledWith(
        "owner-1",
        "patient-1",
        "record-1",
        { reason: "duplicate" },
      );
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({
        params: { id: "patient-1", recordId: "record-1" },
        body: { reason: "duplicate" },
      });
      const next = createMockNext();

      await voidRecord(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(voidRecordService).not.toHaveBeenCalled();
    });

    it("should call next when the service throws", async () => {
      const error = new Error("Conflict");
      vi.mocked(voidRecordService).mockRejectedValue(error);
      const req = createMockRequest({
        user,
        params: { id: "patient-1", recordId: "record-1" },
        body: { reason: "duplicate" },
      });
      const next = createMockNext();

      await voidRecord(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
  describe("list", () => {
    it("should list the records with the parsed query", async () => {
      const page = { items: [record], nextCursor: null };
      vi.mocked(listRecords).mockResolvedValue(page as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1" },
        query: { limit: "5", status: "voided" },
      });
      const res = createMockResponse();

      await list(req, res, createMockNext());

      expect(listRecords).toHaveBeenCalledWith("owner-1", "patient-1", {
        status: "voided",
        limit: 5,
      });
      expect(res.json).toHaveBeenCalledWith(page);
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({
        params: { id: "patient-1" },
        query: {},
      });
      const next = createMockNext();

      await list(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(listRecords).not.toHaveBeenCalled();
    });
  });
});
