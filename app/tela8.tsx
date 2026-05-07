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
  const scanY = useRef(new Animated.Value(0)).current;
  const beepSoundRef = useRef<Audio.Sound | null>(null);

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
    if (scanned) {
      return;
    }

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

    const parsedScan = extractOccurrenceFromText(data);

    if (!parsedScan.codigo) {
      setScanned(false);
      return;
    }

    await setScannedBrCode(parsedScan.codigo);
    await setScannedOccurrence({
      codigo: parsedScan.codigo,
      endereco: parsedScan.endereco,
      pessoa: parsedScan.pessoa,
      raw: data,
      scanType: type,
    });

    Alert.alert(
      parsedScan.codigo,
      "Nao foi possivel adicionar esse pacote",
      [{ text: "OK", onPress: () => setScanned(false) }]
    );
  }

  function alternarLanterna() {
    setTorchEnabled((current) => !current);
  }

  async function abrirPainelOperacional() {
    const access = await getCurrentAdminAccess();
    if (access === "master" || access === "admin2") {
      router.push("/painel-admin");
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
        onLongPress={alternarLanterna}
        delayLongPress={4000}
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
    fontSize: 18, // ✅ parecido com o print
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

});
