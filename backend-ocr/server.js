require("dotenv").config();

const express = require("express");
const cors = require("cors");
const vision = require("@google-cloud/vision");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const { extractOccurrencesFromText } = require("./occurrence-parser");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || "spx-motorista-parceiro",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "spx-motorista-parceiro.firebasestorage.app",
  });
}

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json({ limit: "80mb" }));

const client = new vision.ImageAnnotatorClient();
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "spx-motorista-parceiro";
const MASTER_LOGIN = "21978818116";
const ADMIN_CONFIG_COLLECTION = "system";
const ADMIN_CONFIG_DOC = "admin-control";
const SIGNUP_REQUESTS_COLLECTION = "signupRequests";

function normalizePhoneBR(raw = "") {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

function userDocId(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function normalizePhoneDigits(raw = "") {
  return String(raw).replace(/\D/g, "");
}

function normalizeToLocalBrPhone(raw = "") {
  const digits = normalizePhoneDigits(raw);
  if (digits.startsWith("55") && digits.length === 13) {
    return digits.slice(2);
  }
  return digits;
}

function resolveRole(userData = {}, uid = "") {
  const storedRole = String(userData.role || "").trim().toLowerCase();
  if (
    normalizeToLocalBrPhone(uid) === MASTER_LOGIN ||
    normalizeToLocalBrPhone(userData.phone || "") === MASTER_LOGIN
  ) {
    return "master";
  }
  if (storedRole === "admin2" || storedRole === "admin" || storedRole === "adm") {
    return "admin2";
  }
  return "user";
}

function resolveCanUploadPhotos(userData = {}) {
  if (userData.canUploadPhotos === true) return true;
  if (resolveRole(userData, userData.uid || userData.phone || "") === "master") return true;
  if (resolveRole(userData, userData.uid || userData.phone || "") === "admin2") return true;
  return false;
}

function resolveEditMode(userData = {}) {
  return userData.editMode === true;
}

function resolveEditScope(userData = {}) {
  const scope = String(userData.editScope || "").trim().toLowerCase();
  if (scope === "tela4" || scope === "all") {
    return scope;
  }
  return resolveEditMode(userData) ? "all" : "none";
}

function resolveMustChangePassword(userData = {}) {
  return userData.mustChangePassword === true;
}

function normalizeLoginHistoryItems(rawHistory = []) {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") return item.trim();
      if (item instanceof Date) return item.toISOString();
      if (typeof item === "object") {
        if (typeof item.atIso === "string" && item.atIso.trim()) return item.atIso.trim();
        if (typeof item.iso === "string" && item.iso.trim()) return item.iso.trim();
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 10)
    .map((atIso) => ({ atIso }));
}

function getAdminConfigRef() {
  return db.collection(ADMIN_CONFIG_COLLECTION).doc(ADMIN_CONFIG_DOC);
}

function getSignupRequestRef(uid) {
  return db.collection(SIGNUP_REQUESTS_COLLECTION).doc(uid);
}

function resolveRegistrationEnabled(configData = {}) {
  return configData.registrationEnabled !== false;
}

async function readAdminConfig() {
  const snap = await getAdminConfigRef().get();
  return snap.exists ? snap.data() || {} : {};
}

async function applyUserClaims(uid, userData = {}) {
  const role = resolveRole(userData, uid);
  const canUploadPhotos = resolveCanUploadPhotos(userData);
  const claims =
    role === "master"
      ? { role, adminMaster: true, canUploadPhotos }
      : { role, canUploadPhotos };
  await admin.auth().setCustomUserClaims(uid, claims);
  return claims;
}

function generateTemporaryPassword(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

async function writeAdminAudit(actorUid, action, targetUid, details = {}) {
  try {
    await db.collection("adminAudit").add({
      actorUid: String(actorUid || "").trim() || "unknown",
      action,
      targetUid: String(targetUid || "").trim() || "unknown",
      details,
      createdAtIso: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.log("[ADMIN_AUDIT] write_failed", {
      actorUid,
      action,
      targetUid,
      error: String((error && error.message) || error),
    });
  }
}

const PHOTO_KEYS = ["placa", "placa2", "tela6", "tela11", "profileFace"];

function getStorageBucketCandidates() {
  return Array.from(
    new Set(
      [
        process.env.FIREBASE_STORAGE_BUCKET,
        `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
        `${FIREBASE_PROJECT_ID}.appspot.com`,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function isBucketMissingError(error) {
  const message = String((error && error.message) || error || "").toLowerCase();
  return message.includes("specified bucket does not exist");
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: "Sessao ausente." });
    }

    req.user = await admin.auth().verifyIdToken(match[1]);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Sessao invalida.", details: String(error.message || error) });
  }
}

async function requireAdmin(req, res, next) {
  try {
    await new Promise((resolve, reject) => {
      requireAuth(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const uid = req.user?.uid || "";
    const adminSnap = await db.collection("users").doc(uid).get();
    const adminData = adminSnap.exists ? adminSnap.data() || {} : {};
    const tokenRole = String(req.user?.role || "").trim();
    const resolvedRole = resolveRole(
      {
        ...adminData,
        role: adminData.role || tokenRole,
      },
      uid
    );
    if (resolvedRole === "master") {
      req.adminAccess = "master";
      return next();
    }

    if (resolvedRole === "admin2") {
      req.adminAccess = "admin2";
      return next();
    }

    return res.status(403).json({ error: "Acesso administrativo requerido." });
  } catch (error) {
    return res.status(401).json({ error: "Sessao invalida.", details: String(error.message || error) });
  }
}

async function requireMaster(req, res, next) {
  return requireAdmin(req, res, () => {
    if (req.adminAccess !== "master") {
      return res.status(403).json({ error: "Acesso indisponivel." });
    }
    return next();
  });
}

function ensureCanManageTarget(req, res, targetUid, targetData = {}) {
  const access = req.adminAccess || "admin2";
  const targetRole = resolveRole(targetData, targetUid);
  if (targetRole === "master" && access !== "master") {
    res.status(404).json({ error: "Usuario nao encontrado." });
    return false;
  }
  return true;
}

function parseDataUrl(dataUrl = "") {
  const raw = String(dataUrl || "").trim();
  const base64Match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const utf8SvgMatch = raw.match(/^data:(image\/svg\+xml);utf8,(.+)$/i);

  let mimeType = "";
  let buffer = null;

  if (base64Match) {
    mimeType = base64Match[1];
    buffer = Buffer.from(base64Match[2], "base64");
  } else if (utf8SvgMatch) {
    mimeType = utf8SvgMatch[1];
    buffer = Buffer.from(decodeURIComponent(utf8SvgMatch[2]), "utf8");
  } else {
    return null;
  }

  const extension = mimeType.includes("svg")
    ? "svg"
    : mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
        ? "webp"
        : "jpg";

  return {
    mimeType,
    extension,
    buffer,
  };
}

function photoPath(uid, key, extension) {
  return `userPhotos/${uid}/${key}.${extension}`;
}

async function uploadPhoto(uid, key, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const path = photoPath(uid, key, parsed.extension);
  let lastError = null;
  console.log("[PHOTOS] upload_start", { uid, key, path, bytes: parsed.buffer.length });

  for (const bucketName of getStorageBucketCandidates()) {
    try {
      const bucket = admin.storage().bucket(bucketName);
      await bucket.file(path).save(parsed.buffer, {
        resumable: false,
        contentType: parsed.mimeType,
        metadata: {
          cacheControl: "private, max-age=0, no-transform",
        },
      });

      return {
        path,
        mimeType: parsed.mimeType,
        bucket: bucketName,
      };
    } catch (error) {
      console.log("[PHOTOS] upload_bucket_error", {
        uid,
        key,
        bucketName,
        error: String((error && error.message) || error),
      });
      lastError = error;
      if (!isBucketMissingError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Nenhum bucket de storage disponivel.");
}

async function downloadPhotoDataUrl(path, mimeType, storedBucketName) {
  if (!path) return "";
  const bucketNames = Array.from(
    new Set([storedBucketName, ...getStorageBucketCandidates()].filter(Boolean))
  );
  let lastError = null;

  for (const bucketName of bucketNames) {
    try {
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (!exists) continue;
      const [buffer] = await file.download();
      return `data:${mimeType || "image/jpeg"};base64,${buffer.toString("base64")}`;
    } catch (error) {
      lastError = error;
      if (!isBucketMissingError(error)) {
        throw error;
      }
    }
  }

  if (lastError && !isBucketMissingError(lastError)) {
    throw lastError;
  }

  return "";
}

function decodeXmlEntities(value = "") {
  return String(value || "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function extractDriverDisplayNameFromPlateSvg(svg = "") {
  const match = String(svg || "").match(
    /<text\b(?=[^>]*font-size="22")(?=[^>]*font-weight="600")[^>]*>([\s\S]*?)<\/text>/i
  );
  return decodeXmlEntities(match?.[1] || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

async function readStoredSvgText(path, mimeType, storedBucketName) {
  if (!path) return "";
  const looksLikeSvg =
    String(mimeType || "").toLowerCase().includes("svg") ||
    String(path || "").toLowerCase().endsWith(".svg");
  if (!looksLikeSvg) return "";

  const bucketNames = Array.from(
    new Set([storedBucketName, ...getStorageBucketCandidates()].filter(Boolean))
  );

  for (const bucketName of bucketNames) {
    try {
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (!exists) continue;
      const [buffer] = await file.download();
      return buffer.toString("utf8");
    } catch (error) {
      if (!isBucketMissingError(error)) {
        throw error;
      }
    }
  }

  return "";
}

async function resolveDriverDisplayName(userData = {}, photoData = {}) {
  const storedName = String(photoData.driverDisplayName || userData.driverDisplayName || "")
    .trim()
    .toUpperCase();
  if (storedName) return storedName;

  for (const key of ["placa", "placa2"]) {
    const svg = await readStoredSvgText(
      photoData[`${key}Path`],
      photoData[`${key}MimeType`],
      photoData[`${key}Bucket`]
    );
    const extractedName = extractDriverDisplayNameFromPlateSvg(svg);
    if (extractedName) return extractedName;
  }

  return "";
}

async function deletePhotoFiles(fields = {}) {
  for (const key of PHOTO_KEYS) {
    const path = fields[`${key}Path`];
    if (!path) continue;

    const bucketNames = Array.from(
      new Set([fields[`${key}Bucket`], ...getStorageBucketCandidates()].filter(Boolean))
    );

    for (const bucketName of bucketNames) {
      try {
        const bucket = admin.storage().bucket(bucketName);
        const file = bucket.file(path);
        const [exists] = await file.exists();
        if (!exists) continue;
        await file.delete();
        break;
      } catch (error) {
        if (!isBucketMissingError(error)) {
          throw error;
        }
      }
    }
  }
}

async function deletePhotoFileByKey(fields = {}, key) {
  if (!PHOTO_KEYS.includes(key)) return false;
  const path = fields[`${key}Path`];
  if (!path) return false;

  const bucketNames = Array.from(
    new Set([fields[`${key}Bucket`], ...getStorageBucketCandidates()].filter(Boolean))
  );

  for (const bucketName of bucketNames) {
    try {
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (!exists) continue;
      await file.delete();
      return true;
    } catch (error) {
      if (!isBucketMissingError(error)) {
        throw error;
      }
    }
  }

  return false;
}

function buildPhotoStatus(fields = {}) {
  const hasPlaca = !!fields.placaPath;
  const hasTela6 = !!fields.tela6Path;
  const hasTela11 = !!fields.tela11Path;
  const hasProfileFace = !!fields.profileFacePath;
  const legacyScreensComplete = hasTela6 && hasTela11;
  const generatedScreensComplete = hasProfileFace;
  const generationMode = generatedScreensComplete
    ? "profileFace"
    : legacyScreensComplete
      ? "legacyUpload"
      : "incomplete";

  return {
    requiredComplete: hasPlaca && (legacyScreensComplete || generatedScreensComplete),
    hasPlaca,
    hasTela6,
    hasTela11,
    hasPlaca2: !!fields.placa2Path,
    hasProfileFace,
    generatedTela6: generatedScreensComplete,
    generatedTela11: generatedScreensComplete,
    generationMode,
  };
}

function cleanPhotoMetadataValue(value, maxLength = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizePhotoMetadata(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const metadata = {};
  const driverDisplayName = cleanPhotoMetadataValue(source.driverDisplayName, 120).toUpperCase();
  const driverVehicleType = cleanPhotoMetadataValue(source.driverVehicleType, 40).toUpperCase();
  const driverHubName = cleanPhotoMetadataValue(source.driverHubName, 160);
  const driverCnhNumber = String(source.driverCnhNumber || "").replace(/\D/g, "").slice(0, 11);
  const registrationMode = cleanPhotoMetadataValue(source.registrationMode, 40);

  if (driverDisplayName) metadata.driverDisplayName = driverDisplayName;
  if (driverVehicleType) metadata.driverVehicleType = driverVehicleType;
  if (driverHubName) metadata.driverHubName = driverHubName;
  if (/^\d{11}$/.test(driverCnhNumber)) metadata.driverCnhNumber = driverCnhNumber;
  if (registrationMode) metadata.registrationMode = registrationMode;

  return metadata;
}

function normalizeOccurrenceItem(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const codigo = cleanPhotoMetadataValue(source.codigo || source.code || "", 80).toUpperCase();
  if (!codigo) return null;

  return {
    codigo,
    endereco: cleanPhotoMetadataValue(source.endereco || source.address || "", 240) || null,
    pessoa: cleanPhotoMetadataValue(source.pessoa || source.recipient || "", 160) || null,
    hub: cleanPhotoMetadataValue(source.hub || "", 160) || null,
    status: cleanPhotoMetadataValue(source.status || "", 80) || null,
    statusDate: cleanPhotoMetadataValue(source.statusDate || source.data || "", 60) || null,
    raw: cleanPhotoMetadataValue(source.raw || "", 2000) || null,
    scanType: cleanPhotoMetadataValue(source.scanType || "", 40) || null,
  };
}

function normalizeOccurrencesList(raw = []) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : [])
    .map(normalizeOccurrenceItem)
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item.codigo)) return false;
      seen.add(item.codigo);
      return true;
    })
    .slice(0, 15);
}

function buildPhotoMetadata(fields = {}) {
  return {
    driverDisplayName: String(fields.driverDisplayName || ""),
    driverVehicleType: String(fields.driverVehicleType || ""),
    driverHubName: String(fields.driverHubName || ""),
    driverCnhNumber: String(fields.driverCnhNumber || ""),
    registrationMode: String(fields.registrationMode || ""),
  };
}

async function exchangeCustomTokenForIdToken(customToken) {
  if (!FIREBASE_WEB_API_KEY) {
    throw new Error("FIREBASE_WEB_API_KEY nao configurada no backend.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha no signInWithCustomToken: ${response.status} ${text}`);
  }

  return response.json();
}

app.get("/health", (_req, res) => {
  const credentialsPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  res.json({
    ok: true,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    hasFirebaseWebApiKey: !!FIREBASE_WEB_API_KEY,
    hasFirebaseStorageBucket: !!process.env.FIREBASE_STORAGE_BUCKET,
    hasGoogleCredentialsPath: !!credentialsPath,
    googleCredentialsReady: process.env.GOOGLE_CREDENTIALS_READY === "1",
    googleCredentialsProjectId: process.env.GOOGLE_CREDENTIALS_PROJECT_ID || "",
  });
});

app.post("/auth/register", async (req, res) => {
  try {
    const phone = normalizePhoneBR(req.body?.phone || "");
    const password = String(req.body?.password || "").trim();
    const adminConfig = await readAdminConfig();

    if (!resolveRegistrationEnabled(adminConfig)) {
      return res.status(403).json({ error: "Cadastro indisponivel no momento." });
    }

    if (!phone || phone.length < 12) {
      return res.status(400).json({ error: "Telefone invalido." });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Senha invalida." });
    }

    const uid = userDocId(phone);
    const userRef = db.collection("users").doc(uid);
    const existing = await userRef.get();
    if (existing.exists) {
      return res.status(409).json({ error: "Telefone ja cadastrado." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const requestRef = getSignupRequestRef(uid);
    const requestSnap = await requestRef.get();
    const currentStatus = requestSnap.exists ? String(requestSnap.data()?.status || "") : "";

    if (currentStatus === "pending") {
      return res.status(409).json({ error: "Ja existe uma solicitacao pendente para este telefone." });
    }

    await requestRef.set(
      {
        uid,
        phone,
        passwordHash,
        status: "pending",
        requestedAtIso: new Date().toISOString(),
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      pendingApproval: true,
      uid,
      phone,
      message: "Solicitacao enviada. Aguarde aprovacao do administrador.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha no cadastro", details: String(error.message || error) });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const phone = normalizePhoneBR(req.body?.phone || "");
    const password = String(req.body?.password || "").trim();

    if (!phone || phone.length < 12) {
      return res.status(400).json({ error: "Telefone invalido." });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Senha invalida." });
    }

    const uid = userDocId(phone);
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      const requestSnap = await getSignupRequestRef(uid).get();
      if (requestSnap.exists) {
        const requestData = requestSnap.data() || {};
        const requestStatus = String(requestData.status || "pending");
        if (requestStatus === "pending") {
          return res.status(403).json({ error: "Cadastro em analise pelo administrador." });
        }
        if (requestStatus === "blocked") {
          return res.status(403).json({ error: "Cadastro bloqueado pelo administrador." });
        }
        if (requestStatus === "deleted") {
          return res.status(403).json({ error: "Solicitacao removida pelo administrador." });
        }
      }
      return res.status(404).json({ error: "Telefone nao cadastrado." });
    }

    const data = snap.data() || {};
    if (data.active === false) {
      return res.status(403).json({ error: "Acesso ao aplicativo bloqueado pelo administrador." });
    }
    const ok = await bcrypt.compare(password, data.passwordHash || "");
    if (!ok) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    const role = resolveRole(data, uid);
    const canUploadPhotos = resolveCanUploadPhotos(data);
    const editScope = resolveEditScope(data);
    const editMode = editScope !== "none";
    let photoStatus = buildPhotoStatus({});
    try {
      const photoSnap = await db.collection("userPhotos").doc(uid).get();
      if (photoSnap.exists) {
        photoStatus = buildPhotoStatus(photoSnap.data() || {});
      }
    } catch (error) {
      console.log("[AUTH_LOGIN] photo_status_failed", {
        uid,
        error: String((error && error.message) || error),
      });
    }
    const claims = role === "master" ? { role, adminMaster: true, canUploadPhotos } : { role, canUploadPhotos };
    const customToken = await admin.auth().createCustomToken(uid, claims);
    const tokenPayload = await exchangeCustomTokenForIdToken(customToken);
    const loginIso = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(userRef);
      const freshData = freshSnap.exists ? freshSnap.data() || {} : {};
      const currentHistory = normalizeLoginHistoryItems(freshData.loginHistory);
      const nextHistory = [{ atIso: loginIso }, ...currentHistory].slice(0, 10);

      transaction.set(
        userRef,
        {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLoginAtIso: loginIso,
          loginHistory: nextHistory,
        },
        { merge: true }
      );
    });

    return res.json({
      ok: true,
      uid,
      phone,
      role,
      canUploadPhotos,
      editMode,
      editScope,
      mustChangePassword: resolveMustChangePassword(data),
      registrationComplete: photoStatus.requiredComplete,
      hasPlaca: photoStatus.hasPlaca,
      hasTela6: photoStatus.hasTela6,
      hasTela11: photoStatus.hasTela11,
      hasPlaca2: photoStatus.hasPlaca2,
      hasProfileFace: photoStatus.hasProfileFace,
      generationMode: photoStatus.generationMode,
      customToken,
      idToken: tokenPayload.idToken,
      refreshToken: tokenPayload.refreshToken,
      expiresIn: tokenPayload.expiresIn,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha no login", details: String(error.message || error) });
  }
});

app.get("/me/occurrence-count", requireAuth, async (req, res) => {
  try {
    const uid = String(req.user?.uid || "").trim();
    if (!uid) {
      return res.status(401).json({ error: "Sessao invalida." });
    }

    const userSnap = await db.collection("users").doc(uid).get();
    const data = userSnap.exists ? userSnap.data() || {} : {};
    const storedRaw = Number.parseInt(String(data.occurrenceCount ?? 5), 10);
    const occurrenceCount = Math.max(0, Math.min(15, Number.isFinite(storedRaw) ? storedRaw : 5));

    return res.json({
      ok: true,
      occurrenceCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao carregar quantidade de ocorrencias." });
  }
});

app.patch("/me/occurrence-count", requireAuth, async (req, res) => {
  try {
    const uid = String(req.user?.uid || "").trim();
    if (!uid) {
      return res.status(401).json({ error: "Sessao invalida." });
    }

    const parsed = Number.parseInt(String(req.body?.occurrenceCount || ""), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return res.status(400).json({ error: "Quantidade invalida." });
    }
    const occurrenceCount = Math.max(0, Math.min(15, parsed));

    await db.collection("users").doc(uid).set(
      {
        occurrenceCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      occurrenceCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao salvar quantidade de ocorrencias." });
  }
});

app.get("/me/driver-hub", requireAuth, async (req, res) => {
  try {
    const uid = String(req.user?.uid || "").trim();
    if (!uid) {
      return res.status(401).json({ error: "Sessao invalida." });
    }

    const [photoSnap, userSnap] = await Promise.all([
      db.collection("userPhotos").doc(uid).get(),
      db.collection("users").doc(uid).get(),
    ]);
    const photoData = photoSnap.exists ? photoSnap.data() || {} : {};
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const driverHubName = cleanPhotoMetadataValue(
      photoData.driverHubName || userData.driverHubName || "",
      160
    );

    return res.json({
      ok: true,
      driverHubName,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao carregar Hub." });
  }
});

app.put("/me/driver-hub", requireAuth, async (req, res) => {
  try {
    const uid = String(req.user?.uid || "").trim();
    if (!uid) {
      return res.status(401).json({ error: "Sessao invalida." });
    }

    const driverHubName = cleanPhotoMetadataValue(
      req.body?.driverHubName || req.body?.hubName || "",
      160
    );
    const nowIso = new Date().toISOString();
    const firestoreHubValue =
      driverHubName || admin.firestore.FieldValue.delete();

    await Promise.all([
      db.collection("userPhotos").doc(uid).set(
        {
          uid,
          phone: uid,
          driverHubName: firestoreHubValue,
          metadataUpdatedAtIso: nowIso,
          updatedAtIso: nowIso,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
      db.collection("users").doc(uid).set(
        {
          driverHubName: firestoreHubValue,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
    ]);

    return res.json({
      ok: true,
      driverHubName,
      updatedAtIso: nowIso,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao salvar Hub.",
      details: String(error.message || error),
    });
  }
});

app.get("/me/occurrences", requireAuth, async (req, res) => {
  try {
    const uid = String(req.user?.uid || "").trim();
    if (!uid) {
      return res.status(401).json({ error: "Sessao invalida." });
    }

    const userSnap = await db.collection("users").doc(uid).get();
    const data = userSnap.exists ? userSnap.data() || {} : {};
    return res.json({
      ok: true,
      occurrences: normalizeOccurrencesList(data.occurrences || []),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao carregar ocorrencias." });
  }
});

app.put("/me/occurrences", requireAuth, async (req, res) => {
  try {
    const uid = String(req.user?.uid || "").trim();
    if (!uid) {
      return res.status(401).json({ error: "Sessao invalida." });
    }

    const occurrences = normalizeOccurrencesList(req.body?.occurrences || []);
    await db.collection("users").doc(uid).set(
      {
        occurrences,
        occurrencesUpdatedAtIso: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      occurrences,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao salvar ocorrencias." });
  }
});

async function loadAdminUsersForRequest(req) {
    const [snap, photoSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("userPhotos").get(),
    ]);
    const photoMetadataByUid = new Map(
      photoSnap.docs.map((doc) => [doc.id, doc.data() || {}])
    );
    const users = (await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data() || {};
        const photoData = photoMetadataByUid.get(doc.id) || {};
        const editScope = resolveEditScope(data);
        const loginHistory = normalizeLoginHistoryItems(data.loginHistory);
        return {
          uid: doc.id,
          phone: data.phone || doc.id,
          driverDisplayName: await resolveDriverDisplayName(data, photoData),
          role: resolveRole(data, doc.id),
          active: data.active !== false,
          editMode: editScope !== "none",
          editScope,
          mustChangePassword: resolveMustChangePassword(data),
          canUploadPhotos: resolveCanUploadPhotos(data),
          lastLoginAtIso: data.lastLoginAtIso || "",
          loginHistory,
        };
      })
    ))
      .filter((user) => (req.adminAccess === "master" ? true : user.role !== "master"))
      .sort((left, right) => String(left.phone || left.uid).localeCompare(String(right.phone || right.uid)));

    return users;
}

app.get("/admin/users", requireAdmin, async (_req, res) => {
  try {
    const users = await loadAdminUsersForRequest(_req);
    return res.json({ ok: true, users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao listar usuarios", details: String(error.message || error) });
  }
});

app.get("/admin/user-display-names", requireAdmin, async (req, res) => {
  try {
    const users = await loadAdminUsersForRequest(req);
    return res.json({
      ok: true,
      users: users.map((user) => ({
        uid: user.uid,
        phone: user.phone,
        driverDisplayName: user.driverDisplayName || "",
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao listar nomes dos usuarios",
      details: String(error.message || error),
    });
  }
});

app.get("/admin/signup-requests", requireAdmin, async (req, res) => {
  try {
    const snap = await db
      .collection(SIGNUP_REQUESTS_COLLECTION)
      .orderBy("requestedAt", "desc")
      .limit(200)
      .get();

    const requests = snap.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          uid: doc.id,
          phone: data.phone || doc.id,
          status: String(data.status || "pending"),
          requestedAtIso: data.requestedAtIso || "",
          updatedAtIso: data.updatedAtIso || "",
        };
      })
      .filter((item) => (req.adminAccess === "master" ? true : String(item.role || "").trim().toLowerCase() !== "master"));

    return res.json({ ok: true, requests });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao listar solicitacoes de cadastro",
      details: String(error.message || error),
    });
  }
});

app.patch("/admin/signup-requests/:uid", requireAdmin, async (req, res) => {
  try {
    const uid = String(req.params.uid || "").trim();
    const action = String(req.body?.action || "").trim().toLowerCase();
    if (!uid) return res.status(400).json({ error: "Solicitacao invalida." });
    if (!["approve", "block", "delete"].includes(action)) {
      return res.status(400).json({ error: "Acao invalida." });
    }

    const requestRef = getSignupRequestRef(uid);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return res.status(404).json({ error: "Solicitacao nao encontrada." });
    }

    const requestData = requestSnap.data() || {};
    if (!ensureCanManageTarget(req, res, uid, { phone: requestData.phone })) {
      return;
    }

    if (action === "approve") {
      const userRef = db.collection("users").doc(uid);
      const existingUserSnap = await userRef.get();
      if (!existingUserSnap.exists) {
        const role = "user";
        const canUploadPhotos = resolveCanUploadPhotos({ role });
        await userRef.set({
          phone: requestData.phone || uid,
          passwordHash: requestData.passwordHash || "",
          role,
          canUploadPhotos,
          editMode: false,
          editScope: "none",
          mustChangePassword: false,
          active: true,
          lastLoginAtIso: "",
          loginHistory: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await applyUserClaims(uid, { role, canUploadPhotos, phone: requestData.phone || uid, uid });
      } else {
        await userRef.set(
          {
            active: true,
            editMode: false,
            editScope: "none",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    const nextStatus = action === "approve" ? "approved" : action === "block" ? "blocked" : "deleted";
    await requestRef.set(
      {
        status: nextStatus,
        reviewedByUid: req.user?.uid || "",
        updatedAtIso: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await writeAdminAudit(req.user?.uid, "update_signup_request", uid, {
      action: nextStatus,
      phone: requestData.phone || uid,
    });

    return res.json({
      ok: true,
      request: {
        uid,
        phone: requestData.phone || uid,
        status: nextStatus,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao atualizar solicitacao de cadastro",
      details: String(error.message || error),
    });
  }
});

app.get("/admin/access", requireAdmin, async (req, res) => {
  try {
    const adminConfig = await readAdminConfig();
    return res.json({
      ok: true,
      access: req.adminAccess === "master" ? "master" : "admin2",
      registrationEnabled: resolveRegistrationEnabled(adminConfig),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao carregar acesso administrativo." });
  }
});

app.get("/admin/config", requireAdmin, async (_req, res) => {
  try {
    const adminConfig = await readAdminConfig();
    return res.json({
      ok: true,
      registrationEnabled: resolveRegistrationEnabled(adminConfig),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao carregar configuracoes administrativas." });
  }
});

app.patch("/admin/config", requireAdmin, async (req, res) => {
  try {
    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (typeof req.body?.registrationEnabled === "boolean") {
      updates.registrationEnabled = req.body.registrationEnabled;
    }

    await getAdminConfigRef().set(updates, { merge: true });
    await writeAdminAudit(req.user?.uid, "update_admin_config", "admin-control", {
      registrationEnabled:
        typeof req.body?.registrationEnabled === "boolean" ? req.body.registrationEnabled : undefined,
    });

    const merged = await readAdminConfig();
    return res.json({
      ok: true,
      registrationEnabled: resolveRegistrationEnabled(merged),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao atualizar configuracoes administrativas." });
  }
});

app.patch("/admin/users/:uid", requireAdmin, async (req, res) => {
  try {
    const uid = String(req.params.uid || "").trim();
    if (!uid) {
      return res.status(400).json({ error: "Usuario invalido." });
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }
    if (!ensureCanManageTarget(req, res, uid, snap.data() || {})) {
      return;
    }
    const currentData = snap.data() || {};
    if (!ensureCanManageTarget(req, res, uid, currentData)) {
      return;
    }

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (typeof req.body?.active === "boolean") {
      if (resolveRole(currentData, uid) === "master") {
        updates.active = true;
      } else {
        updates.active = req.body.active;
      }
    }

    if (typeof req.body?.editMode === "boolean") {
      updates.editMode = req.body.editMode;
      updates.editScope = req.body.editMode ? "all" : "none";
    }

    if (typeof req.body?.editScope === "string") {
      if (req.adminAccess !== "master" && String(req.body.editScope).trim().toLowerCase() === "all") {
        return res.status(403).json({ error: "Acesso indisponivel." });
      }
      const editScope = resolveEditScope({ editScope: req.body.editScope });
      updates.editScope = editScope;
      updates.editMode = editScope !== "none";
    }

    if (req.adminAccess === "master" && typeof req.body?.role === "string") {
      const nextRole = String(req.body.role).trim().toLowerCase() === "admin2" ? "admin2" : "user";
      if (resolveRole(currentData, uid) !== "master") {
        updates.role = nextRole;
        updates.canUploadPhotos = resolveCanUploadPhotos({ ...currentData, ...updates, role: nextRole, uid });
      }
    }

    await userRef.set(updates, { merge: true });
    const merged = { ...currentData, ...req.body, ...updates };
    if (typeof updates.role === "string") {
      await applyUserClaims(uid, merged);
    }
    await writeAdminAudit(req.user?.uid, "update_user", uid, {
      active: typeof req.body?.active === "boolean" ? req.body.active : undefined,
      editScope: typeof req.body?.editScope === "string" ? resolveEditScope({ editScope: req.body.editScope }) : undefined,
      editMode: typeof req.body?.editMode === "boolean" ? req.body.editMode : undefined,
      role: typeof updates.role === "string" ? updates.role : undefined,
    });

    return res.json({
      ok: true,
      user: {
        uid,
        phone: merged.phone || uid,
        role: resolveRole(merged, uid),
        active: merged.active !== false,
        editMode: resolveEditScope(merged) !== "none",
        editScope: resolveEditScope(merged),
        mustChangePassword: resolveMustChangePassword(merged),
        canUploadPhotos: resolveCanUploadPhotos(merged),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao atualizar usuario", details: String(error.message || error) });
  }
});

app.post("/admin/users/:uid/clear-screens", requireAdmin, async (req, res) => {
  try {
    const uid = String(req.params.uid || "").trim();
    if (!uid) {
      return res.status(400).json({ error: "Usuario invalido." });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }
    const currentData = userSnap.data() || {};
    if (!ensureCanManageTarget(req, res, uid, currentData)) {
      return;
    }

    const photoRef = db.collection("photos").doc(uid);
    const photoSnap = await photoRef.get();
    const photoData = photoSnap.exists ? photoSnap.data() || {} : {};

    if (photoSnap.exists) {
      await deletePhotoFiles(photoData);
      await photoRef.delete();
    }

    await userRef.set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await writeAdminAudit(req.user?.uid, "clear_screens", uid, {
      phone: currentData.phone || uid,
      hadPhotos: photoSnap.exists,
    });

    return res.json({
      ok: true,
      uid,
      cleared: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao excluir telas", details: String(error.message || error) });
  }
});

app.post("/admin/users/:uid/password", requireMaster, async (req, res) => {
  try {
    const uid = String(req.params.uid || "").trim();
    if (!uid) {
      return res.status(400).json({ error: "Usuario invalido." });
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }

    const providedPassword = String(req.body?.newPassword || "").trim();
    const generateTemporary = req.body?.generateTemporary === true;
    const requestedForceChange = req.body?.forceChangeOnNextLogin === true;
    const forceWithoutReset = req.body?.forceChangeOnly === true;

    if (!generateTemporary && !forceWithoutReset && providedPassword.length < 4) {
      return res.status(400).json({ error: "A nova senha deve ter pelo menos 4 caracteres." });
    }

    const nextPassword = generateTemporary ? generateTemporaryPassword(8) : providedPassword;
    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (generateTemporary || providedPassword) {
      updates.passwordHash = await bcrypt.hash(nextPassword, 10);
    }

    updates.mustChangePassword = forceWithoutReset ? true : requestedForceChange || generateTemporary;

    await userRef.set(updates, { merge: true });
    await writeAdminAudit(req.user?.uid, "update_password", uid, {
      generatedTemporary: generateTemporary,
      forcedChangeOnly: forceWithoutReset,
      forceChangeOnNextLogin: updates.mustChangePassword === true,
    });

    return res.json({
      ok: true,
      uid,
      temporaryPassword: generateTemporary ? nextPassword : "",
      mustChangePassword: updates.mustChangePassword === true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao atualizar senha do usuario",
      details: String(error.message || error),
    });
  }
});

app.get("/admin/users/:uid/photos", requireMaster, async (req, res) => {
  try {
    const uid = String(req.params.uid || "").trim();
    if (!uid) {
      return res.status(400).json({ error: "Usuario invalido." });
    }

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }
    if (!ensureCanManageTarget(req, res, uid, userSnap.data() || {})) {
      return;
    }

    const snap = await db.collection("userPhotos").doc(uid).get();
    if (!snap.exists) {
      return res.json({
        ok: true,
        exists: false,
        requiredComplete: false,
        hasPlaca: false,
        hasTela6: false,
        hasTela11: false,
        hasPlaca2: false,
        hasProfileFace: false,
        generatedTela6: false,
        generatedTela11: false,
        generationMode: "incomplete",
        updatedAtIso: "",
        metadata: buildPhotoMetadata(),
        photos: {},
      });
    }

    const data = snap.data() || {};
    const photos = {};
    for (const key of PHOTO_KEYS) {
      photos[key] = await downloadPhotoDataUrl(
        data[`${key}Path`],
        data[`${key}MimeType`],
        data[`${key}Bucket`]
      );
    }

    return res.json({
      ok: true,
      exists: true,
      ...buildPhotoStatus(data),
      updatedAtIso: data.updatedAtIso || "",
      metadata: buildPhotoMetadata(data),
      photos,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao carregar fotos do usuario",
      details: String(error.message || error),
    });
  }
});

app.post("/admin/generated-plate", requireAdmin, async (req, res) => {
  try {
    const login = normalizePhoneBR(req.body?.login || "");
    const slot = String(req.body?.slot || "").trim().toLowerCase();
    const imageDataUrl = String(req.body?.imageDataUrl || "").trim();

    if (!login || login.length < 12) {
      return res.status(400).json({ error: "Login invalido." });
    }

    if (slot !== "placa" && slot !== "placa2") {
      return res.status(400).json({ error: "Destino invalido." });
    }

    if (!imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Imagem invalida." });
    }

    const uid = userDocId(login);
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }

    const userData = userSnap.data() || {};
    if (!ensureCanManageTarget(req, res, uid, userData)) {
      return;
    }

    const photoRef = db.collection("userPhotos").doc(uid);
    const currentSnap = await photoRef.get();
    const current = currentSnap.exists ? currentSnap.data() || {} : {};
    const uploaded = await uploadPhoto(uid, slot, imageDataUrl);
    if (!uploaded) {
      return res.status(400).json({ error: "Falha ao gerar imagem." });
    }

    await photoRef.set(
      {
        uid,
        phone: userData.phone || uid,
        [`${slot}Path`]: uploaded.path,
        [`${slot}MimeType`]: uploaded.mimeType,
        [`${slot}Bucket`]: uploaded.bucket,
        updatedAtIso: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await writeAdminAudit(req.user?.uid, "apply_generated_plate", uid, {
      phone: userData.phone || uid,
      slot,
    });

    return res.json({
      ok: true,
      uid,
      phone: userData.phone || uid,
      slot,
      updatedAtIso: current.updatedAtIso || new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao aplicar placa gerada",
      details: String(error.message || error),
    });
  }
});

app.get("/admin/audit", requireMaster, async (_req, res) => {
  try {
    const snap = await db.collection("adminAudit").orderBy("createdAt", "desc").limit(50).get();
    const items = snap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        actorUid: data.actorUid || "",
        action: data.action || "",
        targetUid: data.targetUid || "",
        details: data.details || {},
        createdAtIso: data.createdAtIso || "",
      };
    }).filter((item) => {
      if (_req.adminAccess === "master") return true;
      const details = item.details || {};
      const targetRole = String(details.targetRole || "").trim().toLowerCase();
      const actorRole = String(details.actorRole || "").trim().toLowerCase();
      return targetRole !== "master" && actorRole !== "master";
    });

    return res.json({ ok: true, items });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao carregar historico administrativo",
      details: String(error.message || error),
    });
  }
});

app.post("/admin/users/:uid/reset-face", requireAdmin, async (req, res) => {
  try {
    const uid = String(req.params.uid || "").trim();
    if (!uid) {
      return res.status(400).json({ error: "Usuario invalido." });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }

    const currentData = userSnap.data() || {};
    if (!ensureCanManageTarget(req, res, uid, currentData)) {
      return;
    }

    const photoRef = db.collection("userPhotos").doc(uid);
    const photoSnap = await photoRef.get();
    const photoData = photoSnap.exists ? photoSnap.data() || {} : {};
    const hadProfileFace = !!photoData.profileFacePath;
    const deletedFile = await deletePhotoFileByKey(photoData, "profileFace");
    const nowIso = new Date().toISOString();

    if (photoSnap.exists) {
      await photoRef.set(
        {
          profileFacePath: admin.firestore.FieldValue.delete(),
          profileFaceMimeType: admin.firestore.FieldValue.delete(),
          profileFaceBucket: admin.firestore.FieldValue.delete(),
          faceResetAtIso: nowIso,
          updatedAtIso: nowIso,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await photoRef.set(
        {
          uid,
          phone: uid,
          faceResetAtIso: nowIso,
          updatedAtIso: nowIso,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const nextPhotoData = { ...photoData };
    delete nextPhotoData.profileFacePath;
    delete nextPhotoData.profileFaceMimeType;
    delete nextPhotoData.profileFaceBucket;
    nextPhotoData.updatedAtIso = nowIso;

    await writeAdminAudit(req.user?.uid, "reset_profile_face", uid, {
      phone: currentData.phone || uid,
      hadProfileFace,
      deletedFile,
    });

    return res.json({
      ok: true,
      uid,
      cleared: true,
      hadProfileFace,
      deletedFile,
      ...buildPhotoStatus(nextPhotoData),
      updatedAtIso: nowIso,
    });
  } catch (error) {
    console.error("[ADMIN] reset_face_error", error);
    return res.status(500).json({
      error: "Falha ao apagar rosto",
      details: String(error.message || error),
    });
  }
});

app.delete("/admin/users/:uid", requireMaster, async (req, res) => {
  try {
    const uid = String(req.params.uid || "").trim();
    if (!uid) {
      return res.status(400).json({ error: "Usuario invalido." });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }
    const currentData = userSnap.data() || {};
    if (!ensureCanManageTarget(req, res, uid, currentData)) {
      return;
    }

    const photoRef = db.collection("userPhotos").doc(uid);
    const photoSnap = await photoRef.get();
    const photoData = photoSnap.exists ? photoSnap.data() || {} : {};

    if (photoSnap.exists) {
      await deletePhotoFiles(photoData);
      await photoRef.delete();
    }

    await userRef.delete();
    await writeAdminAudit(req.user?.uid, "delete_user", uid, {
      phone: currentData.phone || uid,
      hadPhotos: photoSnap.exists,
    });

    try {
      await admin.auth().deleteUser(uid);
    } catch (error) {
      console.log("[ADMIN] delete_auth_user_warning", {
        uid,
        error: String((error && error.message) || error),
      });
    }

    return res.json({ ok: true, uid });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao excluir usuario",
      details: String(error.message || error),
    });
  }
});

app.post("/photos/sync", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const photos = req.body?.photos || {};
    const metadata = normalizePhotoMetadata(req.body?.metadata || {});
    console.log("[PHOTOS] sync_request", {
      uid,
      keys: Object.keys(photos || {}),
      metadataKeys: Object.keys(metadata),
      hasPlaca: !!photos.placa,
      hasPlaca2: !!photos.placa2,
      hasTela6: !!photos.tela6,
      hasTela11: !!photos.tela11,
      hasProfileFace: !!photos.profileFace,
    });
    const photoRef = db.collection("userPhotos").doc(uid);
    const currentSnap = await photoRef.get();
    const current = currentSnap.exists ? currentSnap.data() || {} : {};
    const nowIso = new Date().toISOString();
    const updates = {
      uid,
      phone: uid,
      updatedAtIso: nowIso,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    for (const key of PHOTO_KEYS) {
      if (!photos[key]) continue;
      const uploaded = await uploadPhoto(uid, key, photos[key]);
      if (!uploaded) continue;
      updates[`${key}Path`] = uploaded.path;
      updates[`${key}MimeType`] = uploaded.mimeType;
      updates[`${key}Bucket`] = uploaded.bucket;
    }

    if (Object.keys(metadata).length > 0) {
      Object.assign(updates, metadata, {
        metadataUpdatedAtIso: nowIso,
      });
    }

    await photoRef.set(updates, { merge: true });
    const saved = { ...current, ...updates };
    console.log("[PHOTOS] sync_success", {
      uid,
      requiredComplete: buildPhotoStatus(saved).requiredComplete,
    });

    return res.json({
      ok: true,
      ...buildPhotoStatus(saved),
      metadata: buildPhotoMetadata(saved),
      updatedAtIso: saved.updatedAtIso || "",
    });
  } catch (error) {
    console.error("[PHOTOS] sync_error", error);
    return res.status(500).json({ error: "Falha ao sincronizar fotos", details: String(error.message || error) });
  }
});

app.post("/auth/change-password", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const newPassword = String(req.body?.newPassword || "").trim();
    const currentPassword = String(req.body?.currentPassword || "").trim();

    if (newPassword.length < 4) {
      return res.status(400).json({ error: "A nova senha deve ter pelo menos 4 caracteres." });
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }

    const data = snap.data() || {};
    const mustChangePassword = resolveMustChangePassword(data);

    if (!mustChangePassword) {
      const passwordOk = await bcrypt.compare(currentPassword, data.passwordHash || "");
      if (!passwordOk) {
        return res.status(403).json({ error: "Senha atual incorreta." });
      }
    }

    await userRef.set(
      {
        passwordHash: await bcrypt.hash(newPassword, 10),
        mustChangePassword: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({ ok: true, uid, mustChangePassword: false });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao trocar senha",
      details: String(error.message || error),
    });
  }
});

app.post("/auth/complete-edit-mode", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Usuario nao encontrado." });
    }

    await userRef.set(
      {
        editMode: false,
        editScope: "none",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({ ok: true, uid, editMode: false, editScope: "none" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha ao concluir modo de edicao",
      details: String(error.message || error),
    });
  }
});

app.get("/photos/me", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    console.log("[PHOTOS] me_request", { uid });
    const snap = await db.collection("userPhotos").doc(uid).get();
    if (!snap.exists) {
      console.log("[PHOTOS] me_not_found", { uid });
      return res.json({
        ok: true,
        exists: false,
        requiredComplete: false,
        hasPlaca: false,
        hasTela6: false,
        hasTela11: false,
        hasPlaca2: false,
        hasProfileFace: false,
        generatedTela6: false,
        generatedTela11: false,
        generationMode: "incomplete",
        updatedAtIso: "",
        metadata: buildPhotoMetadata(),
        photos: {},
      });
    }

    const data = snap.data() || {};
    console.log("[PHOTOS] me_found", {
      uid,
      hasPlaca: !!data.placaPath,
      hasTela6: !!data.tela6Path,
      hasTela11: !!data.tela11Path,
      hasPlaca2: !!data.placa2Path,
      hasProfileFace: !!data.profileFacePath,
    });
    const photos = {};
    for (const key of PHOTO_KEYS) {
      photos[key] = await downloadPhotoDataUrl(
        data[`${key}Path`],
        data[`${key}MimeType`],
        data[`${key}Bucket`]
      );
    }

    return res.json({
      ok: true,
      exists: true,
      ...buildPhotoStatus(data),
      updatedAtIso: data.updatedAtIso || "",
      metadata: buildPhotoMetadata(data),
      photos,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao baixar fotos", details: String(error.message || error) });
  }
});

function normalizeSpaces(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

function extractTrackingCode(text) {
  const candidates = [
    /\b(BR\d{6,}\s*[A-Z0-9]{0,6})\b/i,
    /\b(BR\d{6,}[A-Z]?)\b/i,
  ];

  for (const pattern of candidates) {
    const match = String(text || "").match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim().toUpperCase();
    }
    if (match?.[0]) {
      return match[0].replace(/\s+/g, " ").trim().toUpperCase();
    }
  }

  return "";
}

function extractAddress(lines) {
  const joined = lines.join("\n");
  const patterns = [
    /((?:Rua|R\.|Avenida|Av\.|Travessa|Tv\.|Alameda|Praça|Praca|Rodovia)\s+.+)/i,
  ];

  for (const pattern of patterns) {
    const match = joined.match(pattern);
    if (match) {
      return normalizeSpaces(match[1]);
    }
  }

  return "";
}

function extractRecipientName(lines, trackingCode, address) {
  const filtered = lines
    .map((line) => normalizeSpaces(line))
    .filter(Boolean)
    .filter((line) => line !== trackingCode)
    .filter((line) => line !== address)
    .filter(
      (line) =>
        !/\b(?:Rua|R\.|Avenida|Av\.|Travessa|Tv\.|Alameda|Praça|Praca|Rodovia)\b/i.test(
          line
        )
    )
    .filter((line) => !/\bBR\d{6,}[A-Z]?\b/i.test(line))
    .filter((line) => !/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line))
    .filter((line) => line.length >= 4);

  return filtered[0] || "";
}

function extractStatusDate(text) {
  const match = text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
  return match ? match[0] : "";
}

function parseFields(rawText) {
  const text = String(rawText || "").replace(/\r/g, "");
  const lines = text.split("\n").map((line) => normalizeSpaces(line)).filter(Boolean);

  const trackingCode = extractTrackingCode(text);
  const address = extractAddress(lines);
  const recipientName = extractRecipientName(lines, trackingCode, address);
  const statusDate = extractStatusDate(text);

  return {
    trackingCode,
    address,
    recipientName,
    statusDate,
    rawText: text,
  };
}

function splitCardsFromText(rawText, maxCards = 15) {
  const text = String(rawText || "").replace(/\r/g, "");
  const lines = text.split("\n").map((line) => normalizeSpaces(line)).filter(Boolean);
  if (!lines.length) return [];

  const groups = [];
  let current = [];

  for (const line of lines) {
    if (/\bBR\d{6,}\s*[A-Z0-9]{0,6}\b/i.test(line) && current.length) {
      groups.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length) groups.push(current.join("\n"));
  return groups.slice(0, Math.max(1, Number(maxCards) || 15));
}

app.post("/ocr", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 nao enviado." });
    }

    const cleanBase64 = String(imageBase64).replace(/^data:.*;base64,/, "");
    const imageBuffer = Buffer.from(cleanBase64, "base64");

    const [result] = await client.textDetection({
      image: { content: imageBuffer },
      imageContext: { languageHints: ["pt", "pt-BR"] },
    });

    const text =
      result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "";

    const fields = parseFields(text);

    return res.json({
      text,
      fields,
      mimeType: mimeType || "image/jpeg",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha no OCR",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/ocr/cards", async (req, res) => {
  try {
    const { imageBase64, mimeType, maxCards } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 nao enviado." });
    }

    const cleanBase64 = String(imageBase64).replace(/^data:.*;base64,/, "");
    const imageBuffer = Buffer.from(cleanBase64, "base64");

    const [result] = await client.textDetection({
      image: { content: imageBuffer },
      imageContext: { languageHints: ["pt", "pt-BR"] },
    });

    const text =
      result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "";

    const limit = Math.max(1, Number(maxCards) || 15);
    const parsedOccurrences = extractOccurrencesFromText(text).slice(0, limit);

    const cardsFromParsed = parsedOccurrences.map((item) => {
      const chunkText = String(item.rawText || "").trim();
      const fallbackFields = parseFields(chunkText);
      return {
        text: chunkText,
        fields: {
          ...fallbackFields,
          trackingCode: item.codigo || fallbackFields.trackingCode || "",
          address: item.endereco || fallbackFields.address || "",
          recipientName: item.pessoa || fallbackFields.recipientName || "",
          rawText: chunkText || fallbackFields.rawText || "",
        },
      };
    });

    const cardsFromSplit = splitCardsFromText(text, limit)
      .filter((chunk) => String(chunk || "").trim().length > 0)
      .map((chunk) => ({
        text: chunk,
        fields: parseFields(chunk),
      }));

    const cards =
      cardsFromParsed.length > 0
        ? cardsFromParsed
        : cardsFromSplit.length > 0
          ? cardsFromSplit
          : [{ text, fields: parseFields(text) }];

    return res.json({
      text,
      mimeType: mimeType || "image/jpeg",
      totalFound: cards.length,
      cards,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Falha no OCR em lote",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("API server running on port " + port);
});
