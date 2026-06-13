import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Audio } from "expo-av";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { extractOccurrenceFromText } from "../lib/occurrenceParser";
import { getCurrentAdminAccess, setScannedBrCode, setScannedOccurrence } from "../lib/devStorage";

const { width, height } = Dimensions.get("window");

export default function Tela8() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [permissionLoadingTimedOut, setPermissionLoadingTimedOut] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showSecondReadModal, setShowSecondReadModal] = useState(false);
  const scanY = useRef(new Animated.Value(0)).current;
  const beepSoundRef = useRef<Audio.Sound | null>(null);
  const scanLockRef = useRef(false);
  const requestedPermissionRef = useRef(false);

  console.log("[TELA8] render - permission:", permission?.granted, "cameraReady:", cameraReady);

  useEffect(() => {
    console.log("[TELA8] permission mudou:", JSON.stringify(permission));
    if (permission == null) {
      if (!requestedPermissionRef.current) {
        requestedPermissionRef.current = true;
        requestPermission().catch(() => undefined);
      }
      return;
    }

    setPermissionLoadingTimedOut(false);

    if (!permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => undefined);
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (cameraReady) {
      return;
    }

    const timer = setTimeout(() => {
      setCameraReady(true);
    }, 6000);

    return () => {
      clearTimeout(timer);
    };
  }, [cameraReady]);

  useEffect(() => {
    if (!cameraReady) {
      return;
    }

    scanY.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: height * 0.55,
          duration: 4800,
          useNativeDriver: true,
        }),
        Animated.timing(scanY, {
          toValue: 0,
          duration: 1,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [cameraReady, scanY]);

  useEffect(() => {
    let mounted = true;

    async function loadBeep() {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/sounds/scan-beep.wav")
      );

      if (!mounted) {
        await sound.unloadAsync();
        return;
      }

      beepSoundRef.current = sound;
    }

    loadBeep().catch(() => undefined);

    return () => {
      mounted = false;
      const currentSound = beepSoundRef.current;
      beepSoundRef.current = null;
      currentSound?.unloadAsync().catch(() => undefined);
    };
  }, []);

  if (permission == null) {
    return (
      <View style={styles.screen}>
          <CameraView
          style={styles.camera}
          enableTorch={torchEnabled}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onCameraReady={() => {
            console.log("[TELA8] onCameraReady disparou");
            setCameraReady(true);
          }}
          onBarcodeScanned={handleBarcodeScanned}
        />

        {!cameraReady ? (
          <View style={styles.cameraLoadingOverlay}>
            {permissionLoadingTimedOut ? (
              <>
                <MaterialCommunityIcons name="camera-off-outline" size={44} color="#ff5a36" />
                <Text style={styles.cameraLoadingTitle}>Camera demorando para abrir</Text>
                <Text style={styles.cameraLoadingText}>
                  Toque abaixo para tentar liberar a camera e continuar.
                </Text>
                <Pressable
                  style={styles.permissionButton}
                  onPress={() => {
                    requestedPermissionRef.current = true;
                    requestPermission().catch(() => undefined);
                  }}
                >
                  <Text style={styles.permissionButtonText}>Tentar novamente</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color="#ff5a36" />
                <Text style={styles.cameraLoadingTitle}>Abrindo camera...</Text>
                <Text style={styles.cameraLoadingText}>Estamos preparando o scanner.</Text>
              </>
            )}
          </View>
        ) : (
          <>
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]}>
              <View style={styles.scanLineBase} />
              <View style={styles.scanLineCore} />
            </Animated.View>

            <Pressable onPress={() => router.push("/tela2")} style={styles.backArea}>
              <MaterialIcons name="arrow-back" size={26} color="#fff" />
            </Pressable>

            <Text style={styles.title}>Escanear</Text>

            <Pressable style={styles.editArea} onLongPress={abrirPainelOperacional} delayLongPress={2500}>
              <MaterialIcons name="edit" size={26} color="#fff" />
            </Pressable>

            <Pressable onPress={alternarLanterna} style={styles.flashArea}>
              <MaterialIcons
                name="flashlight-on"
                size={28}
                color="#fff"
                style={{ opacity: torchEnabled ? 1 : 0.72 }}
              />
              <Text style={styles.flashText}>
                {torchEnabled ? "Desligar lanterna" : "Ligar lanterna"}
              </Text>
            </Pressable>

            <View style={styles.bottomTextArea}>
              <Text
                numberOfLines={1}
                style={styles.bigText}
              >
                Procurando pelo código...
              </Text>
              <Text style={styles.smallText}>
                Apontar para o código de barras para escanear e atualizar o status do pedido
              </Text>
            </View>
          </>
        )}
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.loadingScreen}>
        <MaterialCommunityIcons name="camera-off-outline" size={44} color="#ff5a36" />
        <Text style={styles.loadingTitle}>Permissao da camera necessaria</Text>
        <Text style={styles.loadingText}>
          Toque abaixo para liberar a camera e continuar o escaneamento.
        </Text>
        <Pressable
          style={styles.permissionButton}
          onPress={() => {
            requestPermission().catch(() => undefined);
          }}
        >
          <Text style={styles.permissionButtonText}>Liberar camera</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/tela2")} style={styles.permissionBackButton}>
          <Text style={styles.permissionBackButtonText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  async function handleBarcodeScanned({ data, type }: { data: string; type: string }) {
    const normalizedData = String(data || "").trim();
    if (scanLockRef.current || !normalizedData) {
      return;
    }
    scanLockRef.current = true;

    try {
      setScanned(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      const sound = beepSoundRef.current;
      if (sound) {
        try {
          await sound.setPositionAsync(0);
          await sound.playAsync();
        } catch {
          // Ignore audio failures and keep the scan flow working.
        }
      }

      const parsedScan = extractOccurrenceFromText(normalizedData);

      if (!parsedScan.codigo) {
        return;
      }

      await setScannedBrCode(parsedScan.codigo);
      await setScannedOccurrence({
        codigo: parsedScan.codigo,
        endereco: parsedScan.endereco,
        pessoa: parsedScan.pessoa,
        raw: normalizedData,
        scanType: type,
      });
    } finally {
      setScanned(false);
      setTimeout(() => {
        scanLockRef.current = false;
      }, 250);
    }
  }

  function alternarLanterna() {
    setTorchEnabled((current) => !current);
  }

  async function abrirPainelOperacional() {
    const access = await getCurrentAdminAccess();
    if (access === "master") {
      router.push("/painel-admin");
      return;
    }
    if (access === "admin2") {
      router.push("/painel-adm");
    }
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={styles.camera}
        enableTorch={torchEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onCameraReady={() => {
          console.log("[TELA8] onCameraReady disparou");
          setCameraReady(true);
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {!cameraReady ? (
        <View style={styles.cameraLoadingOverlay}>
          <ActivityIndicator size="large" color="#ff5a36" />
          <Text style={styles.cameraLoadingTitle}>Abrindo camera...</Text>
          <Text style={styles.cameraLoadingText}>
            Em alguns aparelhos isso pode levar alguns segundos.
          </Text>
        </View>
      ) : null}

      {/* Linha vermelha animada */}
      <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]}>
        <View style={styles.scanLineBase} />
        <View style={styles.scanLineCore} />
      </Animated.View>

      {/* Top bar */}
      <Pressable onPress={() => router.push("/tela2")} style={styles.backArea}>
        <MaterialIcons name="arrow-back" size={26} color="#fff" />
      </Pressable>

      <Text style={styles.title}>Escanear</Text>

      {/* ✏️ Lápis no canto superior direito (SEM espelhar) */}
      <Pressable style={styles.editArea} onLongPress={abrirPainelOperacional} delayLongPress={2500}>
        <MaterialIcons name="edit" size={26} color="#fff" />
      </Pressable>

      {/* Centro: lanterna */}
      <Pressable
        onPress={alternarLanterna}
        style={styles.flashArea}
      >
        <MaterialIcons
          name="flashlight-on"
          size={28}
          color="#fff"
          style={{ opacity: torchEnabled ? 1 : 0.72 }}
        />
        <Text style={styles.flashText}>
          {torchEnabled ? "Desligar lanterna" : "Ligar lanterna"}
        </Text>
      </Pressable>

      {/* Textos de baixo */}
      <View style={styles.bottomTextArea}>
        <Text
          numberOfLines={1}
          style={styles.bigText}
        >
          Procurando pelo código...
        </Text>
        <Text style={styles.smallText}>
          Apontar para o código de barras para escanear e atualizar o status do pedido
        </Text>
      </View>

      {showSecondReadModal ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nao reconhecido</Text>
            <Text style={styles.modalMessage}>Esta tarefa foi atribuida para outro motorista</Text>
            <View style={styles.modalDivider} />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalButton}
                onPress={() => {
                  setShowSecondReadModal(false);
                  setScanned(false);
                  scanLockRef.current = false;
                }}
              >
                <MaterialIcons name="close" size={24} color="#9aa3ad" />
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <View style={styles.modalVerticalDivider} />
              <Pressable
                style={styles.modalButton}
                onPress={() => {
                  setShowSecondReadModal(false);
                  setScanned(false);
                  scanLockRef.current = false;
                }}
              >
                <MaterialIcons name="refresh" size={22} color="#d96a3a" />
                <Text style={styles.modalRepeatText}>Repetir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050608",
  },

  camera: {
    flex: 1,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#050608",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  loadingTitle: {
    marginTop: 16,
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
  },

  loadingText: {
    marginTop: 10,
    color: "#c8ccd3",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  permissionButton: {
    marginTop: 20,
    minWidth: 190,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#ff5a36",
  },

  permissionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },

  permissionBackButton: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  permissionBackButtonText: {
    color: "#d8dce3",
    fontSize: 15,
    fontWeight: "500",
  },

  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,6,8,0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  cameraLoadingTitle: {
    marginTop: 16,
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "600",
    textAlign: "center",
  },

  cameraLoadingText: {
    marginTop: 10,
    color: "#c8ccd3",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  scanLine: {
    position: "absolute",
    top: height * 0.25,
    left: width * 0.08,
    width: width * 0.84,
    height: 2,
  },

  scanLineBase: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#ff4b4b",
    opacity: 0.18,
  },

  scanLineCore: {
    position: "absolute",
    left: "12%",
    right: "12%",
    height: 1,
    backgroundColor: "#ff5a5a",
    opacity: 0.56,
  },

  backArea: {
    position: "absolute",
    top: 48,
    left: 16,
    padding: 6,
  },

  title: {
    position: "absolute",
    top: 50,
    left: 64,
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },

  editArea: {
    position: "absolute",
    top: 46,
    right: 16, // ✅ garante canto direito
    padding: 6,
  },

  flashArea: {
    position: "absolute",
    top: height * 0.55,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 6,
    opacity: 0.95,
    zIndex: 25,
    elevation: 25,
  },

  flashText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "300",
  },

  bottomTextArea: {
    position: "absolute",
    bottom: 70,
    left: 20,
    right: 20,
    alignItems: "center",
  },

  bigText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "500",
    marginBottom: 10,
    textAlign: "center",
    flexShrink: 1,
    letterSpacing: 0,
  },

  smallText: {
    color: "#cfcfcf",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },

  modalTitle: {
    fontSize: 22,
    color: "#121212",
    fontWeight: "500",
    marginBottom: 10,
  },

  modalMessage: {
    fontSize: 18,
    color: "#8d98a4",
    lineHeight: 24,
    marginBottom: 16,
  },

  modalDivider: {
    height: 1,
    backgroundColor: "#e6e8ec",
  },

  modalActions: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },

  modalVerticalDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#eceef2",
  },

  modalCancelText: {
    color: "#9aa3ad",
    fontSize: 18,
    fontWeight: "400",
  },

  modalRepeatText: {
    color: "#d96a3a",
    fontSize: 18,
    fontWeight: "500",
  },

});
