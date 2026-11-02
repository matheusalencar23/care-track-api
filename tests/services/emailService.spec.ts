import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  sendConfirmationEmail,
  sendPasswordResetEmail,
} from "../../src/services/email/email.service.js";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("../../src/shared/appLogger.js", () => ({
  AppLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("emailService", () => {
  describe("sendConfirmationEmail", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should render the template replacing name and confirmation url", async () => {
      vi.mocked(readFile).mockResolvedValue(
        "<p>Hi {{name}}, confirm at {{confirmationUrl}}</p>" as never,
      );
      send.mockResolvedValue({ data: { id: "email-1" }, error: null });

      await sendConfirmationEmail(
        "john@example.com",
        "John Doe",
        "https://app.example.com/verify?token=abc",
      );

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
          subject: expect.any(String),
          html: "<p>Hi John Doe, confirm at https://app.example.com/verify?token=abc</p>",
        }),
      );
    });

    it("should replace every occurrence of the placeholders", async () => {
      vi.mocked(readFile).mockResolvedValue(
        "{{name}} - {{name}} - {{confirmationUrl}}" as never,
      );
      send.mockResolvedValue({ data: { id: "email-1" }, error: null });

      await sendConfirmationEmail(
        "john@example.com",
        "John",
        "https://app.example.com/verify",
      );

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "John - John - https://app.example.com/verify",
        }),
      );
    });

    it("should propagate errors when reading the template fails", async () => {
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      await expect(
        sendConfirmationEmail("john@example.com", "John", "https://x.com"),
      ).rejects.toThrow("ENOENT");

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("sendPasswordResetEmail", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should render the reset template replacing name and reset url", async () => {
      vi.mocked(readFile).mockResolvedValue(
        "<p>Hi {{name}}, reset at {{resetUrl}} ({{resetUrl}})</p>" as never,
      );
      send.mockResolvedValue({ data: { id: "email-1" }, error: null });

      await sendPasswordResetEmail(
        "john@example.com",
        "John Doe",
        "https://app.example.com/reset?token=abc",
      );

      expect(vi.mocked(readFile).mock.calls[0]?.[0]).toMatch(
        /templates[/\\]reset-password\.html$/,
      );
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
          subject: expect.any(String),
          html: "<p>Hi John Doe, reset at https://app.example.com/reset?token=abc (https://app.example.com/reset?token=abc)</p>",
        }),
      );
    });
  });
});
