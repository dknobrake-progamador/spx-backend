import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

const SECURE_IMAGES_DIR = `${FileSystem.documentDirectory}.secure-dev-images/`;
const LEGACY_IMAGES_DIR = `${FileSystem.documentDirectory}dev-images/`;
const LOCAL_LOGIN_PHOTOS_DIR = `${FileSystem.documentDirectory}salva-localmente-placas-e-telas/`;

export function getImageExtension(uri: string) {
  if (uri.startsWith("data:image/")) {
    const mime = uri.match(/^data:(image\/[a-zA-Z0-9.+-]+)/)?.[1] || "";
    return getExtensionFromMime(mime);
  }

  const cleanUri = uri.split("?")[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "jpg";
}

function getExtensionFromMime(mime: string) {
  if (mime.includes("svg")) return "svg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "jpg";
}

export function isManagedDevImage(uri: string) {
  return (
    uri.startsWith(SECURE_IMAGES_DIR) ||
    uri.startsWith(LEGACY_IMAGES_DIR) ||
    uri.startsWith(LOCAL_LOGIN_PHOTOS_DIR)
  );
}

async function ensureDevImagesDir() {
  for (const dir of [SECURE_IMAGES_DIR, LOCAL_LOGIN_PHOTOS_DIR]) {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }
}

function getManagedDestinationUri(fileBaseName: string, extension: string) {
  return `${SECURE_IMAGES_DIR}${fileBaseName}.${extension}`;
}

function getLocalLoginPhotoDestinationUri(fileBaseName: string, extension: string) {
  return `${LOCAL_LOGIN_PHOTOS_DIR}${fileBaseName}.${extension}`;
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

export async function deleteIfManaged(uri: string | null) {
  if (!uri || !isManagedDevImage(uri)) {
    return;
  }

  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

export async function persistImage(key: string, uri: string | null, fileBaseName: string) {
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

  if (uri.startsWith("data:image/")) {
    await writeDataUrlToManagedFile(key, fileBaseName, uri);
    return;
  }

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

export async function getPersistedImage(key: string) {
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

function guessMimeFromUri(uri: string) {
  const ext = getImageExtension(uri);
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export async function uriToDataUrl(uri: string | null) {
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
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+)(?:;[^,]*)?,([\s\S]+)$/);
  if (!match) return;

  await ensureDevImagesDir();
  const mime = match[1];
  const payload = match[2];
  const isBase64 = dataUrl.slice(0, dataUrl.indexOf(",")).toLowerCase().includes(";base64");
  const ext = getExtensionFromMime(mime);
  const destinationUri = getLocalLoginPhotoDestinationUri(fileBaseName, ext);

  const previousUri = await AsyncStorage.getItem(key);
  if (previousUri && previousUri !== destinationUri) {
    await deleteIfManaged(previousUri);
  }

  const destinationInfo = await FileSystem.getInfoAsync(destinationUri);
  if (destinationInfo.exists) {
    await FileSystem.deleteAsync(destinationUri, { idempotent: true });
  }

  if (isBase64) {
    await FileSystem.writeAsStringAsync(destinationUri, payload, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    let decodedPayload = payload;
    try {
      decodedPayload = decodeURIComponent(payload);
    } catch {
      // Mantem o payload original se vier com algum escape invalido.
    }
    await FileSystem.writeAsStringAsync(destinationUri, decodedPayload);
  }

  await AsyncStorage.setItem(key, destinationUri);
}

async function downloadRemoteImageToManagedFile(
  key: string,
  fileBaseName: string,
  remoteUri: string
) {
  const uri = remoteUri.trim();
  if (!/^https?:\/\//i.test(uri)) return;

  await ensureDevImagesDir();
  const destinationUri = getLocalLoginPhotoDestinationUri(fileBaseName, getImageExtension(uri));

  const previousUri = await AsyncStorage.getItem(key);
  if (previousUri && previousUri !== destinationUri) {
    await deleteIfManaged(previousUri);
  }

  const destinationInfo = await FileSystem.getInfoAsync(destinationUri);
  if (destinationInfo.exists) {
    await FileSystem.deleteAsync(destinationUri, { idempotent: true });
  }

  await FileSystem.downloadAsync(uri, destinationUri);
  await AsyncStorage.setItem(key, destinationUri);
}

export async function writeCloudPhotoToManagedFile(
  key: string,
  fileBaseName: string,
  cloudValue?: string
) {
  const value = cloudValue?.trim();
  if (!value) return;

  if (value.startsWith("data:image/")) {
    await writeDataUrlToManagedFile(key, fileBaseName, value);
    return;
  }

  if (/^https?:\/\//i.test(value)) {
    await downloadRemoteImageToManagedFile(key, fileBaseName, value);
    return;
  }

  if (value.startsWith("file://")) {
    await persistImage(key, value, fileBaseName);
  }
}
