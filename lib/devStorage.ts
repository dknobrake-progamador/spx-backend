import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { apiRequest } from "./apiClient";

export const KEY_PLACA = "@DEV_PLACA_URI";
export const KEY_PLACA_2 = "@DEV_PLACA_2_URI";
export const KEY_PLACA_2_ACTIVE = "@DEV_PLACA_2_ACTIVE";
export const KEY_CURRENT_PROFILE = "@DEV_CURRENT_PROFILE";
export const KEY_CURRENT_USER_PHONE = "@DEV_CURRENT_USER_PHONE";
export const KEY_AUTH_ID_TOKEN = "@DEV_AUTH_ID_TOKEN";
export const KEY_AUTH_UID = "@DEV_AUTH_UID";
export const KEY_AUTH_ROLE = "@DEV_AUTH_ROLE";
export const KEY_AUTH_EDIT_SCOPE = "@DEV_AUTH_EDIT_SCOPE";
export const KEY_AUTH_MUST_CHANGE_PASSWORD = "@DEV_AUTH_MUST_CHANGE_PASSWORD";
export const KEY_TELA6 = "@DEV_TELA6_URI";
export const KEY_TELA11 = "@DEV_TELA11_URI";
export const KEY_TELA3_CALL_COUNT = "@DEV_TELA3_CALL_COUNT";
export const KEY_TELA3_CALL_LOG = "@DEV_TELA3_CALL_LOG";
export const KEY_TELA3_OCCURRENCE_COUNT = "@DEV_TELA3_OCCURRENCE_COUNT";
export const KEY_TELA3_OCCURRENCE_ACTIVE = "@DEV_TELA3_OCCURRENCE_ACTIVE";
export const KEY_TELA3_OCCURRENCE_VARIANT = "@DEV_TELA3_OCCURRENCE_VARIANT";
export const KEY_TELA3_PRIMARY_SCREEN = "@DEV_TELA3_PRIMARY_SCREEN";
export const KEY_SCANNED_BR_CODE = "@DEV_SCANNED_BR_CODE";
export const KEY_SCANNED_OCCURRENCE = "@DEV_SCANNED_OCCURRENCE";
export const KEY_LABEL_PHOTO_URI = "@DEV_LABEL_PHOTO_URI";
const MASTER_ADMIN_PHONES = new Set(["21978818116", "5521978818116"]);

const SECURE_IMAGES_DIR = `${FileSystem.documentDirectory}.secure-dev-images/`;
const LEGACY_IMAGES_DIR = `${FileSystem.documentDirectory}dev-images/`;

