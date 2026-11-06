import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { messages } from "../../src/shared/messages.js";
import { API } from "./helpers.js";

describe("request body", () => {
  it("should reject malformed JSON with 400", async () => {
    const response = await request(app)
      .post(`${API}/auth/signin`)
      .set("Content-Type", "application/json")
      .send('{"email": ')
      .expect(400);

    expect(response.body).toEqual({
      code: "INVALID_REQUEST_BODY",
      message: messages.INVALID_REQUEST_BODY,
      timestamp: expect.any(String),
    });
  });

  it("should reject a body above the size limit with 413", async () => {
    const response = await request(app)
      .post(`${API}/auth/signin`)
      .send({ email: "a".repeat(200 * 1024), password: "x" })
      .expect(413);

    expect(response.body.code).toBe("REQUEST_BODY_TOO_LARGE");
  });
});
