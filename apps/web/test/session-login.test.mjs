import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testDirectory, "..");
const routePath = path.join(appRoot, "app/api/session/[action]/route.ts");
const refreshRoutePath = path.join(appRoot, "app/api/session/refresh/route.ts");
const authCooldownPath = path.join(appRoot, "lib/auth-cooldown.ts");
const customerAccessPath = path.join(appRoot, "lib/customer-access.ts");
const sessionApiPath = path.join(appRoot, "lib/session-api.ts");
const notificationsPath = path.resolve(appRoot, "../../packages/ui/src/notifications.ts");

function loadTypeScriptModule(filename, mocks = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (specifier) => (
    Object.hasOwn(mocks, specifier) ? mocks[specifier] : originalRequire(specifier)
  );
  loaded._compile(compiled.outputText, filename);
  return loaded.exports;
}

const notifications = loadTypeScriptModule(notificationsPath);
const sessionApi = loadTypeScriptModule(sessionApiPath, {
  "@keydrop/ui/notifications": notifications,
});
const authCooldown = loadTypeScriptModule(authCooldownPath);
const csrfToken = sessionApi.createCsrfToken();
const cookieStore = {
  values: new Map([[sessionApi.sessionCookies.csrf, csrfToken]]),
  get(name) {
    const value = this.values.get(name);
    return value === undefined ? undefined : { value };
  },
};
const customerAccess = loadTypeScriptModule(customerAccessPath, {
  "next/headers": { cookies: async () => cookieStore },
  "./session-api": sessionApi,
});
const { POST } = loadTypeScriptModule(routePath, {
  "next/headers": { cookies: async () => cookieStore },
  "../../../../lib/customer-access": customerAccess,
  "../../../../lib/session-api": sessionApi,
});
const { GET: refresh } = loadTypeScriptModule(refreshRoutePath, {
  "next/headers": { cookies: async () => cookieStore },
  "../../../../lib/customer-access": customerAccess,
  "../../../../lib/auth-return-path": { getCustomerReturnTo: (value) => value || "/app/secrets" },
  "../../../../lib/session-api": sessionApi,
});

function createRequest() {
  return new Request("http://localhost/api/session/login", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ email: "customer@example.test", password: "not-a-real-password" }),
  });
}

test("201 login response validates the customer and establishes the session", async () => {
  const backendCalls = [];
  sessionApi.requestBackend = async (endpoint, options = {}) => {
    backendCalls.push({ endpoint, bearer: options.bearer });
    if (endpoint === "/auth/login") {
      return {
        ok: true,
        status: 201,
        data: {
          accessToken: "synthetic-access-token",
          idToken: "synthetic-id-token",
          refreshToken: "synthetic-refresh-token",
          expiresIn: 3600,
          tokenType: "bearer",
        },
      };
    }
    return {
      ok: true,
      status: 200,
      data: {
        id: "synthetic-user-id",
        email: "customer@example.test",
        plan: "free",
        createdAt: "2026-01-01T00:00:00.000Z",
        adminUser: null,
      },
    };
  };

  const response = await POST(createRequest(), { params: Promise.resolve({ action: "login" }) });
  const cookies = response.headers.getSetCookie().join("\n");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(backendCalls, [
    { endpoint: "/auth/login", bearer: undefined },
    { endpoint: "/users/me", bearer: "synthetic-access-token" },
  ]);
  for (const name of [
    sessionApi.sessionCookies.access,
    sessionApi.sessionCookies.id,
    sessionApi.sessionCookies.refresh,
    sessionApi.sessionCookies.csrf,
  ]) {
    assert.match(cookies, new RegExp(`(?:^|\\n)${name}=`));
  }
  assert.match(cookies, new RegExp(`${sessionApi.sessionCookies.access}=synthetic-access-token;.*HttpOnly`));
  assert.match(cookies, new RegExp(`${sessionApi.sessionCookies.id}=synthetic-id-token;.*HttpOnly`));
  assert.match(cookies, new RegExp(`${sessionApi.sessionCookies.refresh}=synthetic-refresh-token;.*HttpOnly`));
});

