import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { apiRequest } from "./apiClient";
import {
  deleteIfManaged,
  getPersistedImage,
  isManagedDevImage,
  persistImage,
  uriToDataUrl,
  writeCloudPhotoToManagedFile,
} from "./photoCache";

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
const KEY_PHOTO_CACHE_UID = "@DEV_PHOTO_CACHE_UID";
export const KEY_TELA6 = "@DEV_TELA6_URI";
export const KEY_TELA11 = "@DEV_TELA11_URI";
export const KEY_TELA3_CALL_COUNT = "@DEV_TELA3_CALL_COUNT";
export const KEY_TELA3_CALL_LOG = "@DEV_TELA3_CALL_LOG";
export const KEY_TELA3_OCCURRENCE_COUNT = "@DEV_TELA3_OCCURRENCE_COUNT";
export const KEY_TELA3_OCCURRENCE_ACTIVE = "@DEV_TELA3_OCCURRENCE_ACTIVE";
export const KEY_TELA3_OCCURRENCE_VARIANT = "@DEV_TELA3_OCCURRENCE_VARIANT";
export const KEY_TELA3_PRIMARY_SCREEN = "@DEV_TELA3_PRIMARY_SCREEN";
export const KEY_TELA2_VARIANT = "@DEV_TELA2_VARIANT";
export const KEY_SCANNED_BR_CODE = "@DEV_SCANNED_BR_CODE";
export const KEY_SCANNED_OCCURRENCE = "@DEV_SCANNED_OCCURRENCE";
export const KEY_LABEL_PHOTO_URI = "@DEV_LABEL_PHOTO_URI";
export const KEY_PROFILE_FACE_URI = "@DEV_PROFILE_FACE_URI";
export const KEY_PROFILE_AVATAR_URI = "@DEV_PROFILE_AVATAR_URI";
export const KEY_DRIVER_DISPLAY_NAME = "@DEV_DRIVER_DISPLAY_NAME";
export const KEY_DRIVER_VEHICLE_TYPE = "@DEV_DRIVER_VEHICLE_TYPE";
export const KEY_DRIVER_CNH_NUMBER = "@DEV_DRIVER_CNH_NUMBER";
const MASTER_ADMIN_PHONES = new Set(["21978818116", "5521978818116"]);
const FACE_CAPTURE_KEY = "@DEV_FACE_CAPTURE_URI";
const FACE_DOCUMENT_CAPTURE_KEY = "@DEV_FACE_DOCUMENT_CAPTURE_URI";
const USER_SCOPED_IMAGE_KEYS = [
  KEY_PLACA,
  KEY_PLACA_2,
  KEY_TELA6,
  KEY_TELA11,
  KEY_LABEL_PHOTO_URI,
  KEY_PROFILE_FACE_URI,
  KEY_PROFILE_AVATAR_URI,
];
const USER_SCOPED_DATA_KEYS = [
  KEY_PLACA_2_ACTIVE,
  KEY_CURRENT_PROFILE,
  KEY_DRIVER_DISPLAY_NAME,
  KEY_DRIVER_VEHICLE_TYPE,
  KEY_DRIVER_CNH_NUMBER,
  KEY_PHOTO_CACHE_UID,
  FACE_CAPTURE_KEY,
  FACE_DOCUMENT_CAPTURE_KEY,
];

async function getDynamicUserScopedKeys() {
  const allKeys = await AsyncStorage.getAllKeys();
  return allKeys.filter((key) => key.startsWith(`${KEY_LABEL_PHOTO_URI}_`));
}

async function clearUserScopedLocalState() {
  const dynamicPhotoKeys = await getDynamicUserScopedKeys();
  const imageKeys = [...USER_SCOPED_IMAGE_KEYS, ...dynamicPhotoKeys];
  const imageValues = await AsyncStorage.multiGet(imageKeys);

  await Promise.all(imageValues.map(([, uri]) => deleteIfManaged(uri)));
  await AsyncStorage.multiRemove([...imageKeys, ...USER_SCOPED_DATA_KEYS]);
}

