import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { RefreshAnimado, useRefreshAnimado } from "../components/refresh animado";
import { getTela2Variant, getTela3PrimaryScreen } from "../lib/devStorage";
import { getTela2EmRotaTotal } from "../lib/tela2EmRotaMeta";
import { TELA9_HTML } from "../lib/tela9WebViewHtml";

export default function Tela9() {
  const refreshAnimado = useRefreshAnimado();
  const webViewRef = useRef<WebView>(null);
  const [emRotaLabelCount, setEmRotaLabelCount] = useState(0);
  const swipePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) + 12 &&
      Math.abs(gestureState.dx) > 24,
    onPanResponderRelease: async (_, gestureState) => {
      if (gestureState.dx >= 35) {
        const telaPrincipal = await getTela3PrimaryScreen();
        router.push(telaPrincipal === "tela30" ? "/tela3-imagem" : "/tela3");
      }
    },
  });

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadTelaState() {
        const variant = await getTela2Variant();
        const emRotaTotal = await getTela2EmRotaTotal();
        if (mounted) {
          setEmRotaLabelCount(variant === "em-rota" ? emRotaTotal : 0);
        }
      }

      loadTelaState();

      return () => {
        mounted = false;
      };
    }, [])
  );

  const labelInjectionScript = useMemo(
    () => `
      (function() {
        var el = document.getElementById("em-rota-label");
        if (el) {
          el.textContent = "Em Rota (${emRotaLabelCount})";
        }
      })();
      true;
    `,
    [emRotaLabelCount]
  );

  useEffect(() => {
    webViewRef.current?.injectJavaScript(labelInjectionScript);
  }, [labelInjectionScript]);

  return (
    <View style={styles.container} {...swipePanResponder.panHandlers}>
      <WebView
        ref={webViewRef}
        source={{ html: TELA9_HTML }}
        style={styles.webview}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        startInLoadingState={false}
        pullToRefreshEnabled
        onLoadEnd={() => {
          webViewRef.current?.injectJavaScript(labelInjectionScript);
        }}
      />

      <Pressable
        onPress={() => router.push("/tela6")}
        style={styles.areaVerde}
      />

      <Pressable
        onPress={() => router.push("/tela2")}
        style={styles.areaVermelha}
      />

      <Pressable
        onPress={() => router.push("/tela3")}
        style={styles.areaAzul}
      />

      <RefreshAnimado
        visible={refreshAnimado.visible}
        fadeAnim={refreshAnimado.fadeAnim}
        spin={refreshAnimado.spin}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef0f5",
  },

  webview: {
    flex: 1,
    backgroundColor: "#eef0f5",
  },

  areaVerde: {
    position: "absolute",
    top: 35,
    left: 10,
    width: 120,
    height: 110,
    backgroundColor: "transparent",
  },

  areaVermelha: {
    position: "absolute",
    top: 90,
    left: 10,
    width: 180,
    height: 110,
    backgroundColor: "transparent",
  },

  areaAzul: {
    position: "absolute",
    top: 90,
    left: 160,
    width: 200,
    height: 110,
    backgroundColor: "transparent",
  },
});
