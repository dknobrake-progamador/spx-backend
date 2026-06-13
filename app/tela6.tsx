import { router } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import React, { useEffect, useRef } from "react";
import {
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { TELA6_MENU_HTML } from "../lib/tela6MenuHtml";

const { width, height } = Dimensions.get("window");
const TELA6_HTML_WIDTH = 465;
const TELA6_HTML_HEIGHT = 967;

function buildTela6DisplayHtml(scale: number) {
  const escapedHtml = JSON.stringify(TELA6_MENU_HTML);

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
    height: ${TELA6_HTML_HEIGHT}px;
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
  const html = buildTela6DisplayHtml(scale);

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync("#ffffff").catch(() => undefined);
    NavigationBar.setButtonStyleAsync("dark").catch(() => undefined);
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
      <View pointerEvents="none" style={styles.bottomNativeBar} />
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
  bottomNativeBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: Math.max(46, height * 0.045),
    backgroundColor: "#ffffff",
  },
  hitbox: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});
