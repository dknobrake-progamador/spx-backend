import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import {
  getPlacaUri,
  KEY_PROFILE_FACE_URI,
  syncSinglePhotoToCloud,
} from "../lib/devStorage";
import { persistImage } from "../lib/photoCache";
import { makeSelfieDocumentWhiteBackground } from "../lib/selfieBackground";

const FACE_CAPTURE_KEY = "@DEV_FACE_CAPTURE_URI";
const FACE_DOCUMENT_CAPTURE_KEY = "@DEV_FACE_DOCUMENT_CAPTURE_URI";
const HIGH_QUALITY_COMPOSITION_SIZE = 1024;

export default function FacialVerification() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [documentFaceUri, setDocumentFaceUri] = useState<string | null>(null);
  const [composedUri, setComposedUri] = useState<string | null>(null);
  const [pendingCompositeSave, setPendingCompositeSave] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const finalCompositionRef = useRef<View>(null);
  const highQualityCompositionRef = useRef<View>(null);

  useEffect(() => {
    if (!capturedUri || !documentFaceUri || !pendingCompositeSave) return;

    let cancelled = false;

    async function persistFinalComposition() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (cancelled || !highQualityCompositionRef.current) return;

        const finalUri = await captureRef(highQualityCompositionRef, {
          format: "png",
          quality: 1,
          result: "tmpfile",
        });

        if (cancelled || !finalUri) return;

        await persistImage(KEY_PROFILE_FACE_URI, finalUri, "profile-face-final");
        const persistedFinalUri = await AsyncStorage.getItem(KEY_PROFILE_FACE_URI);
        const definitiveUri = persistedFinalUri || finalUri;

        await AsyncStorage.setItem(FACE_CAPTURE_KEY, definitiveUri);
        await AsyncStorage.setItem(FACE_DOCUMENT_CAPTURE_KEY, definitiveUri);
        setComposedUri(definitiveUri);

        syncSinglePhotoToCloud("profileFace", definitiveUri).catch((error) => {
          console.log("[FACIAL] falha ao enviar foto composta para nuvem", error);
        });
      } catch (error) {
        console.log("[FACIAL] falha ao salvar composicao final", error);
      } finally {
        if (!cancelled) {
          setPendingCompositeSave(false);
        }
      }
    }

    void persistFinalComposition();

    return () => {
      cancelled = true;
    };
  }, [capturedUri, documentFaceUri, pendingCompositeSave]);

  async function captureFace() {
    if (!cameraRef.current || capturing) return;

    try {
      setCapturing(true);
      const picture = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
        shutterSound: false,
      });

      if (picture?.uri) {
        const documentUri = await makeSelfieDocumentWhiteBackground(picture.uri);
        setCapturedUri(picture.uri);
        setDocumentFaceUri(documentUri);
        setComposedUri(null);
        setPendingCompositeSave(true);
      }
    } catch (error) {
      console.log("[FACIAL] falha ao capturar foto", error);
    } finally {
      setCapturing(false);
    }
  }

  async function continueToApp() {
    const placaUri = await getPlacaUri();
    router.replace(placaUri ? "/tela2" : "/placas-carros?cadastro=1");
  }

  function renderComposition(captureMode: "screen" | "high") {
    const high = captureMode === "high";
    const ringStyle = high ? styles.highQualityRing : styles.ring;
    const cameraStyle = high ? styles.highQualityCamera : styles.camera;
    const faceShadeStyle = high ? styles.highQualityFaceShade : styles.faceShade;
    const faceCutoutStyle = high ? styles.highQualityFaceCutout : styles.faceCutout;
    const documentGuideStyle = high ? styles.highQualityDocumentGuide : styles.documentGuide;
    const documentPhotoSlotStyle = high ? styles.highQualityDocumentPhotoSlot : styles.documentPhotoSlot;
    const documentFaceStyle = high ? styles.highQualityDocumentFace : styles.documentFace;

    return (
      <>
        <View style={[ringStyle, capturedUri ? styles.ringCaptured : null]}>
          {capturedUri ? (
            <Image source={{ uri: capturedUri }} style={cameraStyle} resizeMode="cover" />
          ) : (
            <CameraView
              ref={high ? undefined : cameraRef}
              style={cameraStyle}
              facing="front"
              mirror
              mode="picture"
              onCameraReady={high ? undefined : () => setCameraReady(true)}
            />
          )}

          <View style={documentGuideStyle}>
            <Image
              source={require("../assets/facial/cnh-facial.jpg")}
              style={styles.documentImage}
              resizeMode="cover"
            />
            <View style={documentPhotoSlotStyle}>
              {capturedUri ? (
                <Image
                  source={{ uri: documentFaceUri || capturedUri }}
                  style={documentFaceStyle}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.documentFacePlaceholder} />
              )}
            </View>
          </View>
        </View>

        <View pointerEvents="none" style={faceShadeStyle}>
          <View style={faceCutoutStyle} />
        </View>
      </>
    );
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <MaterialIcons name="photo-camera-front" size={52} color="#11d870" />
        <Text style={styles.permissionTitle}>Captura de rosto</Text>
        <Text style={styles.permissionText}>
          Libere a camera para tirar a foto do rosto antes de abrir o aplicativo.
        </Text>
        <Pressable
          style={styles.permissionButton}
          onPress={() => requestPermission().catch(() => undefined)}
        >
          <Text style={styles.permissionButtonText}>Liberar camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.replace("/tela10")} hitSlop={12}>
          <MaterialIcons name="arrow-back-ios-new" size={22} color="#76808e" />
        </Pressable>
        <Text style={styles.topbarTitle}>Verificacao facial</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.frameArea}>
          <View ref={finalCompositionRef} collapsable={false} style={styles.compositionCapture}>
            {renderComposition("screen")}
          </View>
        </View>

        {capturedUri && documentFaceUri ? (
          <View
            ref={highQualityCompositionRef}
            collapsable={false}
            pointerEvents="none"
            style={styles.highQualityCompositionCapture}
          >
            {renderComposition("high")}
          </View>
        ) : null}

        <View style={[styles.status, capturedUri ? styles.statusOk : null]}>
          <MaterialIcons
            name={capturedUri ? "check-circle" : "error"}
            size={21}
            color={capturedUri ? "#11d870" : "#ff3048"}
          />
          <Text style={[styles.statusText, capturedUri ? styles.statusTextOk : null]}>
            {composedUri ? "Foto composta salva" : capturedUri ? "Preparando foto composta" : "Posicione o rosto no circulo"}
          </Text>
        </View>

        <Text style={styles.subtext}>
          A foto e apenas uma captura visual do rosto para abrir o fluxo do app.
        </Text>

        <View style={styles.actions}>
          {capturedUri ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setCapturedUri(null);
                setDocumentFaceUri(null);
                setComposedUri(null);
                setPendingCompositeSave(false);
                setCameraReady(false);
              }}
            >
              <Text style={styles.secondaryButtonText}>Refazer</Text>
            </Pressable>
          ) : null}

          <Pressable
            disabled={capturing || pendingCompositeSave || (!cameraReady && !capturedUri)}
            style={[
              styles.primaryButton,
              capturing || pendingCompositeSave || (!cameraReady && !capturedUri) ? styles.primaryButtonDisabled : null,
            ]}
            onPress={capturedUri ? continueToApp : captureFace}
          >
            {capturing || pendingCompositeSave ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {capturedUri ? "Continuar" : "Tirar foto"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  topbar: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2f6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  topbarTitle: {
    color: "#515966",
    fontSize: 15,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: 28,
    paddingHorizontal: 20,
  },
  frameArea: {
    width: 252,
    height: 252,
    position: "relative",
  },
  compositionCapture: {
    position: "absolute",
    inset: 0,
    backgroundColor: "transparent",
  },
  highQualityCompositionCapture: {
    position: "absolute",
    left: -10000,
    top: 0,
    width: HIGH_QUALITY_COMPOSITION_SIZE,
    height: HIGH_QUALITY_COMPOSITION_SIZE,
    backgroundColor: "transparent",
  },
  ring: {
    position: "absolute",
    inset: 0,
    borderRadius: 126,
    borderWidth: 5,
    borderColor: "#11d870",
    overflow: "hidden",
    backgroundColor: "#b8b8b8",
  },
  ringCaptured: {
    borderColor: "transparent",
  },
  camera: {
    width: "100%",
    height: "100%",
  },
  highQualityRing: {
    position: "absolute",
    inset: 0,
    borderRadius: HIGH_QUALITY_COMPOSITION_SIZE / 2,
    borderWidth: 20,
    borderColor: "#11d870",
    overflow: "hidden",
    backgroundColor: "#b8b8b8",
  },
  highQualityCamera: {
    width: "100%",
    height: "100%",
  },
  faceShade: {
    position: "absolute",
    inset: 5,
    borderRadius: 124,
    borderWidth: 18,
    borderColor: "rgba(255,255,255,0.18)",
  },
  faceCutout: {
    flex: 1,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  highQualityFaceShade: {
    position: "absolute",
    inset: 20,
    borderRadius: HIGH_QUALITY_COMPOSITION_SIZE / 2 - 4,
    borderWidth: 73,
    borderColor: "rgba(255,255,255,0.18)",
  },
  highQualityFaceCutout: {
    flex: 1,
    borderRadius: HIGH_QUALITY_COMPOSITION_SIZE / 2,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.18)",
  },
  documentGuide: {
    position: "absolute",
    left: "23%",
    bottom: "0%",
    width: "27%",
    height: "17%",
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(196,225,214,0.92)",
    borderWidth: 1,
    borderColor: "rgba(42,105,91,0.45)",
    transform: [{ rotate: "-1deg" }],
  },
  highQualityDocumentGuide: {
    position: "absolute",
    left: "23%",
    bottom: "0%",
    width: "27%",
    height: "17%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(196,225,214,0.92)",
    borderWidth: 4,
    borderColor: "rgba(42,105,91,0.45)",
    transform: [{ rotate: "-1deg" }],
  },
  documentImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
  documentPhotoSlot: {
    position: "absolute",
    left: "14%",
    top: "39%",
    width: "28%",
    height: "44%",
    overflow: "hidden",
    borderRadius: 1,
    backgroundColor: "#ffffff",
  },
  highQualityDocumentPhotoSlot: {
    position: "absolute",
    left: "14%",
    top: "39%",
    width: "28%",
    height: "44%",
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  documentFace: {
    width: "112%",
    height: "124%",
    marginLeft: "-6%",
    marginTop: "-10%",
  },
  highQualityDocumentFace: {
    width: "112%",
    height: "124%",
    marginLeft: "-6%",
    marginTop: "-10%",
  },
  documentFacePlaceholder: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  status: {
    marginTop: 20,
    maxWidth: 270,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  statusOk: {},
  statusText: {
    color: "#ff3048",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  statusTextOk: {
    color: "#11d870",
  },
  subtext: {
    marginTop: 10,
    maxWidth: 270,
    color: "#929aa5",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  actions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    minWidth: 124,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#1c222d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryButton: {
    minWidth: 96,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#eff2f6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#5e6672",
    fontSize: 13,
    fontWeight: "800",
  },
  permissionScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 28,
  },
  permissionTitle: {
    marginTop: 14,
    color: "#1c222d",
    fontSize: 22,
    fontWeight: "800",
  },
  permissionText: {
    marginTop: 10,
    color: "#737b87",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: 22,
    borderRadius: 999,
    backgroundColor: "#1c222d",
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
});
