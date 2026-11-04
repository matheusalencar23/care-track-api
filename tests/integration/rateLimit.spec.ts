import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { messages } from "../../src/shared/messages.js";
import { API, createVerifiedUser, userData } from "./helpers.js";

describe("rate limits", () => {
  it("should not apply the signin limit to the session routes", async () => {
    await createVerifiedUser();
    const agent = request.agent(app);

    await agent
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    for (let i = 0; i < 15; i++) {
      await agent.get(`${API}/auth/me`).expect(200);
    }
  });

  it("should block signin after 10 attempts in 15 minutes", async () => {
    const attempt = () =>
      request(app)
        .post(`${API}/auth/signin`)
        .send({ email: userData.email, password: "wrong-password" });

    for (let i = 0; i < 10; i++) {
      await attempt().expect(400);
    }

    const blocked = await attempt().expect(429);
    expect(blocked.body.message).toBe(messages.TOO_MANY_REQUESTS);
  });

  it("should limit authenticated routes per user instead of per IP", async () => {
    await createVerifiedUser();
    await createVerifiedUser({ email: "joana@example.com", coren: "654321" });

    const maria = request.agent(app);
    await maria
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    for (let i = 0; i < 300; i++) {
      await maria.get(`${API}/patients`).expect(200);
    }

    const blocked = await maria.get(`${API}/patients`).expect(429);
    expect(blocked.body.message).toBe(messages.TOO_MANY_REQUESTS);

    const joana = request.agent(app);
    await joana
      .post(`${API}/auth/signin`)
      .send({ email: "joana@example.com", password: userData.password })
      .expect(200);
    await joana.get(`${API}/patients`).expect(200);
  });
});
