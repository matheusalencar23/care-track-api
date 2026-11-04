import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { apiOperations } from "../../src/docs/openapi.js";
import { API, createVerifiedUser, userData } from "./helpers.js";

const SAMPLE_ID = "0190a3b8-6f5e-7000-8000-000000000000";

const isRouted = (response: request.Response) =>
  response.status !== 404 ||
  /application\/json/.test(response.headers["content-type"] ?? "");

describe("API docs", () => {
  it("should serve the OpenAPI document", async () => {
    const response = await request(app)
      .get(`${API}/docs/openapi.json`)
      .expect(200);

    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.paths).toHaveProperty("/patients/{id}/records");
  });

  it("should serve the Swagger UI without upgrading requests to HTTPS", async () => {
    const response = await request(app).get(`${API}/docs/`).expect(200);

    expect(response.headers["content-type"]).toMatch(/text\/html/);
    expect(response.text).toContain("swagger-ui");
    expect(response.headers["content-security-policy"]).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  describe("documented operations", () => {
    let agent: ReturnType<typeof request.agent>;

    beforeEach(async () => {
      await createVerifiedUser();
      agent = request.agent(app);
      await agent
        .post(`${API}/auth/signin`)
        .send({ email: userData.email, password: userData.password })
        .expect(200);
    });

    it("should not route an undocumented path", async () => {
      const response = await agent.get(`${API}/patients/${SAMPLE_ID}/unknown`);

      expect(response.status).toBe(404);
      expect(isRouted(response)).toBe(false);
    });

    it.each(apiOperations.map(({ method, path }) => [method, path] as const))(
      "should route %s %s",
      async (method, path) => {
        const response = await agent[method](
          `${API}${path.replace(/:\w+/g, SAMPLE_ID)}`,
        );

        expect(isRouted(response)).toBe(true);
      },
    );
  });
});