test("invalid credentials preserve the upstream 401 without establishing a session", async () => {
  sessionApi.requestBackend = async () => ({
    ok: false,
    status: 401,
    error: "We couldn't sign you in with those details. Please check your email and password and try again.",
  });

  const response = await POST(createRequest(), { params: Promise.resolve({ action: "login" }) });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "We couldn't sign you in with those details. Please check your email and password and try again.",
  });
  assert.equal(response.headers.get("set-cookie"), null);
});

test("upstream login failures retain 502 and log only diagnostic metadata", async () => {
  sessionApi.requestBackend = async () => ({
    ok: false,
    status: 502,
    error: "We hit a temporary snag. Please try again in a moment.",
    code: "not-logged-as-code",
  });
  const originalConsoleError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);

  try {
    const response = await POST(createRequest(), { params: Promise.resolve({ action: "login" }) });
    const diagnostic = JSON.stringify(logged);

    assert.equal(response.status, 502);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.match(diagnostic, /backend_login/);
    assert.match(diagnostic, /502/);
    assert.doesNotMatch(diagnostic, /not-logged-as-code/);
    assert.doesNotMatch(diagnostic, /not-a-real-password|synthetic-access-token/);
  } finally {
    console.error = originalConsoleError;
  }
});

test("session action proxy forwards signup, verification, resend, and password-reset payloads", async () => {
  const expected = [
    ["/auth/signup", { email: "customer@example.test", password: "not-a-real-password" }, {
      email: "customer@example.test",
      emailConfirmed: false,
      nextStep: "confirm_email",
    }],
    ["/auth/email/verify", { email: "customer@example.test", code: "001234" }, {
      email: "customer@example.test",
      emailVerified: true,
    }],
    ["/auth/email/resend", { email: "customer@example.test" }, { ok: true }],
    ["/auth/password/forgot", { email: "customer@example.test" }, { ok: true }],
    ["/auth/password/reset", {
      email: "customer@example.test",
      code: "001234",
      newPassword: "another-probe-password",
    }, { ok: true }],
  ];
  const calls = [];
  sessionApi.requestBackend = async (endpoint, options = {}) => {
    const result = expected.find(([path]) => path === endpoint);
    calls.push({ endpoint, body: options.body });
    return { ok: true, status: endpoint === "/auth/email/verify" ? 201 : 200, data: result[2] };
  };

  for (const [action, body, responseBody] of [
    ["signup", expected[0][1], expected[0][2]],
    ["verify-email", expected[1][1], expected[1][2]],
    ["resend-verification", expected[2][1], expected[2][2]],
    ["forgot", expected[3][1], expected[3][2]],
    ["reset-password", expected[4][1], expected[4][2]],
  ]) {
    const request = new Request(`http://localhost/api/session/${action}`, {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(body),
    });
    const response = await POST(request, { params: Promise.resolve({ action }) });
    assert.equal(response.status, action === "verify-email" ? 201 : 200);
    assert.deepEqual(await response.json(), responseBody);
  }

  assert.deepEqual(calls, expected.map(([endpoint, body]) => ({ endpoint, body })));
  assert.equal(calls[1].body.code, "001234");
});

