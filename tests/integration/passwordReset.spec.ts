import { eq } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import app from "../../src/app.js";
import { passwordResetTokens } from "../../src/modules/auth/passwordResetToken.model.js";
import { sendPasswordResetEmail } from "../../src/services/email/email.service.js";
import {
  API,
  createUnverifiedUser,
  createVerifiedUser,
  userData,
  waitForPasswordResetToken,
} from "./helpers.js";
import { countRows, testDb } from "./database.js";

const newPassword = "new-password-456";

const signin = (password: string) =>
  request(app)
    .post(`${API}/auth/signin`)
    .send({ email: userData.email, password });

describe("password reset", () => {
  it("should reset the password with the emailed token and end older sessions", async () => {
    await createVerifiedUser();

    const oldSession = request.agent(app);
    await oldSession
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    await request(app)
      .post(`${API}/auth/forgot-password`)
      .send({ email: userData.email })
      .expect(200);

    const token = await waitForPasswordResetToken();
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      userData.email,
      userData.name,
      expect.stringContaining(`?token=${token}`),
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const reset = await request(app)
      .post(`${API}/auth/reset-password`)
      .send({ token, password: newPassword });
    expect(reset.status).toBe(200);

    await oldSession.get(`${API}/auth/me`).expect(401);
    await signin(userData.password).expect(400);
    await signin(newPassword).expect(200);

    const reuse = await request(app)
      .post(`${API}/auth/reset-password`)
      .send({ token, password: "another-password" });
    expect(reuse.status).toBe(422);
  });

  it("should invalidate older reset links once the password is changed", async () => {
    const user = await createVerifiedUser();

    await request(app)
      .post(`${API}/auth/forgot-password`)
      .send({ email: userData.email });
    const firstToken = await waitForPasswordResetToken();

    await testDb()
      .update(passwordResetTokens)
      .set({ createdAt: new Date(Date.now() - 5 * 60 * 1000) })
      .where(eq(passwordResetTokens.userId, user.id));
    vi.mocked(sendPasswordResetEmail).mockClear();

    await request(app)
      .post(`${API}/auth/forgot-password`)
      .send({ email: userData.email });
    const secondToken = await waitForPasswordResetToken();
    expect(secondToken).not.toBe(firstToken);

    await request(app)
      .post(`${API}/auth/reset-password`)
      .send({ token: secondToken, password: newPassword })
      .expect(200);

    await request(app)
      .post(`${API}/auth/reset-password`)
      .send({ token: firstToken, password: "another-password" })
      .expect(422);
  });

  it("should not send a second email within the cooldown", async () => {
    await createVerifiedUser();

    await request(app)
      .post(`${API}/auth/forgot-password`)
      .send({ email: userData.email });
    await waitForPasswordResetToken();

    await request(app)
      .post(`${API}/auth/forgot-password`)
      .send({ email: userData.email })
      .expect(200);

    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();
    expect(await countRows(passwordResetTokens)).toBe(1);
  });

  it("should answer 200 without sending an email for an unknown address", async () => {
    await request(app)
      .post(`${API}/auth/forgot-password`)
      .send({ email: "ghost@example.com" })
      .expect(200);

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("should reject an unknown token and a weak password", async () => {
    await request(app)
      .post(`${API}/auth/reset-password`)
      .send({ token: "unknown", password: newPassword })
      .expect(422);

    await request(app)
      .post(`${API}/auth/reset-password`)
      .send({ token: "unknown", password: "short" })
      .expect(422);
  });

  it("should confirm the email of an unverified account", async () => {
    await createUnverifiedUser();

    await request(app)
      .post(`${API}/auth/forgot-password`)
      .send({ email: userData.email });
    const token = await waitForPasswordResetToken();

    await request(app)
      .post(`${API}/auth/reset-password`)
      .send({ token, password: newPassword })
      .expect(200);

    await signin(newPassword).expect(200);
  });
});
