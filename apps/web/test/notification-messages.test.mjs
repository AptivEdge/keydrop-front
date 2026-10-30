import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testDirectory, "..");

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

const uiNotifications = loadTypeScriptModule(
  path.join(appRoot, "../../packages/ui/src/notifications.ts"),
);
const sessionApi = loadTypeScriptModule(
  path.join(appRoot, "lib/session-api.ts"),
  { "@keydrop/ui/notifications": uiNotifications },
);

test("API error statuses use the shared plain-language notification enum", () => {
  const { getApiNotificationMessage, NotificationMessage } = uiNotifications;

  assert.equal(getApiNotificationMessage(429), NotificationMessage.TooManyAttempts);
  assert.equal(
    getApiNotificationMessage(401, undefined, "/auth/login"),
    NotificationMessage.SignInDetailsRejected,
  );
  assert.equal(
    getApiNotificationMessage(401, undefined, "/users/me"),
    NotificationMessage.SignInRequired,
  );
  assert.equal(getApiNotificationMessage(403), NotificationMessage.AccessDenied);
  assert.equal(getApiNotificationMessage(404), NotificationMessage.NotFound);
  assert.equal(getApiNotificationMessage(409), NotificationMessage.AlreadyUpdated);
  assert.equal(getApiNotificationMessage(422), NotificationMessage.CheckDetails);
  assert.equal(getApiNotificationMessage(408), NotificationMessage.ApiTimeout);
  assert.equal(getApiNotificationMessage(504), NotificationMessage.ApiTimeout);
  assert.equal(getApiNotificationMessage(503), NotificationMessage.ApiTemporarilyUnavailable);
  assert.equal(getApiNotificationMessage(400, "validation_failed"), NotificationMessage.CheckDetails);
});

test("backend connection failures hide technical details behind friendly messages", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiUrl = process.env.KEYDROP_API_BASE_URL;
  process.env.KEYDROP_API_BASE_URL = "https://api.example.test/api/v1";

  try {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed: ECONNREFUSED 127.0.0.1:4000");
    };
    const unavailable = await sessionApi.requestBackend("/health");
    assert.equal(unavailable.error, uiNotifications.NotificationMessage.ApiUnavailable);
    assert.doesNotMatch(unavailable.error, /ECONNREFUSED|127\.0\.0\.1/);

    globalThis.fetch = async () => new Response(
      JSON.stringify({ message: "Database unavailable: internal host db-01" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
    const serverError = await sessionApi.requestBackend("/health");
    assert.equal(serverError.error, uiNotifications.NotificationMessage.ApiTemporarilyUnavailable);
    assert.doesNotMatch(serverError.error, /Database|db-01/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiUrl === undefined) {
      delete process.env.KEYDROP_API_BASE_URL;
    } else {
      process.env.KEYDROP_API_BASE_URL = originalApiUrl;
    }
  }
});
