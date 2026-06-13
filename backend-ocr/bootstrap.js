require("dotenv").config();

const fs = require("fs");
const path = require("path");

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

function parseCredentialsCandidate(name, value) {
  const credentialsJson = decodeMaybeBase64(value) || String(value || "").trim();
  if (!credentialsJson) return null;

  try {
    const parsed = JSON.parse(credentialsJson);
    if (!parsed?.client_email || !parsed?.private_key || !parsed?.project_id) {
      console.warn("[BOOTSTRAP] Google credentials incompleta ignorada", {
        name,
        hasClientEmail: !!parsed?.client_email,
        hasPrivateKey: !!parsed?.private_key,
        hasProjectId: !!parsed?.project_id,
      });
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn("[BOOTSTRAP] Google credentials invalida ignorada", {
      name,
      length: credentialsJson.length,
      startsWithJson: credentialsJson.trim().startsWith("{"),
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function getCredentialsFromEnv(names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (!value) continue;
    const parsed = parseCredentialsCandidate(name, value);
    if (parsed) return parsed;
  }
  return null;
}

function getCredentialsFromFile(filePath, label) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const content = fs.readFileSync(filePath, "utf8");
    return parseCredentialsCandidate(label || `file:${filePath}`, content);
  } catch (error) {
    console.warn("[BOOTSTRAP] falha ao ler arquivo de credencial", {
      label,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function getCredentialsFromSecretFiles() {
  const secretDir = "/etc/secrets";
  try {
    if (!fs.existsSync(secretDir)) return null;

    const entries = fs
      .readdirSync(secretDir)
      .sort((a, b) => {
        const score = (name) => {
          const lower = String(name || "").toLowerCase();
          if (lower === "google-credentials.json") return 0;
          if (lower.includes("credential")) return 1;
          if (lower.includes("firebase")) return 2;
          if (lower.endsWith(".json")) return 3;
          return 4;
        };
        return score(a) - score(b) || a.localeCompare(b);
      });

    for (const entry of entries) {
      const filePath = path.join(secretDir, entry);
      const parsed = getCredentialsFromFile(filePath, `secret:${entry}`);
      if (parsed) {
        console.log("[BOOTSTRAP] credencial Google carregada de Secret File", { entry });
        return parsed;
      }
    }
  } catch (error) {
    console.warn("[BOOTSTRAP] falha ao varrer /etc/secrets", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}

function ensureGoogleCredentialsFile() {
  const applicationCredentials = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  if (applicationCredentials) {
    const resolvedPath = path.isAbsolute(applicationCredentials)
      ? applicationCredentials
      : path.resolve(__dirname, applicationCredentials);

    if (fs.existsSync(resolvedPath)) {
      const parsedFileCredentials = getCredentialsFromFile(
        resolvedPath,
        "GOOGLE_APPLICATION_CREDENTIALS_FILE"
      );
      if (parsedFileCredentials) {
        writeRuntimeCredentialsFile(parsedFileCredentials);
        return;
      }

      console.warn("[BOOTSTRAP] GOOGLE_APPLICATION_CREDENTIALS existe, mas nao e JSON valido", {
        resolvedPath,
      });
    }

    console.warn("[BOOTSTRAP] GOOGLE_APPLICATION_CREDENTIALS path nao encontrado", {
      resolvedPath,
    });

    const parsedInlineCredentials = parseCredentialsCandidate(
      "GOOGLE_APPLICATION_CREDENTIALS",
      applicationCredentials
    );
    if (parsedInlineCredentials) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "";
      writeRuntimeCredentialsFile(parsedInlineCredentials);
      return;
    }
  }

  const parsedFromEnv = getCredentialsFromEnv([
    "GOOGLE_SERVICE_ACCOUNT_JSON",
    "GOOGLE_CREDENTIALS",
    "GOOGLE_CREDENTIALS_JSON",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "FIREBASE_ADMIN_CREDENTIALS",
    "GOOGLE_APPLICATION_CREDENTIALS_JSON",
    "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64",
    "GOOGLE_CREDENTIALS_BASE64",
    "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
  ]);

  if (parsedFromEnv) {
    writeRuntimeCredentialsFile(parsedFromEnv);
    return;
  }

  const parsedFromSecrets = getCredentialsFromSecretFiles();
  if (parsedFromSecrets) {
    writeRuntimeCredentialsFile(parsedFromSecrets);
    return;
  }

  if (!parsedFromEnv && !parsedFromSecrets) {
    console.warn(
      "Google credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, or add a valid Secret File in /etc/secrets."
    );
    return;
  }
}

function writeRuntimeCredentialsFile(parsed) {
  const credentialsPath = path.join(__dirname, ".runtime-google-credentials.json");

  fs.writeFileSync(credentialsPath, JSON.stringify(parsed, null, 2));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  process.env.GOOGLE_CREDENTIALS_READY = "1";
  process.env.GOOGLE_CREDENTIALS_PROJECT_ID = String(parsed.project_id || "");
}

ensureGoogleCredentialsFile();
require("./server");
