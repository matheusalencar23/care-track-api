import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { auditLogs } from "../../src/modules/audit/auditLog.model.js";
import { record } from "../../src/modules/audit/auditLog.service.js";
import { API, createVerifiedUser, findAuditLogs, userData } from "./helpers.js";
import { adminQuery, appClient, countRows } from "./database.js";

describe("audit log", () => {
  it("should record signin and signout with the request id", async () => {
    const user = await createVerifiedUser();
    const agent = request.agent(app);

    const signin = await agent
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: userData.password })
      .expect(200);
    await agent.post(`${API}/auth/signout`).expect(204);

    const logs = await findAuditLogs();

    expect(logs.map((log) => log.action)).toEqual([
      "auth.signin",
      "auth.signout",
    ]);
    expect(logs[0]).toMatchObject({
      userId: user.id,
      resourceType: "user",
      resourceId: user.id,
      requestId: signin.headers["x-request-id"],
      ip: expect.any(String),
    });
  });

  it("should not record a failed signin", async () => {
    await createVerifiedUser();

    await request(app)
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: "wrong-password" })
      .expect(400);

    expect(await countRows(auditLogs)).toBe(0);
  });

  describe("append-only", () => {
    const createLog = async () => {
      const user = await createVerifiedUser();
      await record({
        userId: user.id,
        action: "auth.signin",
        resourceType: "user",
      });
      const [log] = await findAuditLogs();
      return log!;
    };

    it.each([
      ["UPDATE audit_logs SET action = 'auth.signout'"],
      ["DELETE FROM audit_logs"],
      ["TRUNCATE audit_logs"],
    ])("should deny %s to the API user", async (statement) => {
      await createLog();
      const client = await appClient();

      try {
        await expect(client.query(statement)).rejects.toThrow(
          "permission denied",
        );
      } finally {
        client.release();
      }

      expect(await countRows(auditLogs)).toBe(1);
    });

    it.each([
      ["UPDATE audit_logs SET action = 'auth.signout'"],
      ["DELETE FROM audit_logs"],
      ["TRUNCATE audit_logs"],
    ])("should reject %s even for the schema owner", async (statement) => {
      const log = await createLog();

      await expect(adminQuery(statement)).rejects.toThrow("append-only");

      const [stored] = await findAuditLogs();
      expect(stored).toEqual(log);
    });
  });
});
