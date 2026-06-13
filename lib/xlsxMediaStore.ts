import { NativeModules, Platform } from "react-native";

type MediaStoreXlsxFile = {
  uri: string;
  name: string;
  path?: string;
  modifiedAt?: number;
  addedAt?: number;
  size?: number;
};

type XlsxMediaStoreModule = {
  listRomaneioXlsx?: () => Promise<MediaStoreXlsxFile[]>;
  readBase64?: (uri: string) => Promise<string>;
};

// Mantem o APK com o mesmo comportamento validado no Expo Go.
// A camada nativa MediaStore fica no projeto como reforco futuro, mas desligada
// para nao criar diferenca entre teste no Expo Go e app instalado.
const ENABLE_NATIVE_MEDIASTORE_XLSX = false;

function getNativeModule() {
  if (!ENABLE_NATIVE_MEDIASTORE_XLSX) {
    return null;
  }

  if (Platform.OS !== "android") {
    return null;
  }

  return (NativeModules.XlsxMediaStore || null) as XlsxMediaStoreModule | null;
}

export async function listRomaneioXlsxFromMediaStore() {
  const nativeModule = getNativeModule();
  if (!nativeModule?.listRomaneioXlsx) {
    return [] as MediaStoreXlsxFile[];
  }

  try {
    const files = await nativeModule.listRomaneioXlsx();
    return Array.isArray(files) ? files : [];
  } catch (error) {
    console.log("[TELA2-EM-ROTA] MediaStore indisponivel", error);
    return [] as MediaStoreXlsxFile[];
  }
}

export async function readMediaStoreXlsxBase64(uri: string) {
  const nativeModule = getNativeModule();
  if (!nativeModule?.readBase64) {
    return null;
  }

  try {
    return await nativeModule.readBase64(uri);
  } catch (error) {
    console.log("[TELA2-EM-ROTA] MediaStore readBase64 falhou", error);
    return null;
  }
}
