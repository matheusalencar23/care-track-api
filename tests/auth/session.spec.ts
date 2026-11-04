import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionCookie,
  createSession,
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_MAX_DURATION_SECONDS,
  setSessionCookie,
} from "../../src/modules/auth/session.js";
import { verifyToken } from "../../src/utils/token.utils.js";
import { createMockResponse } from "../helpers/expressMock.js";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const nowInSeconds = NOW.getTime() / 1000;

describe("session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createSession", () => {
    it("should start a session that expires after the idle timeout", () => {
      const session = createSession("123");

      const payload = verifyToken(session.token);
      expect(payload.sub).toBe("123");
      expect(payload["auth_time"]).toBe(nowInSeconds);
      expect(payload.exp).toBe(nowInSeconds + SESSION_IDLE_TIMEOUT_SECONDS);
      expect(session.expiresAt).toEqual(
        new Date((nowInSeconds + SESSION_IDLE_TIMEOUT_SECONDS) * 1000),
      );
    });

    it("should keep the login time when renewing", () => {
      const authTime = nowInSeconds - 2 * 60 * 60;

      const session = createSession("123", authTime);

      const payload = verifyToken(session.token);
      expect(payload["auth_time"]).toBe(authTime);
      expect(payload.exp).toBe(nowInSeconds + SESSION_IDLE_TIMEOUT_SECONDS);
    });

    it("should not extend the session past the maximum duration", () => {
      const authTime = nowInSeconds - SESSION_MAX_DURATION_SECONDS + 10 * 60;

      const session = createSession("123", authTime);

      expect(session.expiresAt).toEqual(
        new Date((authTime + SESSION_MAX_DURATION_SECONDS) * 1000),
      );
    });
  });

  describe("setSessionCookie", () => {
    it("should set the cookie and the expiration header", () => {
      const res = createMockResponse();
      const session = { token: "jwt", expiresAt: NOW };

      setSessionCookie(res, session);

      expect(res.cookie).toHaveBeenCalledWith(
        "token",
        "jwt",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "strict",
          expires: NOW,
        }),
      );
      expect(res.getHeader("X-Session-Expires-At")).toBe(NOW.toISOString());
    });
  });

  describe("clearSessionCookie", () => {
    it("should drop a renewal already written to the response", () => {
      const res = createMockResponse();
      res.setHeader("Set-Cookie", ["token=renewed; Path=/", "other=1"]);
      res.setHeader("X-Session-Expires-At", NOW.toISOString());

      clearSessionCookie(res);

      expect(res.getHeader("Set-Cookie")).toEqual(["other=1"]);
      expect(res.getHeader("X-Session-Expires-At")).toBeUndefined();
      expect(res.clearCookie).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ httpOnly: true, sameSite: "strict" }),
      );
    });

    it("should remove the header when the renewal is the only cookie", () => {
      const res = createMockResponse();
      res.setHeader("Set-Cookie", "token=renewed; Path=/");

      clearSessionCookie(res);

      expect(res.getHeader("Set-Cookie")).toBeUndefined();
    });
  });
});
