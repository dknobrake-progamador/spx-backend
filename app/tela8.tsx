import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Audio } from "expo-av";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { extractOccurrenceFromText } from "../lib/occurrenceParser";
import { getCurrentAdminAccess, setScannedBrCode, setScannedOccurrence } from "../lib/devStorage";

const { width, height } = Dimensions.get("window");

export default function Tela8() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannerNativoDisponivel, setScannerNativoDisponivel] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showSecondReadModal, setShowSecondReadModal] = useState(false);
  const scanY = useRef(new Animated.Value(0)).current;
  const beepSoundRef = useRef<Audio.Sound | null>(null);
  const scanLockRef = useRef(false);
  const lastScanRef = useRef("");
  const successfulReadCountRef = useRef(0);

  useEffect(() => {
    if (!permission) return;

    if (!permission.granted) {
      requestPermission();
      return;
    }

    Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: height * 0.55,
          duration: 4500, // ✅ mais lento (ajuste aqui)
          useNativeDriver: true,
        }),
        Animated.timing(scanY, {
          toValue: 0,
          duration: 4500, // ✅ mais lento (ajuste aqui)
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [permission?.granted]);

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

  useFocusEffect(
    useCallback(() => {
      const subscription = CameraView.onModernBarcodeScanned((event) => {
        handleBarcodeScanned({
          data: event.data,
          type: event.type,
        }).catch(() => undefined);
      });

      setScannerNativoDisponivel(true);

      return () => {
        subscription.remove();
      };
    }, [scanned])
  );

  if (!permission) return <View />;
  if (!permission.granted) return <View style={{ flex: 1 }} />;

  async function handleBarcodeScanned({ data, type }: { data: string; type: string }) {
    const normalizedData = String(data || "").trim();
    if (scanned || scanLockRef.current || !normalizedData) {
      return;
    }
    if (successfulReadCountRef.current >= 1) {
      setShowSecondReadModal(true);
      return;
    }
    scanLockRef.current = true;
    if (lastScanRef.current === normalizedData) {
      setTimeout(() => {
        scanLockRef.current = false;
      }, 700);
      return;
    }
    lastScanRef.current = normalizedData;

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
      setScanned(false);
      setTimeout(() => {
        scanLockRef.current = false;
      }, 450);
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
    successfulReadCountRef.current += 1;

    Alert.alert(
      parsedScan.codigo,
      "Nao foi possivel adicionar esse pacote",
      [{
        text: "OK",
        onPress: () => {
          setScanned(false);
          setTimeout(() => {
            scanLockRef.current = false;
          }, 250);
        },
      }]
    );
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
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        enableTorch={torchEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Linha vermelha animada */}
      <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />

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
        <MaterialCommunityIcons name="flashlight" size={26} color="#fff" />
        <Text style={styles.flashText}>
          {torchEnabled ? "Desligar lanterna" : "Ligar lanterna"}
        </Text>
      </Pressable>

      {/* Textos de baixo */}
      <View style={styles.bottomTextArea}>
        <Text style={styles.bigText}>Procurando pelo código...</Text>
        <Text style={styles.smallText}>
          Aponte para um QR com BR, nome e endereco. Texto puro na camera nao e suportado aqui.
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
                  lastScanRef.current = "";
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
  scanLine: {
    position: "absolute",
    top: height * 0.25,
    left: width * 0.08,
    width: width * 0.84,
    height: 2,
    backgroundColor: "red",
    opacity: 0.85,
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
    fontSize: 22,
    fontWeight: "400",
    marginBottom: 10,
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
