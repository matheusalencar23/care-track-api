import mongoose from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import AuditLog from "../../src/modules/audit/auditLog.model.js";
import { record } from "../../src/modules/audit/auditLog.service.js";
import { API, createVerifiedUser, userData } from "./helpers.js";

describe("audit log", () => {
  it("should record signin and signout with the request id", async () => {
    const user = await createVerifiedUser();
    const agent = request.agent(app);

    const signin = await agent
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: userData.password })
      .expect(200);
    await agent.post(`${API}/auth/signout`).expect(204);

    const logs = await AuditLog.find().sort({ createdAt: 1, _id: 1 }).lean();

    expect(logs.map((log) => log.action)).toEqual([
      "auth.signin",
      "auth.signout",
    ]);
    expect(logs[0]).toMatchObject({
      userId: user._id,
      resourceType: "user",
      resourceId: user._id,
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

    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it("should reject updates and deletes", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    await record({ userId, action: "auth.signin", resourceType: "user" });
    const log = await AuditLog.findOne().orFail();

    await expect(
      AuditLog.updateOne({ _id: log._id }, { action: "auth.signout" }),
    ).rejects.toThrow("append-only");
    await expect(
      AuditLog.findOneAndUpdate({ _id: log._id }, { ip: "1.1.1.1" }),
    ).rejects.toThrow("append-only");
    await expect(AuditLog.deleteOne({ _id: log._id })).rejects.toThrow(
      "append-only",
    );
    await expect(AuditLog.deleteMany({})).rejects.toThrow("append-only");

    log.action = "auth.signout";
    await expect(log.save()).rejects.toThrow("append-only");

    const stored = await AuditLog.findById(log._id).lean();
    expect(stored?.action).toBe("auth.signin");
  });
});
