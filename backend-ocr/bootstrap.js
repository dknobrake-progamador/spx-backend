require("dotenv").config();

const fs = require("fs");
const path = require("path");

function ensureGoogleCredentialsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return;
  }

  const rawJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  const rawBase64 = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || "").trim();

  let credentialsJson = rawJson;

  if (!credentialsJson && rawBase64) {
    credentialsJson = Buffer.from(rawBase64, "base64").toString("utf8").trim();
  }

  if (!credentialsJson) {
    return;
  }

  const parsed = JSON.parse(credentialsJson);
  const credentialsPath = path.join(__dirname, ".runtime-google-credentials.json");

  fs.writeFileSync(credentialsPath, JSON.stringify(parsed, null, 2));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
}

ensureGoogleCredentialsFile();
require("./server");
