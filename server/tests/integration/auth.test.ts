import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { AUDIT_ACTIONS } from '#app/constants/audit.js';
import { ROLES } from '#app/constants/roles.js';
import { AuditLogModel } from '#app/models/audit-log.model.js';
import { REFRESH_COOKIE_NAME } from '#app/utils/refresh-cookie.js';

import { LOGIN_URL, loginAs, refreshCookieFrom } from '../helpers/auth.js';
import { createDoctor, createUser, TEST_PASSWORD } from '../helpers/factories.js';
import { bodyOf, dataOf, setCookieLine } from '../helpers/http.js';

const app = createApp();
const REFRESH_URL = '/api/v1/auth/refresh';
const LOGOUT_URL = '/api/v1/auth/logout';
const CLIENT_URL = 'http://localhost:5173';

const sessionSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    doctorId: z.string().optional(),
  }),
});

describe('POST /api/v1/auth/login', () => {
  it('returns an access token, sets the refresh cookie and records the login', async () => {
    const user = await createUser(ROLES.RECEPTIONIST);

    const res = await request(app)
      .post(LOGIN_URL)
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(dataOf(res, sessionSchema).user).toEqual({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: ROLES.RECEPTIONIST,
    });
    expect(JSON.stringify(bodyOf(res))).not.toMatch(/passwordHash|refreshToken/);
    const cookie = setCookieLine(res, REFRESH_COOKIE_NAME);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(
      await AuditLogModel.countDocuments({ action: AUDIT_ACTIONS.LOGIN, userId: user._id }),
    ).toBe(1);
  });

  it('answers a wrong password and an unknown email with the same 401, and audits both', async () => {
    const user = await createUser(ROLES.RECEPTIONIST);

    const wrongPassword = await request(app)
      .post(LOGIN_URL)
      .send({ email: user.email, password: 'Wrong-password-1' });
    const unknownEmail = await request(app)
      .post(LOGIN_URL)
      .send({ email: 'nobody@clinic.test', password: TEST_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(bodyOf(wrongPassword).message).toBe('Invalid email or password');
    expect(bodyOf(unknownEmail).message).toBe(bodyOf(wrongPassword).message);
    const failures = await AuditLogModel.find({ action: AUDIT_ACTIONS.LOGIN_FAILED }).lean();
    expect(failures.map((entry) => entry.metadata.reason)).toEqual(
      expect.arrayContaining(['WRONG_PASSWORD', 'UNKNOWN_EMAIL']),
    );
  });

  it('refuses a deactivated account', async () => {
    const user = await createUser(ROLES.RECEPTIONIST, { isActive: false });

    const res = await request(app)
      .post(LOGIN_URL)
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(401);
  });

  it("includes a doctor's profile id", async () => {
    const { user, doctor } = await createDoctor();

    const res = await request(app)
      .post(LOGIN_URL)
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(dataOf(res, sessionSchema).user.doctorId).toBe(doctor._id.toString());
  });

  it('rejects an invalid body with 400 and a detail per field', async () => {
    const res = await request(app).post(LOGIN_URL).send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(bodyOf(res).meta.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'body.email' }),
        expect.objectContaining({ field: 'body.password' }),
      ]),
    );
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates the refresh token and returns a new access token', async () => {
    const user = await createUser(ROLES.SUPER_ADMIN);
    const session = await loginAs(app, user.email);

    const res = await request(app).post(REFRESH_URL).set('Cookie', session.refreshCookie);

    expect(res.status).toBe(200);
    expect(dataOf(res, sessionSchema).user.id).toBe(user._id.toString());
    expect(refreshCookieFrom(res)).not.toBe(session.refreshCookie);
  });

  it('revokes every session when a rotated refresh token is used again', async () => {
    const user = await createUser(ROLES.SUPER_ADMIN);
    const { refreshCookie: original } = await loginAs(app, user.email);
    const rotated = refreshCookieFrom(await request(app).post(REFRESH_URL).set('Cookie', original));

    const reuse = await request(app).post(REFRESH_URL).set('Cookie', original);

    expect(reuse.status).toBe(401);
    expect(
      await AuditLogModel.countDocuments({
        action: AUDIT_ACTIONS.REFRESH_TOKEN_REUSE,
        entityId: user._id,
      }),
    ).toBe(1);
    // The newer token dies too, so whoever copied the old one is locked out along with the user.
    const afterReuse = await request(app).post(REFRESH_URL).set('Cookie', rotated);
    expect(afterReuse.status).toBe(401);
  });

  it('rejects a request without a refresh cookie', async () => {
    const res = await request(app).post(REFRESH_URL);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the refresh token and clears the cookie', async () => {
    const user = await createUser(ROLES.RECEPTIONIST);
    const { refreshCookie } = await loginAs(app, user.email);

    const res = await request(app).post(LOGOUT_URL).set('Cookie', refreshCookie);
    const refreshAfterLogout = await request(app).post(REFRESH_URL).set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(setCookieLine(res, REFRESH_COOKIE_NAME)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("accepts the app's own origin", async () => {
    const user = await createUser(ROLES.RECEPTIONIST);
    const { refreshCookie } = await loginAs(app, user.email);

    const res = await request(app)
      .post(LOGOUT_URL)
      .set('Origin', CLIENT_URL)
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(setCookieLine(res, REFRESH_COOKIE_NAME)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

// Found in manual QA: a form posted from another site reached /auth/logout without the cookie
// (SameSite), but the response cleared the cookie anyway and signed the user out.
describe('cross-site requests to the cookie endpoints', () => {
  it.each([LOGOUT_URL, REFRESH_URL])(
    'refuses %s from another origin and leaves the session alone',
    async (url) => {
      const user = await createUser(ROLES.RECEPTIONIST);
      const { refreshCookie } = await loginAs(app, user.email);

      const res = await request(app)
        .post(url)
        .set('Origin', 'https://evil.example')
        .set('Cookie', refreshCookie);

      expect(res.status).toBe(403);
      expect(bodyOf(res).message).toBe('Cross-site requests are not allowed');
      expect(setCookieLine(res, REFRESH_COOKIE_NAME)).toBeUndefined();
      const stillValid = await request(app).post(REFRESH_URL).set('Cookie', refreshCookie);
      expect(stillValid.status).toBe(200);
    },
  );

  it.each([LOGOUT_URL, REFRESH_URL])(
    'does not clear a cookie that %s was not sent',
    async (url) => {
      const res = await request(app).post(url);

      expect(setCookieLine(res, REFRESH_COOKIE_NAME)).toBeUndefined();
    },
  );
});
