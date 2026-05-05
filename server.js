require("dotenv").config();

const express = require("express");
const cors = require("cors");
const vision = require("@google-cloud/vision");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || "spx-motorista-parceiro",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "spx-motorista-parceiro.firebasestorage.app",
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
const app = express();
app.use(cors());
app.use(express.json({ limit: "80mb" }));

const client = new vision.ImageAnnotatorClient();
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

function normalizePhoneBR(raw = "") {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

function userDocId(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function resolveCanUploadPhotos(userData = {}) {
  if (userData.canUploadPhotos === true) return true;
  if (userData.role === "master" || userData.role === "admin2") return true;
  return false;
}

const PHOTO_KEYS = ["placa", "placa2", "tela6", "tela11"];

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

function parseDataUrl(dataUrl = "") {
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const base64 = match[2];
  const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";

  return {
    mimeType,
    extension,
    buffer: Buffer.from(base64, "base64"),
  };
}

function photoPath(uid, key, extension) {
  return `userPhotos/${uid}/${key}.${extension}`;
}

async function uploadPhoto(uid, key, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const path = photoPath(uid, key, parsed.extension);
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
  };
}

async function downloadPhotoDataUrl(path, mimeType) {
  if (!path) return "";
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) return "";
  const [buffer] = await file.download();
  return `data:${mimeType || "image/jpeg"};base64,${buffer.toString("base64")}`;
}

function buildPhotoStatus(fields = {}) {
  const hasPlaca = !!fields.placaPath;
  const hasTela6 = !!fields.tela6Path;
  const hasTela11 = !!fields.tela11Path;

  return {
    requiredComplete: hasPlaca && hasTela6 && hasTela11,
    hasPlaca,
    hasTela6,
    hasTela11,
    hasPlaca2: !!fields.placa2Path,
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
  res.json({ ok: true });
});

app.post("/auth/register", async (req, res) => {
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
    const existing = await userRef.get();
    if (existing.exists) {
      return res.status(409).json({ error: "Telefone ja cadastrado." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const role = "user";
    const canUploadPhotos = resolveCanUploadPhotos({ role });

    await userRef.set({
      phone,
      passwordHash,
      role,
      canUploadPhotos,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const customToken = await admin.auth().createCustomToken(uid, { role, canUploadPhotos });
    const tokenPayload = await exchangeCustomTokenForIdToken(customToken);

    return res.json({
      ok: true,
      uid,
      phone,
      role,
      canUploadPhotos,
      customToken,
      idToken: tokenPayload.idToken,
      refreshToken: tokenPayload.refreshToken,
      expiresIn: tokenPayload.expiresIn,
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
      return res.status(404).json({ error: "Telefone nao cadastrado." });
    }

    const data = snap.data() || {};
    const ok = await bcrypt.compare(password, data.passwordHash || "");
    if (!ok) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    const role = data.role === "admin2" ? "admin2" : data.role === "master" ? "master" : "user";
    const canUploadPhotos = resolveCanUploadPhotos(data);
    const claims = role === "master" ? { role, adminMaster: true, canUploadPhotos } : { role, canUploadPhotos };
    const customToken = await admin.auth().createCustomToken(uid, claims);
    const tokenPayload = await exchangeCustomTokenForIdToken(customToken);

    await userRef.set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      uid,
      phone,
      role,
      canUploadPhotos,
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

app.post("/photos/sync", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const photos = req.body?.photos || {};
    const photoRef = db.collection("userPhotos").doc(uid);
    const currentSnap = await photoRef.get();
    const current = currentSnap.exists ? currentSnap.data() || {} : {};
    const updates = {
      uid,
      phone: uid,
      updatedAtIso: new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    for (const key of PHOTO_KEYS) {
      if (!photos[key]) continue;
      const uploaded = await uploadPhoto(uid, key, photos[key]);
      if (!uploaded) continue;
      updates[`${key}Path`] = uploaded.path;
      updates[`${key}MimeType`] = uploaded.mimeType;
    }

    await photoRef.set(updates, { merge: true });
    const saved = { ...current, ...updates };

    return res.json({
      ok: true,
      ...buildPhotoStatus(saved),
      updatedAtIso: saved.updatedAtIso || "",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Falha ao sincronizar fotos", details: String(error.message || error) });
  }
});

app.get("/photos/me", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
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
        updatedAtIso: "",
        photos: {},
      });
    }

    const data = snap.data() || {};
    const photos = {};
    for (const key of PHOTO_KEYS) {
      photos[key] = await downloadPhotoDataUrl(data[`${key}Path`], data[`${key}MimeType`]);
    }

    return res.json({
      ok: true,
      exists: true,
      ...buildPhotoStatus(data),
      updatedAtIso: data.updatedAtIso || "",
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
  const match = text.match(/\bBR\d{6,}[A-Z]?\b/i);
  return match ? match[0].toUpperCase() : "";
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("API server running on port " + port);
});