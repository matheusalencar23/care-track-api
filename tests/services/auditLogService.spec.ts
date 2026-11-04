import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  record,
  recordMany,
} from "../../src/modules/audit/auditLog.service.js";
import * as auditLogRepository from "../../src/modules/audit/auditLog.repository.js";
import { runWithRequestContext } from "../../src/shared/requestContext.js";

vi.mock("../../src/modules/audit/auditLog.repository.js", () => ({
  save: vi.fn(),
  saveMany: vi.fn(),
}));

describe("auditLogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("record", () => {
    it("should save the entry with the request id and ip of the current request", async () => {
      await new Promise<void>((resolve, reject) => {
        runWithRequestContext({ requestId: "req-1", ip: "10.0.0.1" }, () => {
          record({
            userId: "user-1",
            action: "auth.signin",
            resourceType: "user",
            resourceId: "user-1",
          }).then(resolve, reject);
        });
      });

      expect(auditLogRepository.save).toHaveBeenCalledWith({
        userId: "user-1",
        action: "auth.signin",
        resourceType: "user",
        resourceId: "user-1",
        patientId: null,
        requestId: "req-1",
        ip: "10.0.0.1",
      });
    });

    it("should save null request data outside of a request", async () => {
      await record({
        userId: "user-1",
        action: "auth.signout",
        resourceType: "user",
      });

      expect(auditLogRepository.save).toHaveBeenCalledWith({
        userId: "user-1",
        action: "auth.signout",
        resourceType: "user",
        resourceId: null,
        patientId: null,
        requestId: null,
        ip: null,
      });
    });

    it("should propagate errors from the repository", async () => {
      vi.mocked(auditLogRepository.save).mockRejectedValue(
        new Error("DB is down"),
      );

      await expect(
        record({
          userId: "user-1",
          action: "auth.signin",
          resourceType: "user",
        }),
      ).rejects.toThrow("DB is down");
    });
  });

  describe("recordMany", () => {
    it("should save all entries with the request id and ip of the current request", async () => {
      await new Promise<void>((resolve, reject) => {
        runWithRequestContext({ requestId: "req-1", ip: "10.0.0.1" }, () => {
          recordMany([
            {
              userId: "user-1",
              action: "patient.list",
              resourceType: "patient",
              resourceId: "patient-1",
              patientId: "patient-1",
            },
            {
              userId: "user-1",
              action: "patient.list",
              resourceType: "patient",
              resourceId: "patient-2",
              patientId: "patient-2",
            },
          ]).then(resolve, reject);
        });
      });

      expect(auditLogRepository.saveMany).toHaveBeenCalledWith([
        expect.objectContaining({
          patientId: "patient-1",
          requestId: "req-1",
          ip: "10.0.0.1",
        }),
        expect.objectContaining({
          patientId: "patient-2",
          requestId: "req-1",
          ip: "10.0.0.1",
        }),
      ]);
    });

    it("should not save anything for an empty list", async () => {
      await recordMany([]);

      expect(auditLogRepository.saveMany).not.toHaveBeenCalled();
    });

    it("should propagate errors from the repository", async () => {
      vi.mocked(auditLogRepository.saveMany).mockRejectedValue(
        new Error("DB is down"),
      );

      await expect(
        recordMany([
          { userId: "user-1", action: "patient.list", resourceType: "patient" },
        ]),
      ).rejects.toThrow("DB is down");
    });
  });
});
