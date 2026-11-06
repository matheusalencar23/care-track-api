import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { API, createVerifiedUser, userData } from "./helpers.js";

const patientData = {
  name: "José da Silva",
  birthDate: "1950-03-15",
};

describe("cache control", () => {
  it("should forbid caching of authenticated responses", async () => {
    await createVerifiedUser();
    const agent = request.agent(app);

    const signin = await agent
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: userData.password })
      .expect(200);
    await agent.post(`${API}/patients`).send(patientData).expect(201);
    const list = await agent.get(`${API}/patients`).expect(200);
    const me = await agent.get(`${API}/auth/me`).expect(200);

    for (const response of [signin, list, me]) {
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers.etag).toBeUndefined();
    }
  });

  it("should forbid caching of error responses", async () => {
    const response = await request(app).get(`${API}/patients`).expect(401);

    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("should forbid caching of invalid JSON responses", async () => {
    const response = await request(app)
      .post(`${API}/auth/signin`)
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.headers["cache-control"]).toBe("no-store");
  });
});
