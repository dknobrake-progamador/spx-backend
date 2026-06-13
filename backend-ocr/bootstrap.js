require("dotenv").config();

const fs = require("fs");
const path = require("path");

function getFirstEnv(names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function decodeMaybeBase64(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (trimmed.startsWith("{")) return trimmed;

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
    return decoded.startsWith("{") ? decoded : "";
  } catch {
    return "";
  }
}

function ensureGoogleCredentialsFile() {
  const applicationCredentials = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  if (applicationCredentials) {
    const resolvedPath = path.isAbsolute(applicationCredentials)
      ? applicationCredentials
      : path.resolve(__dirname, applicationCredentials);

    if (fs.existsSync(resolvedPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
      return;
    }

    const inlineCredentials = decodeMaybeBase64(applicationCredentials);
    if (inlineCredentials) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "";
      writeRuntimeCredentialsFile(inlineCredentials);
      return;
    }
  }

  const rawJson = getFirstEnv([
    "GOOGLE_SERVICE_ACCOUNT_JSON",
    "GOOGLE_CREDENTIALS",
    "GOOGLE_CREDENTIALS_JSON",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "FIREBASE_ADMIN_CREDENTIALS",
    "GOOGLE_APPLICATION_CREDENTIALS_JSON",
  ]);
  const rawBase64 = getFirstEnv([
    "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64",
    "GOOGLE_CREDENTIALS_BASE64",
    "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
  ]);

  let credentialsJson = rawJson;

  if (!credentialsJson && rawBase64) {
    credentialsJson = decodeMaybeBase64(rawBase64);
  }

  if (!credentialsJson) {
    console.warn(
      "Google credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_CREDENTIALS, GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, or GOOGLE_APPLICATION_CREDENTIALS."
    );
    return;
  }

  writeRuntimeCredentialsFile(credentialsJson);
}

function writeRuntimeCredentialsFile(credentialsJson) {
  const parsed = JSON.parse(credentialsJson);
  const credentialsPath = path.join(__dirname, ".runtime-google-credentials.json");

  fs.writeFileSync(credentialsPath, JSON.stringify(parsed, null, 2));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
}

ensureGoogleCredentialsFile();
require("./server");
