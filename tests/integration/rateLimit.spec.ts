import request from "supertest";
import { describe, it } from "vitest";

import app from "../../src/app.js";
import { API, createVerifiedUser, userData } from "./helpers.js";

// Os contadores são zerados depois de cada teste (tests/integration/setup.ts)
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

    await attempt().expect(429);
  });
});
