import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { buildTelaPedidoInfoHtml, getSelectedPedidoInfo } from "../lib/telaPedidoInfoHtml";

export default function PedidoInfo() {
  const [html, setHtml] = useState(() => buildTelaPedidoInfoHtml(null));

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadPedidoInfo() {
        const data = await getSelectedPedidoInfo();
        if (!active) {
          return;
        }
        setHtml(buildTelaPedidoInfoHtml(data));
      }

      void loadPedidoInfo();

      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.webview}
        scalesPageToFit={false}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        onMessage={(event) => {
          if (event.nativeEvent.data === "goBack") {
            router.back();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  webview: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
});
