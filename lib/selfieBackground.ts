import { NativeModules, Platform } from "react-native";

type SelfieBackgroundModule = {
  makeWhiteBackground?: (uri: string) => Promise<string>;
};

function getNativeModule() {
  if (Platform.OS !== "android") {
    return null;
  }

  return (NativeModules.SelfieBackground || null) as SelfieBackgroundModule | null;
}

export async function makeSelfieDocumentWhiteBackground(uri: string) {
  const nativeModule = getNativeModule();
  if (!nativeModule?.makeWhiteBackground) {
    console.log("[FACIAL] modulo nativo de recorte indisponivel, usando selfie original");
    return uri;
  }

  try {
    return await nativeModule.makeWhiteBackground(uri);
  } catch (error) {
    console.log("[FACIAL] recorte de fundo falhou, usando selfie original", error);
    return uri;
  }
}