test("signup, verification, then login supports a 201 login response", async () => {
  const calls = [];
  sessionApi.requestBackend = async (endpoint, options = {}) => {
    calls.push({ endpoint, body: options.body, bearer: options.bearer });
    if (endpoint === "/auth/signup") {
      return {
        ok: true,
        status: 201,
        data: {
          email: options.body.email,
          emailConfirmed: false,
          nextStep: "confirm_email",
        },
      };
    }
    if (endpoint === "/auth/email/verify") {
      return {
        ok: true,
        status: 201,
        data: { email: options.body.email, emailVerified: true },
      };
    }
    if (endpoint === "/auth/login") {
      return {
        ok: true,
        status: 201,
        data: {
          accessToken: "synthetic-access-token",
          idToken: "synthetic-id-token",
          refreshToken: "synthetic-refresh-token",
          expiresIn: 3600,
          tokenType: "bearer",
        },
      };
    }
    return {
      ok: true,
      status: 200,
      data: {
        id: "synthetic-user-id",
        email: "customer@example.test",
        plan: "free",
        createdAt: "2026-01-01T00:00:00.000Z",
        adminUser: null,
      },
    };
  };

  async function submit(action, body) {
    return POST(new Request(`http://localhost/api/session/${action}`, {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ action }) });
  }

  const signup = await submit("signup", {
    email: "customer@example.test",
    password: "not-a-real-password",
  });
  assert.deepEqual(await signup.json(), {
    email: "customer@example.test",
    emailConfirmed: false,
    nextStep: "confirm_email",
  });
  const verification = await submit("verify-email", {
    email: "customer@example.test",
    code: "001234",
  });
  assert.deepEqual(await verification.json(), {
    email: "customer@example.test",
    emailVerified: true,
  });
  const login = await submit("login", {
    email: "customer@example.test",
    password: "not-a-real-password",
  });

  assert.equal(login.status, 200);
  assert.deepEqual(await login.json(), { ok: true });
  assert.deepEqual(calls.map(({ endpoint }) => endpoint), [
    "/auth/signup",
    "/auth/email/verify",
    "/auth/login",
    "/users/me",
  ]);
  assert.equal(calls[1].body.code, "001234");
  assert.equal(calls[3].bearer, "synthetic-access-token");
});

test("resend rate limits are returned to the UI as 429", async () => {
  sessionApi.requestBackend = async () => ({
    ok: false,
    status: 429,
    error: "Please wait a moment before trying again.",
    code: "rate_limited",
  });
  const response = await POST(new Request("http://localhost/api/session/resend-verification", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ email: "customer@example.test" }),
  }), { params: Promise.resolve({ action: "resend-verification" }) });

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {
    error: "Please wait a moment before trying again.",
    code: "rate_limited",
  });
  assert.equal(authCooldown.getResendCooldownSeconds(response.status), 60);
  assert.equal(authCooldown.verificationResendCooldownSeconds, 60);
  assert.equal(authCooldown.getResendCooldownSeconds(503), 0);
});

test("logout clears every session cookie even if upstream revocation fails", async () => {
  cookieStore.values.set(sessionApi.sessionCookies.access, "synthetic-access-token");
  sessionApi.requestBackend = async () => ({
    ok: false,
    status: 503,
    error: "Keydrop is having trouble right now. Try again shortly.",
  });
  const response = await POST(new Request("http://localhost/api/session/logout", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: "{}",
  }), { params: Promise.resolve({ action: "logout" }) });
  const setCookies = response.headers.getSetCookie().join("\n");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    warning: "Your browser session was cleared, but Keydrop could not confirm server-side token revocation.",
  });
  for (const name of [
    sessionApi.sessionCookies.access,
    sessionApi.sessionCookies.id,
    sessionApi.sessionCookies.refresh,
  ]) {
    assert.match(setCookies, new RegExp(`${name}=;.*Max-Age=0`));
  }
  cookieStore.values.delete(sessionApi.sessionCookies.access);
});

