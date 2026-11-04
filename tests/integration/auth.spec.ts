import { eq } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { users } from "../../src/modules/user/user.model.js";
import { sendConfirmationEmail } from "../../src/services/email/email.service.js";
import { messages } from "../../src/shared/messages.js";
import {
  API,
  createVerifiedUser,
  userData,
  waitForConfirmationToken,
} from "./helpers.js";
import { countRows, testDb } from "./database.js";
import {
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_MAX_DURATION_SECONDS,
} from "../../src/modules/auth/session.js";
import { generateToken, verifyToken } from "../../src/utils/token.utils.js";

describe("authentication flow", () => {
  it("should sign up, confirm the email, sign in, read the session and sign out", async () => {
    const agent = request.agent(app);

    const signup = await agent.post(`${API}/users/signup`).send(userData);
    expect(signup.status).toBe(201);
    expect(signup.body).toEqual({
      name: userData.name,
      email: userData.email,
      coren: userData.coren,
      corenState: userData.corenState,
    });

    const [stored] = await testDb()
      .select()
      .from(users)
      .where(eq(users.email, userData.email));
    expect(stored?.passwordHash).not.toBe(userData.password);
    expect(stored?.emailVerifiedAt).toBeNull();

    const token = await waitForConfirmationToken();
    expect(sendConfirmationEmail).toHaveBeenCalledWith(
      userData.email,
      userData.name,
      expect.stringContaining(`?token=${token}`),
    );

    const beforeConfirmation = await agent
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: userData.password });
    expect(beforeConfirmation.status).toBe(400);
    expect(beforeConfirmation.body.message).toBe(messages.INVALID_CREDENTIALS);

    const validate = await agent.get(`${API}/users/validate`).query({ token });
    expect(validate.status).toBe(200);

    const signin = await agent
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: userData.password });
    expect(signin.status).toBe(200);
    expect(signin.headers["set-cookie"]?.[0]).toMatch(/^token=.+HttpOnly/);

    expect(signin.body.sessionExpiresAt).toBe(
      signin.headers["x-session-expires-at"],
    );

    const me = await agent.get(`${API}/auth/me`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      name: userData.name,
      email: userData.email,
      coren: userData.coren,
      corenState: userData.corenState,
      sessionExpiresAt: me.headers["x-session-expires-at"],
    });

    const signout = await agent.post(`${API}/auth/signout`);
    expect(signout.status).toBe(204);
    expect(signout.headers["x-session-expires-at"]).toBeUndefined();
    expect(signout.headers["set-cookie"]).toHaveLength(1);
    expect(signout.headers["set-cookie"]?.[0]).toMatch(/^token=;/);

    const afterSignout = await agent.get(`${API}/auth/me`);
    expect(afterSignout.status).toBe(401);
  });

  it("should not reuse a confirmation token", async () => {
    await request(app).post(`${API}/users/signup`).send(userData);
    const token = await waitForConfirmationToken();

    await request(app).get(`${API}/users/validate`).query({ token });
    const reuse = await request(app)
      .get(`${API}/users/validate`)
      .query({ token });

    expect(reuse.status).toBe(422);
  });

  it("should reject an unknown confirmation token", async () => {
    const response = await request(app)
      .get(`${API}/users/validate`)
      .query({ token: "unknown" });

    expect(response.status).toBe(422);
  });

  it("should reject a signup with an email already registered", async () => {
    await createVerifiedUser();

    const response = await request(app)
      .post(`${API}/users/signup`)
      .send({ ...userData, email: userData.email.toUpperCase() });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      messages.INVALID_REGISTRATION_CREDENTIALS,
    );
    expect(await countRows(users)).toBe(1);
  });

  it("should reject an invalid signup payload", async () => {
    const response = await request(app).post(`${API}/users/signup`).send({
      name: "",
      email: "not-an-email",
      password: "short",
      coren: "abc",
      corenState: "XX",
    });

    expect(response.status).toBe(422);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        "O COREN deve conter apenas números",
        "UF do COREN inválida",
      ]),
    );
    expect(await countRows(users)).toBe(0);
  });

  it("should reject a wrong password", async () => {
    await createVerifiedUser();

    const response = await request(app)
      .post(`${API}/auth/signin`)
      .send({ email: userData.email, password: "wrong-password" });

    expect(response.status).toBe(400);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("should reject requests without a valid session cookie", async () => {
    const withoutCookie = await request(app).get(`${API}/auth/me`);
    expect(withoutCookie.status).toBe(401);

    const withInvalidCookie = await request(app)
      .get(`${API}/auth/me`)
      .set("Cookie", "token=invalid");
    expect(withInvalidCookie.status).toBe(401);
  });

  it("should answer resend with 200 without sending an email for an unknown address", async () => {
    const response = await request(app)
      .post(`${API}/users/resend`)
      .send({ email: "ghost@example.com" });

    expect(response.status).toBe(200);
    expect(sendConfirmationEmail).not.toHaveBeenCalled();
  });
});

describe("sliding session", () => {
  const nowInSeconds = () => Math.floor(Date.now() / 1000);

  const sessionCookie = (userId: string, authTime: number, expiresAt: number) =>
    `token=${generateToken({ sub: userId, auth_time: authTime }, expiresAt)}`;

  it("should renew the session on every authenticated request", async () => {
    const user = await createVerifiedUser();
    const authTime = nowInSeconds() - 60 * 60;

    const response = await request(app)
      .get(`${API}/patients`)
      .set("Cookie", sessionCookie(user.id, authTime, nowInSeconds() + 60));

    expect(response.status).toBe(200);

    const expiresAt = Date.parse(response.headers["x-session-expires-at"]);
    const idleLimit = (nowInSeconds() + SESSION_IDLE_TIMEOUT_SECONDS) * 1000;
    expect(Math.abs(expiresAt - idleLimit)).toBeLessThanOrEqual(1000);

    const cookie = response.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toMatch(/^token=.+HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);

    const renewed = verifyToken(cookie.split(";")[0]!.slice("token=".length));
    expect(renewed["auth_time"]).toBe(authTime);
  });

  it("should not extend the session past the maximum duration", async () => {
    const user = await createVerifiedUser();
    const authTime = nowInSeconds() - SESSION_MAX_DURATION_SECONDS + 5 * 60;

    const response = await request(app)
      .get(`${API}/auth/me`)
      .set("Cookie", sessionCookie(user.id, authTime, nowInSeconds() + 60));

    expect(response.status).toBe(200);
    expect(response.body.sessionExpiresAt).toBe(
      new Date((authTime + SESSION_MAX_DURATION_SECONDS) * 1000).toISOString(),
    );
  });

  it("should reject an expired session without renewing it", async () => {
    const user = await createVerifiedUser();

    const response = await request(app)
      .get(`${API}/auth/me`)
      .set(
        "Cookie",
        sessionCookie(user.id, nowInSeconds() - 60 * 60, nowInSeconds() - 1),
      );

    expect(response.status).toBe(401);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.headers["x-session-expires-at"]).toBeUndefined();
  });
});
