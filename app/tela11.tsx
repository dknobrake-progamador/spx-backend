import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import {
  getCurrentAdminAccess,
  getCurrentUserPhone,
  getDriverDisplayName,
  getDriverVehicleType,
  getOrCreateDriverCnhNumber,
  getProfileFaceUri,
} from "../lib/devStorage";
import { uriToDataUrl } from "../lib/photoCache";
import { TELA11_DEFAULT_AVATAR, TELA11_PERFIL_HTML } from "../lib/tela11PerfilHtml";

const TOP_WHITE_BAR_HEIGHT = 28;

type PerfilTela11 = {
  faceDataUrl: string | null;
  name: string;
  phone: string;
  cnh: string;
  vehicleType: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D+/g, "");
  if (digits.startsWith("55") && digits.length > 11) {
    return digits.slice(2);
  }
  return digits;
}

function buildTela11Html(profile: PerfilTela11) {
  const avatar = profile.faceDataUrl
    ? `<img src="${profile.faceDataUrl}" alt="Foto do motorista">`
    : TELA11_DEFAULT_AVATAR;

  return TELA11_PERFIL_HTML.replace("__PROFILE_AVATAR__", avatar)
    .replace("__PROFILE_NAME__", escapeHtml(profile.name))
    .replace("__PROFILE_PHONE__", escapeHtml(formatPhone(profile.phone)))
    .replace("__PROFILE_CNH__", escapeHtml(profile.cnh))
    .replace("__PROFILE_VEHICLE_TYPE__", escapeHtml(profile.vehicleType));
}

export default function Tela11() {
  const [profile, setProfile] = useState<PerfilTela11>({
    faceDataUrl: null,
    name: "",
    phone: "",
    cnh: "",
    vehicleType: "",
  });

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      const [savedName, savedPhone, savedVehicleType, savedCnh, faceUri] = await Promise.all([
        getDriverDisplayName(),
        getCurrentUserPhone(),
        getDriverVehicleType(),
        getOrCreateDriverCnhNumber(),
        getProfileFaceUri(),
      ]);

      let faceDataUrl: string | null = null;
      if (faceUri) {
        try {
          faceDataUrl = await uriToDataUrl(faceUri);
        } catch (error) {
          console.log("[TELA11] falha ao converter foto do perfil:", error);
        }
      }

      if (!alive) return;
      setProfile({
        faceDataUrl,
        name: savedName || "",
        phone: savedPhone || "",
        cnh: savedCnh || "",
        vehicleType: savedVehicleType || "",
      });
    }

    void loadProfile();

    return () => {
      alive = false;
    };
  }, []);

  const html = useMemo(() => buildTela11Html(profile), [profile]);

  async function abrirPainelAdmin() {
    if ((await getCurrentAdminAccess()) !== "master") return;
    router.push("/painel-admin");
  }

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.topWhiteBar} />
      <WebView
        key={`${profile.name}-${profile.phone}-${profile.faceDataUrl ? "face" : "avatar"}`}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.webView}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      />

      <Pressable
        onPress={() => router.push("/tela6")}
        style={styles.backHitbox}
        hitSlop={12}
        pressRetentionOffset={20}
      />

      <Pressable
        onLongPress={abrirPainelAdmin}
        delayLongPress={2500}
        style={styles.adminHitbox}
        hitSlop={20}
        pressRetentionOffset={24}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  webView: {
    flex: 1,
    backgroundColor: "#f2f2f7",
    marginTop: TOP_WHITE_BAR_HEIGHT,
  },
  topWhiteBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: TOP_WHITE_BAR_HEIGHT,
    backgroundColor: "#ffffff",
    zIndex: 2,
  },
  backHitbox: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 72,
    height: TOP_WHITE_BAR_HEIGHT + 64,
    backgroundColor: "transparent",
  },
  adminHitbox: {
    position: "absolute",
    top: 360,
    left: 0,
    width: 170,
    height: 70,
    backgroundColor: "transparent",
  },
});
