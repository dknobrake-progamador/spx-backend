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
  let parsed;

  try {
    parsed = JSON.parse(credentialsJson);
  } catch (error) {
    console.error("[BOOTSTRAP] Google credentials JSON invalido", {
      length: String(credentialsJson || "").length,
      startsWithJson: String(credentialsJson || "").trim().startsWith("{"),
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      "Credencial Google invalida. Configure GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ou GOOGLE_CREDENTIALS_BASE64 com o JSON completo em base64."
    );
  }

  if (!parsed?.client_email || !parsed?.private_key || !parsed?.project_id) {
    throw new Error(
      "Credencial Google incompleta. O JSON precisa conter project_id, client_email e private_key."
    );
  }

  const credentialsPath = path.join(__dirname, ".runtime-google-credentials.json");

  fs.writeFileSync(credentialsPath, JSON.stringify(parsed, null, 2));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  process.env.GOOGLE_CREDENTIALS_READY = "1";
  process.env.GOOGLE_CREDENTIALS_PROJECT_ID = String(parsed.project_id || "");
}

ensureGoogleCredentialsFile();
require("./server");