async function replaceCloudPhotoToManagedFile(
  key: string,
  fileBaseName: string,
  cloudValue?: string
) {
  const value = cloudValue?.trim();
  if (!value) {
    await deleteIfManaged(await AsyncStorage.getItem(key));
    await AsyncStorage.removeItem(key);
    return;
  }

  await writeCloudPhotoToManagedFile(key, fileBaseName, value);
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

export async function setDriverDisplayName(name: string | null) {
  const normalized = name?.trim();
  if (!normalized) {
    await AsyncStorage.removeItem(KEY_DRIVER_DISPLAY_NAME);
    return;
  }
  await AsyncStorage.setItem(KEY_DRIVER_DISPLAY_NAME, normalized.toUpperCase());
}

export async function getDriverDisplayName() {
  return await AsyncStorage.getItem(KEY_DRIVER_DISPLAY_NAME);
}

export async function setDriverVehicleType(vehicleType: string | null) {
  const normalized = vehicleType?.trim();
  if (!normalized) {
    await AsyncStorage.removeItem(KEY_DRIVER_VEHICLE_TYPE);
    return;
  }
  await AsyncStorage.setItem(KEY_DRIVER_VEHICLE_TYPE, normalized.toUpperCase());
}

export async function getDriverVehicleType() {
  return await AsyncStorage.getItem(KEY_DRIVER_VEHICLE_TYPE);
}

export async function setDriverCnhNumber(cnhNumber: string | null) {
  const digits = String(cnhNumber || "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits)) {
    await AsyncStorage.removeItem(KEY_DRIVER_CNH_NUMBER);
    return;
  }
  await AsyncStorage.setItem(KEY_DRIVER_CNH_NUMBER, digits);
}

function generateElevenDigitNumber() {
  let value = "";
  for (let index = 0; index < 11; index += 1) {
    value += String(Math.floor(Math.random() * 10));
  }
  return value;
}

export async function getOrCreateDriverCnhNumber() {
  const saved = await AsyncStorage.getItem(KEY_DRIVER_CNH_NUMBER);
  if (saved && /^\d{11}$/.test(saved)) {
    return saved;
  }

  const generated = generateElevenDigitNumber();
  await AsyncStorage.setItem(KEY_DRIVER_CNH_NUMBER, generated);
  return generated;
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
    await clearUserScopedLocalState();
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

  const [previousUid, photoCacheUid] = await Promise.all([
    AsyncStorage.getItem(KEY_AUTH_UID),
    AsyncStorage.getItem(KEY_PHOTO_CACHE_UID),
  ]);
  const sameCachedUser = previousUid === session.uid || photoCacheUid === session.uid;

  if (!sameCachedUser) {
    await clearUserScopedLocalState();
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
  const uri = await getPersistedImage(KEY_TELA6);
  if (uri) {
    return uri;
  }

  const LOCAL_LOGIN_PHOTOS_DIR = `${FileSystem.documentDirectory}salva-localmente-placas-e-telas/`;
  const extensions = ["webp", "jpg", "jpeg", "png"];

  for (const ext of extensions) {
    const candidate = `${LOCAL_LOGIN_PHOTOS_DIR}tela6.${ext}`;

    try {
      const info = await FileSystem.getInfoAsync(candidate);
      if (info.exists) {
        await AsyncStorage.setItem(KEY_TELA6, candidate);
        console.log("[STORAGE] getTela6Uri: chave recuperada do disco:", candidate);
        return candidate;
      }
    } catch {
      // Continua tentando a proxima extensao.
    }
  }

  return null;
}

export async function getTela11Uri() {
  return await getPersistedImage(KEY_TELA11);
}

export async function getProfileFaceUri() {
  return await getPersistedImage(KEY_PROFILE_FACE_URI);
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
  const parsedCount = Number(count);
  const safeCount = Number.isFinite(parsedCount) ? parsedCount : 0;
  const normalized = Math.max(0, Math.min(15, Math.floor(safeCount)));
  await AsyncStorage.setItem(KEY_TELA3_OCCURRENCE_COUNT, String(normalized));
  if (normalized > 0) {
    await AsyncStorage.setItem(KEY_TELA2_VARIANT, "default");
  }

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
  const parsedDefault = Number(defaultValue);
  const safeDefault = Number.isFinite(parsedDefault) ? parsedDefault : 15;
  const fallback = Math.max(0, Math.min(15, Math.floor(safeDefault)));
  const hasLocalValue = Number.isFinite(localValue) && localValue >= 0;
  const normalizedLocalValue = hasLocalValue ? Math.max(0, Math.min(15, Math.floor(localValue))) : null;

  if (normalizedLocalValue !== null) {
    return normalizedLocalValue;
  }

  const idToken = await getAuthIdToken();
  if (!idToken) {
    return fallback;
  }

  try {
    const data = await apiRequest<{ ok: boolean; occurrenceCount: number }>("/me/occurrence-count", {
      idToken,
      timeoutMs: 20000,
    });
    const parsedCloud = Number(data.occurrenceCount);
    const safeCloud = Number.isFinite(parsedCloud) ? parsedCloud : fallback;
    const cloudValue = Math.max(0, Math.min(15, Math.floor(safeCloud)));
    await AsyncStorage.setItem(KEY_TELA3_OCCURRENCE_COUNT, String(cloudValue));
    return cloudValue;
  } catch {
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

export type Tela2Variant = "default" | "em-rota";

export async function setTela2Variant(variant: Tela2Variant) {
  await AsyncStorage.setItem(KEY_TELA2_VARIANT, variant);
}

export async function getTela2Variant() {
  const value = await AsyncStorage.getItem(KEY_TELA2_VARIANT);
  return value === "em-rota" ? "em-rota" : "default";
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

async function hasCompleteManagedPhotoCacheForCurrentUser() {
  const [cacheUid, authUid] = await Promise.all([
    AsyncStorage.getItem(KEY_PHOTO_CACHE_UID),
    AsyncStorage.getItem(KEY_AUTH_UID),
  ]);

  if (!authUid || cacheUid !== authUid) {
    return false;
  }

  const [placaUri, tela6Uri, tela11Uri, profileFaceUri] = await Promise.all([
    getPersistedImage(KEY_PLACA),
    getPersistedImage(KEY_TELA6),
    getPersistedImage(KEY_TELA11),
    getPersistedImage(KEY_PROFILE_FACE_URI),
  ]);

  const hasManagedPlaca = !!placaUri && isManagedDevImage(placaUri);
  const hasLegacyScreens = [tela6Uri, tela11Uri].every((uri) => !!uri && isManagedDevImage(uri));
  const hasGeneratedScreens = !!profileFaceUri && isManagedDevImage(profileFaceUri);

  return hasManagedPlaca && (hasLegacyScreens || hasGeneratedScreens);
}

export type CloudRegistrationMetadata = {
  driverDisplayName?: string;
  driverVehicleType?: string;
  driverCnhNumber?: string;
  registrationMode?: "profileFace" | "legacyUpload" | "incomplete";
};

function normalizeCloudRegistrationMetadata(metadata?: CloudRegistrationMetadata | null) {
  const driverDisplayName = String(metadata?.driverDisplayName || "").trim().toUpperCase();
  const driverVehicleType = String(metadata?.driverVehicleType || "").trim().toUpperCase();
  const driverCnhNumber = String(metadata?.driverCnhNumber || "").replace(/\D/g, "");
  const registrationMode = metadata?.registrationMode || "profileFace";

  return {
    ...(driverDisplayName ? { driverDisplayName } : {}),
    ...(driverVehicleType ? { driverVehicleType } : {}),
    ...(/^\d{11}$/.test(driverCnhNumber) ? { driverCnhNumber } : {}),
    registrationMode,
  };
}

async function getCurrentRegistrationMetadata() {
  const [driverDisplayName, driverVehicleType, driverCnhNumber] = await Promise.all([
    getDriverDisplayName(),
    getDriverVehicleType(),
    getOrCreateDriverCnhNumber(),
  ]);

  return normalizeCloudRegistrationMetadata({
    driverDisplayName: driverDisplayName || "",
    driverVehicleType: driverVehicleType || "",
    driverCnhNumber,
    registrationMode: "profileFace",
  });
}

async function persistCloudRegistrationMetadata(metadata?: CloudRegistrationMetadata | null) {
  if (!metadata) return;

  await Promise.all([
    metadata.driverDisplayName !== undefined
      ? setDriverDisplayName(metadata.driverDisplayName)
      : Promise.resolve(),
    metadata.driverVehicleType !== undefined
      ? setDriverVehicleType(metadata.driverVehicleType)
      : Promise.resolve(),
    metadata.driverCnhNumber !== undefined
      ? setDriverCnhNumber(metadata.driverCnhNumber)
      : Promise.resolve(),
  ]);
}

export async function syncCurrentUserPhotosToCloud() {
  const phone = await getCurrentUserPhone();
  const idToken = await getAuthIdToken();
  if (!phone || !idToken) {
    throw new Error("Sessao invalida para enviar fotos.");
  }

  const [placaUri, placa2Uri, tela6Uri, tela11Uri, profileFaceUri] = await Promise.all([
    getPlacaUri(),
    getPlaca2Uri(),
    getTela6Uri(),
    getTela11Uri(),
    getProfileFaceUri(),
  ]);

  const [placaDataUrl, placa2DataUrl, tela6DataUrl, tela11DataUrl, profileFaceDataUrl] = await Promise.all([
    uriToDataUrl(placaUri),
    uriToDataUrl(placa2Uri),
    uriToDataUrl(tela6Uri),
    uriToDataUrl(tela11Uri),
    uriToDataUrl(profileFaceUri),
  ]);

  return await apiRequest<{
    ok: boolean;
    requiredComplete: boolean;
    hasPlaca: boolean;
    hasTela6: boolean;
    hasTela11: boolean;
    hasPlaca2: boolean;
    hasProfileFace: boolean;
    generatedTela6?: boolean;
    generatedTela11?: boolean;
    generationMode?: "profileFace" | "legacyUpload" | "incomplete";
    metadata?: CloudRegistrationMetadata;
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
        profileFace: profileFaceDataUrl,
      },
      metadata: await getCurrentRegistrationMetadata(),
    },
  });
}

export type CloudPhotoKey = "placa" | "placa2" | "tela6" | "tela11" | "profileFace";

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

export async function syncSinglePhotoToCloud(
  photoKey: CloudPhotoKey,
  uri: string,
  metadata?: CloudRegistrationMetadata
) {
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
    hasProfileFace: boolean;
    generatedTela6?: boolean;
    generatedTela11?: boolean;
    generationMode?: "profileFace" | "legacyUpload" | "incomplete";
    metadata?: CloudRegistrationMetadata;
    updatedAtIso: string;
  }>("/photos/sync", {
    method: "POST",
    idToken,
    timeoutMs: 90000,
    body: {
      photos: {
        [photoKey]: dataUrl,
      },
      metadata: normalizeCloudRegistrationMetadata(metadata || (await getCurrentRegistrationMetadata())),
    },
  });
}

export async function syncCurrentUserRegistrationMetadataToCloud(
  metadata?: CloudRegistrationMetadata
) {
  const phone = await getCurrentUserPhone();
  const idToken = await getAuthIdToken();
  if (!phone || !idToken) {
    throw new Error("Sessao invalida para enviar dados do cadastro.");
  }

  return await apiRequest<{
    ok: boolean;
    metadata?: CloudRegistrationMetadata;
    updatedAtIso: string;
  }>("/photos/sync", {
    method: "POST",
    idToken,
    timeoutMs: 30000,
    body: {
      photos: {},
      metadata: normalizeCloudRegistrationMetadata(metadata || (await getCurrentRegistrationMetadata())),
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
    hasProfileFace: boolean;
    generatedTela6?: boolean;
    generatedTela11?: boolean;
    generationMode?: "profileFace" | "legacyUpload" | "incomplete";
    metadata?: CloudRegistrationMetadata;
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
    hasProfileFace: result.hasProfileFace,
    generatedTela6: result.generatedTela6,
    generatedTela11: result.generatedTela11,
    generationMode: result.generationMode,
    metadata: result.metadata,
    updatedAtIso: result.updatedAtIso,
  };
}

export async function hydrateCurrentUserPhotosFromCloud(options?: { force?: boolean } | boolean) {
  const phone = await getCurrentUserPhone();
  const idToken = await getAuthIdToken();
  if (!phone || !idToken) return;
  const force = options === true || (typeof options === "object" && options.force === true);

  if (!force && (await hasCompleteManagedPhotoCacheForCurrentUser())) {
    return;
  }

  const payload = await apiRequest<{
    exists: boolean;
    photos?: {
      placa?: string;
      placa2?: string;
      tela6?: string;
      tela11?: string;
      profileFace?: string;
    };
    metadata?: CloudRegistrationMetadata;
  }>("/photos/me", {
    idToken,
    timeoutMs: 120000,
  });

  if (!payload.exists) {
    await clearUserScopedLocalState();
    return;
  }
  const photos = payload.photos || {};

  await Promise.all([
    replaceCloudPhotoToManagedFile(KEY_PLACA, "placa", photos.placa),
    replaceCloudPhotoToManagedFile(KEY_PLACA_2, "placa2", photos.placa2),
    replaceCloudPhotoToManagedFile(KEY_TELA6, "tela6", photos.tela6),
    replaceCloudPhotoToManagedFile(KEY_TELA11, "tela11", photos.tela11),
    replaceCloudPhotoToManagedFile(KEY_PROFILE_FACE_URI, "profile-face", photos.profileFace),
  ]);
  if (!photos.placa2) {
    await AsyncStorage.removeItem(KEY_PLACA_2_ACTIVE);
  } else {
    await AsyncStorage.setItem(KEY_PLACA_2_ACTIVE, "1");
  }

  await persistCloudRegistrationMetadata(payload.metadata);

  const authUid = await AsyncStorage.getItem(KEY_AUTH_UID);
  if (authUid) {
    await AsyncStorage.setItem(KEY_PHOTO_CACHE_UID, authUid);
  }
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
  await deleteIfManaged(await AsyncStorage.getItem(KEY_PROFILE_FACE_URI));
  await deleteIfManaged(await AsyncStorage.getItem(KEY_PROFILE_AVATAR_URI));

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
    KEY_PHOTO_CACHE_UID,
    KEY_TELA6,
    KEY_TELA11,
    KEY_PROFILE_FACE_URI,
    KEY_PROFILE_AVATAR_URI,
    KEY_DRIVER_DISPLAY_NAME,
    KEY_DRIVER_VEHICLE_TYPE,
    KEY_DRIVER_CNH_NUMBER,
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
