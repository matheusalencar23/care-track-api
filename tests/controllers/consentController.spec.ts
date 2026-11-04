import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  grant,
  list,
  revoke,
} from "../../src/modules/consent/consent.controller.js";
import {
  grantConsent,
  listConsents,
  revokeConsent,
} from "../../src/modules/consent/consent.service.js";
import { UnauthorizedException } from "../../src/shared/exceptions/index.js";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMock.js";

vi.mock("../../src/modules/consent/consent.service.js", () => ({
  grantConsent: vi.fn(),
  listConsents: vi.fn(),
  revokeConsent: vi.fn(),
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

const body = {
  type: "image_capture",
  method: "written",
  grantor: "patient",
  representativeName: undefined,
  collectedAt: undefined,
};

const consent = { id: "consent-1", status: "active" };

describe("consentController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("grant", () => {
    it("should grant the consent with only the known fields and respond 201", async () => {
      vi.mocked(grantConsent).mockResolvedValue(consent as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1" },
        body: { ...body, status: "revoked", ownerId: "someone-else" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await grant(req, res, next);

      expect(grantConsent).toHaveBeenCalledWith("owner-1", "patient-1", body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(consent);
    });

    it("should call next with UnauthorizedException when there is no authenticated user", async () => {
      const req = createMockRequest({ params: { id: "patient-1" }, body });
      const res = createMockResponse();
      const next = createMockNext();

      await grant(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(grantConsent).not.toHaveBeenCalled();
    });

    it("should call next when the service throws", async () => {
      const error = new Error("Conflict");
      vi.mocked(grantConsent).mockRejectedValue(error);
      const req = createMockRequest({
        user,
        params: { id: "patient-1" },
        body,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await grant(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("should list the patient's consents", async () => {
      vi.mocked(listConsents).mockResolvedValue([consent] as never);
      const req = createMockRequest({ user, params: { id: "patient-1" } });
      const res = createMockResponse();
      const next = createMockNext();

      await list(req, res, next);

      expect(listConsents).toHaveBeenCalledWith("owner-1", "patient-1");
      expect(res.json).toHaveBeenCalledWith([consent]);
    });
  });

  describe("revoke", () => {
    it("should revoke the consent with the reason", async () => {
      vi.mocked(revokeConsent).mockResolvedValue(consent as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1", consentId: "consent-1" },
        body: { reason: "Pedido" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await revoke(req, res, next);

      expect(revokeConsent).toHaveBeenCalledWith(
        "owner-1",
        "patient-1",
        "consent-1",
        "Pedido",
      );
      expect(res.json).toHaveBeenCalledWith(consent);
    });

    it("should revoke without a body", async () => {
      vi.mocked(revokeConsent).mockResolvedValue(consent as never);
      const req = createMockRequest({
        user,
        params: { id: "patient-1", consentId: "consent-1" },
        body: undefined,
      });
      const res = createMockResponse();
      const next = createMockNext();

      await revoke(req, res, next);

      expect(revokeConsent).toHaveBeenCalledWith(
        "owner-1",
        "patient-1",
        "consent-1",
        undefined,
      );
    });
  });
});
