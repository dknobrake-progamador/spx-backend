import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  getCurrentUserPhone,
  getDriverDisplayName,
  KEY_PROFILE_FACE_URI,
} from "../lib/devStorage";
import { uriToDataUrl } from "../lib/photoCache";
import { TELA6_MENU_HTML } from "../lib/tela6MenuHtml";

const { width, height } = Dimensions.get("window");
const TELA6_HTML_WIDTH = 465;
const TELA6_HTML_HEIGHT = 967;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTela6Phone(phone: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits || String(phone || "").trim();
}

function buildProfileHtml(baseHtml: string, profile: Tela6Profile) {
  let html = baseHtml
    .replace(
      /<div class="profile-name">[\s\S]*?<\/div>/,
      `<div class="profile-name">${escapeHtml(profile.name || "DOUGLAS GABRIEL")}</div>`
    )
    .replace(
      /<div class="profile-phone">[\s\S]*?<\/div>/,
      `<div class="profile-phone">${escapeHtml(profile.phone || "21978818116")}</div>`
    );

  if (profile.faceDataUrl) {
    html = html.replace(
      /<div class="avatar">[\s\S]*?<\/div>\s*<div class="profile-text">/,
      `<div class="avatar"><img src="${profile.faceDataUrl}" style="width:58px;height:58px;object-fit:cover;border-radius:50%;" alt=""></div>
          <div class="profile-text">`
    );
  }

  return html;
}

type Tela6Profile = {
  name: string;
  phone: string;
  faceDataUrl: string;
};

function buildTela6DisplayHtml(scale: number, profile: Tela6Profile) {
  const displayHtmlHeight = Math.max(TELA6_HTML_HEIGHT, Math.ceil(height / scale));
  const profiledHtml = buildProfileHtml(TELA6_MENU_HTML, profile).replace(
    /height: 967px/g,
    `height: ${displayHtmlHeight}px`
  );
  const escapedHtml = JSON.stringify(profiledHtml);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #707070;
  }
  #stage {
    width: ${TELA6_HTML_WIDTH}px;
    height: ${displayHtmlHeight}px;
    transform: scale(${scale});
    transform-origin: top left;
    border: 0;
    overflow: hidden;
    background: #efefef;
  }
</style>
</head>
<body>
<iframe id="stage" title="Tela 6"></iframe>
<script>
  const doc = document.getElementById("stage").contentWindow.document;
  doc.open();
  doc.write(${escapedHtml});
  doc.close();
</script>
</body>
</html>`;
}

export default function Tela6() {
  const scale = Math.min(width / TELA6_HTML_WIDTH, height / TELA6_HTML_HEIGHT);
  const [profile, setProfile] = useState<Tela6Profile>({
    name: "DOUGLAS GABRIEL",
    phone: "21978818116",
    faceDataUrl: "",
  });
  const html = buildTela6DisplayHtml(scale, profile);

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      const [name, phone, faceUri] = await Promise.all([
        getDriverDisplayName(),
        getCurrentUserPhone(),
        AsyncStorage.getItem(KEY_PROFILE_FACE_URI),
      ]);
      const faceDataUrl = faceUri ? await uriToDataUrl(faceUri) : "";
      if (!alive) return;
      setProfile({
        name: name || "DOUGLAS GABRIEL",
        phone: formatTela6Phone(phone) || "21978818116",
        faceDataUrl: faceDataUrl || "",
      });
    }

    void loadProfile();

    return () => {
      alive = false;
    };
  }, []);

  const swipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) + 20 &&
        Math.abs(gestureState.vx) > 0.12,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= 50) {
          router.push("/tela3-imagem");
        }
      },
    })
  ).current;

  return (
    <View style={styles.screen} {...swipePanResponder.panHandlers}>
      <View pointerEvents="none" style={styles.rightGrayBar} />
      <View pointerEvents="none" style={styles.nativeButtonsWhiteArea} />
      <View style={styles.clipArea}>
        <WebView
          source={{ html }}
          style={styles.webview}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          androidLayerType="hardware"
        />
      </View>

      <View pointerEvents="box-none" style={styles.overlay}>
        <Pressable
          onPress={() => router.push("/tela2")}
          style={[
            styles.hitbox,
            {
              left: width * 0.84,
              top: 0,
              width: width * 0.18,
              height,
            },
          ]}
        />

        <Pressable
          onPress={() => router.push("/placa")}
          style={[
            styles.hitbox,
            {
              left: width * 0.49,
              top: 0,
              width: width * 0.34,
              height: height * 0.24,
            },
          ]}
        />

        <Pressable
          onPress={() => router.push("/tela11")}
          style={[
            styles.hitbox,
            {
              left: -(width * 0.12),
              top: 0,
              width: width * 0.55,
              height: height * 0.22,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#707070",
  },
  clipArea: {
    width,
    height,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  webview: {
    flex: 1,
    backgroundColor: "#707070",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  rightGrayBar: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: width * 0.18,
    backgroundColor: "#707070",
  },
  nativeButtonsWhiteArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: Math.max(24, height * 0.03),
    backgroundColor: "#ffffff",
    zIndex: 10,
    elevation: 10,
  },
  hitbox: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});