test("refresh retains an existing refresh cookie when the successful response omits its replacement", async () => {
  const existingRefreshToken = "synthetic-existing-refresh-token";
  cookieStore.values.set(sessionApi.sessionCookies.refresh, existingRefreshToken);
  const calls = [];
  sessionApi.requestBackend = async (endpoint, options = {}) => {
    calls.push({ endpoint, body: options.body, bearer: options.bearer });
    if (endpoint === "/auth/token/refresh") {
      return {
        ok: true,
        status: 201,
        data: {
          accessToken: "synthetic-refreshed-access-token",
          idToken: "synthetic-refreshed-id-token",
          expiresIn: 3600,
          tokenType: "bearer",
        },
      };
    }
    return {
      ok: true,
      status: 200,
      data: {
        id: "synthetic-user-id",
        email: "customer@example.test",
        plan: "free",
        createdAt: "2026-01-01T00:00:00.000Z",
        adminUser: null,
      },
    };
  };
  const response = await refresh(new Request("http://localhost/api/session/refresh?returnTo=%2Fapp%2Fsecrets"));
  const setCookies = response.headers.getSetCookie().join("\n");

  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")).pathname, "/app/secrets");
  assert.deepEqual(calls, [
    {
      endpoint: "/auth/token/refresh",
      body: { refreshToken: existingRefreshToken },
      bearer: undefined,
    },
    {
      endpoint: "/users/me",
      body: undefined,
      bearer: "synthetic-refreshed-access-token",
    },
  ]);
  assert.match(setCookies, new RegExp(`${sessionApi.sessionCookies.access}=synthetic-refreshed-access-token`));
  assert.match(setCookies, new RegExp(`${sessionApi.sessionCookies.id}=synthetic-refreshed-id-token`));
  assert.doesNotMatch(setCookies, new RegExp(`${sessionApi.sessionCookies.refresh}=`));
  assert.equal(cookieStore.get(sessionApi.sessionCookies.refresh).value, existingRefreshToken);
});

test("failed refresh clears session cookies", async () => {
  cookieStore.values.set(sessionApi.sessionCookies.access, "synthetic-access-token");
  cookieStore.values.set(sessionApi.sessionCookies.id, "synthetic-id-token");
  cookieStore.values.set(sessionApi.sessionCookies.refresh, "synthetic-refresh-token");
  sessionApi.requestBackend = async () => ({
    ok: false,
    status: 503,
    error: "Keydrop is having trouble right now. Try again shortly.",
  });
  const response = await refresh(new Request("http://localhost/api/session/refresh?returnTo=%2Fapp%2Fsecrets"));
  const setCookies = response.headers.getSetCookie().join("\n");

  assert.equal(response.status, 307);
  assert.match(new URL(response.headers.get("location")).searchParams.get("session"), /unavailable/);
  for (const name of [
    sessionApi.sessionCookies.access,
    sessionApi.sessionCookies.id,
    sessionApi.sessionCookies.refresh,
  ]) {
    assert.match(setCookies, new RegExp(`${name}=;.*Max-Age=0`));
    cookieStore.values.delete(name);
  }
});

test("failed profile validation after refresh also clears session cookies", async () => {
  cookieStore.values.set(sessionApi.sessionCookies.access, "synthetic-access-token");
  cookieStore.values.set(sessionApi.sessionCookies.id, "synthetic-id-token");
  cookieStore.values.set(sessionApi.sessionCookies.refresh, "synthetic-refresh-token");
  sessionApi.requestBackend = async (endpoint) => endpoint === "/auth/token/refresh"
    ? {
      ok: true,
      status: 201,
      data: {
        accessToken: "synthetic-refreshed-access-token",
        idToken: "synthetic-refreshed-id-token",
        expiresIn: 3600,
        tokenType: "bearer",
      },
    }
    : {
      ok: false,
      status: 503,
      error: "Keydrop is having trouble right now. Try again shortly.",
    };
  const response = await refresh(new Request("http://localhost/api/session/refresh?returnTo=%2Fapp%2Fsecrets"));
  const setCookies = response.headers.getSetCookie().join("\n");

  assert.equal(response.status, 307);
  assert.match(new URL(response.headers.get("location")).searchParams.get("session"), /unavailable/);
  for (const name of [
    sessionApi.sessionCookies.access,
    sessionApi.sessionCookies.id,
    sessionApi.sessionCookies.refresh,
  ]) {
    assert.match(setCookies, new RegExp(`${name}=;.*Max-Age=0`));
    cookieStore.values.delete(name);
  }
});