function getImageExtension(uri: string) {
  const cleanUri = uri.split("?")[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "jpg";
}

function isManagedDevImage(uri: string) {
  return uri.startsWith(SECURE_IMAGES_DIR) || uri.startsWith(LEGACY_IMAGES_DIR);
}

async function ensureDevImagesDir() {
  const dirInfo = await FileSystem.getInfoAsync(SECURE_IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(SECURE_IMAGES_DIR, { intermediates: true });
  }
}

function getManagedDestinationUri(fileBaseName: string, extension: string) {
  return `${SECURE_IMAGES_DIR}${fileBaseName}.${extension}`;
}

async function moveManagedImageToSecureDir(uri: string, key: string) {
  if (!uri.startsWith(LEGACY_IMAGES_DIR)) {
    return uri;
  }

  await ensureDevImagesDir();
  const extension = getImageExtension(uri);
  const cleanUri = uri.split("?")[0];
  const fileName = cleanUri.slice(cleanUri.lastIndexOf("/") + 1) || `${key}.${extension}`;
  const destinationUri = `${SECURE_IMAGES_DIR}${fileName}`;

  if (destinationUri !== uri) {
    const destinationInfo = await FileSystem.getInfoAsync(destinationUri);
    if (!destinationInfo.exists) {
      await FileSystem.copyAsync({
        from: uri,
        to: destinationUri,
      });
    }
    await AsyncStorage.setItem(key, destinationUri);
  }

  return destinationUri;
}

async function deleteIfManaged(uri: string | null) {
  if (!uri || !isManagedDevImage(uri)) {
    return;
  }

  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

async function persistImage(key: string, uri: string | null, fileBaseName: string) {
  const previousUri = await AsyncStorage.getItem(key);

  if (!uri) {
    await deleteIfManaged(previousUri);
    await AsyncStorage.removeItem(key);
    return;
  }

  if (!FileSystem.documentDirectory) {
    await AsyncStorage.setItem(key, uri);
    return;
  }

  await ensureDevImagesDir();

  const extension = getImageExtension(uri);
  const destinationUri = getManagedDestinationUri(fileBaseName, extension);

  if (previousUri && previousUri !== destinationUri) {
    await deleteIfManaged(previousUri);
  }

  const destinationInfo = await FileSystem.getInfoAsync(destinationUri);
  if (destinationInfo.exists) {
    await FileSystem.deleteAsync(destinationUri, { idempotent: true });
  }

  await FileSystem.copyAsync({
    from: uri,
    to: destinationUri,
  });

  await AsyncStorage.setItem(key, destinationUri);
}

async function getPersistedImage(key: string) {
  const uri = await AsyncStorage.getItem(key);
  if (!uri) {
    return null;
  }

  if (isManagedDevImage(uri)) {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return await moveManagedImageToSecureDir(uri, key);
  }

  return uri;
}

/* ===================================== */
/* ✅ SALVAR OU RESETAR (AGORA FUNCIONA) */
/* ===================================== */

export async function setPlacaUri(uri: string | null) {
  await persistImage(KEY_PLACA, uri, "placa");
}

export async function setPlaca2Uri(uri: string | null) {
  await persistImage(KEY_PLACA_2, uri, "placa2");
}

export async function setPlaca2Active(active: boolean) {
  if (!active) {
    await AsyncStorage.removeItem(KEY_PLACA_2_ACTIVE);
    return;
  }

  await AsyncStorage.setItem(KEY_PLACA_2_ACTIVE, "1");
}

export async function setTela6Uri(uri: string | null) {
  await persistImage(KEY_TELA6, uri, "tela6");
}

export async function setTela11Uri(uri: string | null) {
  await persistImage(KEY_TELA11, uri, "tela11");
}

/* ===================================== */
/* ✅ OBTER */
/* ===================================== */

export async function getPlacaUri() {
  return await getPersistedImage(KEY_PLACA);
}

export async function getPlaca2Uri() {
  return await getPersistedImage(KEY_PLACA_2);
}

export async function getPlaca2Active() {
  return (await AsyncStorage.getItem(KEY_PLACA_2_ACTIVE)) === "1";
}

export async function setCurrentProfile(profile: "007" | "008") {
  await AsyncStorage.setItem(KEY_CURRENT_PROFILE, profile);
}

export async function setCurrentUserPhone(phone: string | null) {
  const normalized = phone?.trim();
  if (!normalized) {
    await AsyncStorage.removeItem(KEY_CURRENT_USER_PHONE);
    return;
  }
  await AsyncStorage.setItem(KEY_CURRENT_USER_PHONE, normalized);
}

export async function getCurrentUserPhone() {
  return await AsyncStorage.getItem(KEY_CURRENT_USER_PHONE);
}

export async function setAuthSession(session: {
  phone: string;
  uid: string;
  idToken: string;
  role?: string;
  editScope?: "none" | "tela4" | "all";
  mustChangePassword?: boolean;
} | null) {
  if (!session) {
    await AsyncStorage.multiRemove([
      KEY_CURRENT_USER_PHONE,
      KEY_AUTH_UID,
      KEY_AUTH_ID_TOKEN,
      KEY_AUTH_ROLE,
      KEY_AUTH_EDIT_SCOPE,
      KEY_AUTH_MUST_CHANGE_PASSWORD,
    ]);
    return;
  }

  await AsyncStorage.multiSet([
    [KEY_CURRENT_USER_PHONE, session.phone],
    [KEY_AUTH_UID, session.uid],
    [KEY_AUTH_ID_TOKEN, session.idToken],
    [KEY_AUTH_ROLE, session.role || "user"],
    [KEY_AUTH_EDIT_SCOPE, session.editScope || "none"],
    [KEY_AUTH_MUST_CHANGE_PASSWORD, session.mustChangePassword ? "1" : "0"],
  ]);
}

export async function getAuthIdToken() {
  return await AsyncStorage.getItem(KEY_AUTH_ID_TOKEN);
}

export async function getAuthRole() {
  return (await AsyncStorage.getItem(KEY_AUTH_ROLE)) || "user";
}

export async function getAuthEditScope() {
  const value = await AsyncStorage.getItem(KEY_AUTH_EDIT_SCOPE);
  return value === "tela4" || value === "all" ? value : "none";
}

export async function getAuthMustChangePassword() {
  return (await AsyncStorage.getItem(KEY_AUTH_MUST_CHANGE_PASSWORD)) === "1";
}

export async function completeCurrentUserEditMode() {
  const phone = await getCurrentUserPhone();
  const idToken = await getAuthIdToken();
  if (!phone || !idToken) {
    throw new Error("Sessao invalida para concluir modo de edicao.");
  }

  await apiRequest<{ ok: boolean; editMode: boolean; editScope: "none" }>("/auth/complete-edit-mode", {
    method: "POST",
    idToken,
    timeoutMs: 30000,
  });

  await AsyncStorage.setItem(KEY_AUTH_EDIT_SCOPE, "none");
}

export async function getCurrentAdminAccess() {
  const phone = ((await getCurrentUserPhone()) || "").replace(/\D/g, "");
  if (MASTER_ADMIN_PHONES.has(phone)) {
    await AsyncStorage.setItem(KEY_AUTH_ROLE, "master");
    return "master" as const;
  }

  const idToken = await getAuthIdToken();
  if (!idToken) {
    return "none" as const;
  }

  try {
    const data = await apiRequest<{ ok: boolean; access: "master" | "admin2" }>("/admin/access", {
      idToken,
      timeoutMs: 15000,
    });
    await AsyncStorage.setItem(KEY_AUTH_ROLE, data.access);
    return data.access;
  } catch {
    return "none" as const;
  }
}

export async function isCurrentUserAdmin() {
  const role = await getAuthRole();
  if (role === "master" || role === "admin2") {
    return true;
  }

  const phone = ((await getCurrentUserPhone()) || "").replace(/\D/g, "");
  if (MASTER_ADMIN_PHONES.has(phone)) {
    return true;
  }

  const access = await getCurrentAdminAccess();
  return access === "master" || access === "admin2";
}

export async function getCurrentProfile() {
  const value = await AsyncStorage.getItem(KEY_CURRENT_PROFILE);
  return value === "008" ? "008" : "007";
}

export async function getPlacaDisplayUri() {
  return await getPlacaUri();
}

export async function getPlaca2DisplayUri() {
  return await getPlaca2Uri();
}

export const setTela4Uri = setPlacaUri;
export const getTela4Uri = getPlacaUri;
export const getTela4DisplayUri = getPlacaDisplayUri;

export async function getTela6Uri() {
  return await getPersistedImage(KEY_TELA6);
}

export async function getTela11Uri() {
  return await getPersistedImage(KEY_TELA11);
}

/* ===================================== */
/* ✅ MAPEAMENTO DE CHAMADAS DA TELA 3 */
/* ===================================== */

export async function registerTela3Call() {
  const currentCount = Number(await AsyncStorage.getItem(KEY_TELA3_CALL_COUNT)) || 0;
  const nextCount = currentCount + 1;
  const log = JSON.parse((await AsyncStorage.getItem(KEY_TELA3_CALL_LOG)) || "[]");

  const entry = {
    count: nextCount,
    at: new Date().toISOString(),
  };

  log.unshift(entry);

  await AsyncStorage.multiSet([
    [KEY_TELA3_CALL_COUNT, String(nextCount)],
    [KEY_TELA3_CALL_LOG, JSON.stringify(log.slice(0, 20))],
  ]);

  return entry;
}

export async function getTela3CallCount() {
  return Number(await AsyncStorage.getItem(KEY_TELA3_CALL_COUNT)) || 0;
}

export async function getTela3CallLog() {
  const raw = await AsyncStorage.getItem(KEY_TELA3_CALL_LOG);
  return raw ? JSON.parse(raw) : [];
}

export async function setTela3OccurrenceCount(count: number) {
  const normalized = Math.max(1, Math.min(15, Math.floor(Number(count) || 1)));
  await AsyncStorage.setItem(KEY_TELA3_OCCURRENCE_COUNT, String(normalized));

  const idToken = await getAuthIdToken();
  if (!idToken) return normalized;

  try {
    await apiRequest<{ ok: boolean; occurrenceCount: number }>("/me/occurrence-count", {
      method: "PATCH",
      idToken,
      timeoutMs: 20000,
      body: { occurrenceCount: normalized },
    });
  } catch {
    // Keep local value when network/backend is unavailable.
  }

  return normalized;
}

export async function getTela3OccurrenceCount(defaultValue = 15) {
  const localRaw = await AsyncStorage.getItem(KEY_TELA3_OCCURRENCE_COUNT);
  const localValue = Number(localRaw);
  const fallback = Math.max(1, Math.min(15, Math.floor(defaultValue || 15)));

  const idToken = await getAuthIdToken();
  if (!idToken) {
    if (Number.isFinite(localValue) && localValue >= 1) return Math.min(15, Math.floor(localValue));
    return fallback;
  }

  try {
    const data = await apiRequest<{ ok: boolean; occurrenceCount: number }>("/me/occurrence-count", {
      idToken,
      timeoutMs: 20000,
    });
    const cloudValue = Math.max(1, Math.min(15, Math.floor(Number(data.occurrenceCount) || fallback)));
    await AsyncStorage.setItem(KEY_TELA3_OCCURRENCE_COUNT, String(cloudValue));
    return cloudValue;
  } catch {
    if (Number.isFinite(localValue) && localValue >= 1) return Math.min(15, Math.floor(localValue));
    return fallback;
  }
}

export async function setTela3OccurrenceActive(active: boolean) {
  if (!active) {
    await AsyncStorage.removeItem(KEY_TELA3_OCCURRENCE_ACTIVE);
    return;
  }

  await AsyncStorage.setItem(KEY_TELA3_OCCURRENCE_ACTIVE, "1");
}

export async function getTela3OccurrenceActive() {
  return (await AsyncStorage.getItem(KEY_TELA3_OCCURRENCE_ACTIVE)) === "1";
}

export type Tela3OccurrenceVariant = "oco1" | "oco2" | "oco4" | "oco5";

const TELA3_OCCURRENCE_VARIANTS: Tela3OccurrenceVariant[] = ["oco1", "oco2", "oco4"];

export async function setTela3OccurrenceVariant(variant: Tela3OccurrenceVariant | null) {
  if (!variant) {
    await AsyncStorage.removeItem(KEY_TELA3_OCCURRENCE_VARIANT);
    return;
  }

  await AsyncStorage.setItem(KEY_TELA3_OCCURRENCE_VARIANT, variant);
}

export async function getTela3OccurrenceVariant() {
  const value = await AsyncStorage.getItem(KEY_TELA3_OCCURRENCE_VARIANT);
  if (value === "oco1" || value === "oco2" || value === "oco4" || value === "oco5") {
    return value;
  }

  return "oco1" as Tela3OccurrenceVariant;
}

export async function getNextTela3OccurrenceVariant() {
  const current = await getTela3OccurrenceVariant();
  const index = TELA3_OCCURRENCE_VARIANTS.indexOf(current);
  return TELA3_OCCURRENCE_VARIANTS[(index + 1) % TELA3_OCCURRENCE_VARIANTS.length];
}

export type Tela3PrimaryScreen = "tela3" | "tela30";

export async function setTela3PrimaryScreen(screen: Tela3PrimaryScreen) {
  await AsyncStorage.setItem(KEY_TELA3_PRIMARY_SCREEN, screen);
}

export async function getTela3PrimaryScreen() {
  const value = await AsyncStorage.getItem(KEY_TELA3_PRIMARY_SCREEN);
  return value === "tela3" ? "tela3" : "tela30";
}

export async function setScannedBrCode(code: string | null) {
  const normalized = code?.trim();
  if (!normalized) {
    await AsyncStorage.removeItem(KEY_SCANNED_BR_CODE);
    return;
  }

  await AsyncStorage.setItem(KEY_SCANNED_BR_CODE, normalized);
}

export async function getScannedBrCode() {
  return await AsyncStorage.getItem(KEY_SCANNED_BR_CODE);
}

export type ScannedOccurrence = {
  codigo: string;
  endereco?: string | null;
  pessoa?: string | null;
  status?: string | null;
  statusDate?: string | null;
  raw?: string | null;
  scanType?: string | null;
};

function getScannedOccurrenceKey(index?: number | null) {
  if (typeof index === "number" && Number.isFinite(index) && index >= 0) {
    return `${KEY_SCANNED_OCCURRENCE}_${index}`;
  }

  return KEY_SCANNED_OCCURRENCE;
}

function getLabelPhotoKey(index?: number | null) {
  if (typeof index === "number" && Number.isFinite(index) && index >= 0) {
    return `${KEY_LABEL_PHOTO_URI}_${index}`;
  }

  return KEY_LABEL_PHOTO_URI;
}

export async function setScannedOccurrence(
  occurrence: ScannedOccurrence | null,
  index?: number | null
) {
  const key = getScannedOccurrenceKey(index);
  if (!occurrence) {
    await AsyncStorage.removeItem(key);
    return;
  }

  await AsyncStorage.setItem(key, JSON.stringify(occurrence));
}

export async function getScannedOccurrence(index?: number | null) {
  const raw = await AsyncStorage.getItem(getScannedOccurrenceKey(index));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ScannedOccurrence;
    if (!parsed?.codigo) {
      return null;
    }

    return parsed;
  } catch {
    await AsyncStorage.removeItem(getScannedOccurrenceKey(index));
    return null;
  }
}

export async function getAllScannedOccurrences() {
  const entries = await AsyncStorage.getAllKeys();
  const indexedKeys = entries.filter((key) => key.startsWith(`${KEY_SCANNED_OCCURRENCE}_`));
  const indexedValues = await AsyncStorage.multiGet(indexedKeys);

  return indexedValues.reduce<Record<number, ScannedOccurrence>>((acc, [key, raw]) => {
    if (!raw) {
      return acc;
    }

    const suffix = Number(key.slice(`${KEY_SCANNED_OCCURRENCE}_`.length));
    if (!Number.isFinite(suffix)) {
      return acc;
    }

    try {
      const parsed = JSON.parse(raw) as ScannedOccurrence;
      if (parsed?.codigo) {
        acc[suffix] = parsed;
      }
    } catch {
      // Ignore invalid stored items and keep the screen usable.
    }

    return acc;
  }, {});
}

export async function setLabelPhotoUri(uri: string | null, index?: number | null) {
  const key = getLabelPhotoKey(index);
  const suffix = typeof index === "number" && index >= 0 ? `-${index}` : "";
  await persistImage(key, uri, `label-photo${suffix}`);
}

export async function getLabelPhotoUri(index?: number | null) {
  return await getPersistedImage(getLabelPhotoKey(index));
}

function toFirestoreString(value: string) {
  return { stringValue: value };
}

function fromFirestoreString(
  fields: Record<string, { stringValue?: string }>,
  key: string
) {
  return fields?.[key]?.stringValue || "";
}

function guessMimeFromUri(uri: string) {
  const ext = getImageExtension(uri);
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function uriToDataUrl(uri: string | null) {
  if (!uri) return "";
  if (uri.startsWith("data:image/")) return uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${guessMimeFromUri(uri)};base64,${base64}`;
}

async function writeDataUrlToManagedFile(
  key: string,
  fileBaseName: string,
  dataUrl: string
) {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return;

  await ensureDevImagesDir();
  const mime = match[1];
  const base64 = match[2];
  const ext = mime.includes("svg")
    ? "svg"
    : mime.includes("png")
      ? "png"
      : mime.includes("webp")
        ? "webp"
        : "jpg";
  const destinationUri = getManagedDestinationUri(fileBaseName, ext);

  const previousUri = await AsyncStorage.getItem(key);
  if (previousUri && previousUri !== destinationUri) {
    await deleteIfManaged(previousUri);
  }

  await FileSystem.writeAsStringAsync(destinationUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await AsyncStorage.setItem(key, destinationUri);
}

export async function syncCurrentUserPhotosToCloud() {
  const phone = await getCurrentUserPhone();
  const idToken = await getAuthIdToken();
  if (!phone || !idToken) {
    throw new Error("Sessao invalida para enviar fotos.");
  }

  const [placaUri, placa2Uri, tela6Uri, tela11Uri] = await Promise.all([
    getPlacaUri(),
    getPlaca2Uri(),
    getTela6Uri(),
    getTela11Uri(),
  ]);

  const [placaDataUrl, placa2DataUrl, tela6DataUrl, tela11DataUrl] = await Promise.all([
    uriToDataUrl(placaUri),
    uriToDataUrl(placa2Uri),
    uriToDataUrl(tela6Uri),
    uriToDataUrl(tela11Uri),
  ]);

  return await apiRequest<{
    ok: boolean;
    requiredComplete: boolean;
    hasPlaca: boolean;
    hasTela6: boolean;
    hasTela11: boolean;
    hasPlaca2: boolean;
    updatedAtIso: string;
  }>("/photos/sync", {
    method: "POST",
    idToken,
    timeoutMs: 120000,
    body: {
      photos: {
        placa: placaDataUrl,
        placa2: placa2DataUrl,
        tela6: tela6DataUrl,
        tela11: tela11DataUrl,
      },
    },
  });
}

export type CloudPhotoKey = "placa" | "placa2" | "tela6" | "tela11";

export type GeneratedPlateTarget = "placa" | "placa2";

export async function applyGeneratedPlateToUser(
  login: string,
  target: GeneratedPlateTarget,
  imageDataUrl: string
) {
  const idToken = await getAuthIdToken();
  if (!idToken) {
    throw new Error("Sessao invalida para aplicar a placa.");
  }

  try {
    return await apiRequest<{
      ok: boolean;
      uid: string;
      phone: string;
      slot: GeneratedPlateTarget;
      updatedAtIso: string;
    }>("/admin/generated-plate", {
      method: "POST",
      idToken,
      timeoutMs: 120000,
      body: {
        login,
        slot: target,
        imageDataUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("/admin/generated-plate")) {
      throw new Error(
        "O backend configurado ainda nao suporta enviar placa gerada. Publique a versao atual de backend-ocr/server.js ou aponte EXPO_PUBLIC_AUTH_BASE_URL para um servidor atualizado."
      );
    }

    throw error;
  }
}

export async function syncSinglePhotoToCloud(photoKey: CloudPhotoKey, uri: string) {
  const phone = await getCurrentUserPhone();
  const idToken = await getAuthIdToken();
  if (!phone || !idToken) {
    throw new Error("Sessao invalida para enviar fotos.");
  }

  const dataUrl = await uriToDataUrl(uri);
  if (!dataUrl) {
    throw new Error("Nao foi possivel ler a imagem selecionada.");
  }

  return await apiRequest<{
    ok: boolean;
    requiredComplete: boolean;
    hasPlaca: boolean;
    hasTela6: boolean;
    hasTela11: boolean;
    hasPlaca2: boolean;
    updatedAtIso: string;
  }>("/photos/sync", {
    method: "POST",
    idToken,
    timeoutMs: 90000,
    body: {
      photos: {
        [photoKey]: dataUrl,
      },
    },
  });
}

export async function validateCurrentUserPhotosInCloud() {
  const phone = await getCurrentUserPhone();
  const idToken = await getAuthIdToken();
  if (!phone || !idToken) {
    throw new Error("Sessao invalida para validar nuvem.");
  }

  const result = await apiRequest<{
    exists: boolean;
    requiredComplete: boolean;
    hasPlaca: boolean;
    hasTela6: boolean;
    hasTela11: boolean;
    hasPlaca2: boolean;
    updatedAtIso: string;
  }>("/photos/me", {
    idToken,
    timeoutMs: 30000,
  });

  return {
    exists: result.exists,
    requiredInCloud: result.requiredComplete,
    hasPlaca: result.hasPlaca,
    hasTela6: result.hasTela6,
    hasTela11: result.hasTela11,
    hasPlaca2: result.hasPlaca2,
    updatedAtIso: result.updatedAtIso,
  };
}

export async function hydrateCurrentUserPhotosFromCloud() {
  const phone = await getCurrentUserPhone();
  const idToken = await getAuthIdToken();
  if (!phone || !idToken) return;

  const payload = await apiRequest<{
    exists: boolean;
    photos?: {
      placa?: string;
      placa2?: string;
      tela6?: string;
      tela11?: string;
    };
  }>("/photos/me", {
    idToken,
    timeoutMs: 120000,
  });

  if (!payload.exists) return;
  const photos = payload.photos || {};

  await Promise.all([
    writeDataUrlToManagedFile(KEY_PLACA, "placa", photos.placa || ""),
    writeDataUrlToManagedFile(KEY_PLACA_2, "placa2", photos.placa2 || ""),
    writeDataUrlToManagedFile(KEY_TELA6, "tela6", photos.tela6 || ""),
    writeDataUrlToManagedFile(KEY_TELA11, "tela11", photos.tela11 || ""),
  ]);
}

/* ===================================== */
/* ✅ LIMPAR TODAS */
/* ===================================== */

export async function clearDevUris() {
  await deleteIfManaged(await AsyncStorage.getItem(KEY_PLACA));
  await deleteIfManaged(await AsyncStorage.getItem(KEY_PLACA_2));
  await deleteIfManaged(await AsyncStorage.getItem(KEY_TELA6));
  await deleteIfManaged(await AsyncStorage.getItem(KEY_TELA11));
  await deleteIfManaged(await AsyncStorage.getItem(KEY_LABEL_PHOTO_URI));

  const allKeys = await AsyncStorage.getAllKeys();
  const dynamicKeys = allKeys.filter(
    (key) =>
      key.startsWith(`${KEY_SCANNED_OCCURRENCE}_`) || key.startsWith(`${KEY_LABEL_PHOTO_URI}_`)
  );

  const dynamicPhotoKeys = dynamicKeys.filter((key) => key.startsWith(`${KEY_LABEL_PHOTO_URI}_`));
  const dynamicPhotoValues = await AsyncStorage.multiGet(dynamicPhotoKeys);
  await Promise.all(dynamicPhotoValues.map(([, uri]) => deleteIfManaged(uri)));

  await AsyncStorage.multiRemove([
    KEY_PLACA,
    KEY_PLACA_2,
    KEY_PLACA_2_ACTIVE,
    KEY_CURRENT_PROFILE,
    KEY_CURRENT_USER_PHONE,
    KEY_AUTH_UID,
    KEY_AUTH_ID_TOKEN,
    KEY_AUTH_ROLE,
    KEY_AUTH_EDIT_SCOPE,
    KEY_AUTH_MUST_CHANGE_PASSWORD,
    KEY_TELA6,
    KEY_TELA11,
    KEY_TELA3_CALL_COUNT,
    KEY_TELA3_CALL_LOG,
    KEY_TELA3_OCCURRENCE_COUNT,
    KEY_TELA3_OCCURRENCE_ACTIVE,
    KEY_TELA3_OCCURRENCE_VARIANT,
    KEY_SCANNED_BR_CODE,
    KEY_SCANNED_OCCURRENCE,
    KEY_LABEL_PHOTO_URI,
    ...dynamicKeys,
  ]);
}
