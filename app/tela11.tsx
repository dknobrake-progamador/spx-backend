import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Dimensions,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { getCurrentAdminAccess, getTela11Uri } from "../lib/devStorage";

const { width, height } = Dimensions.get("window");

export default function Tela11() {
  const [uri, setUri] = useState<string | null>(null);

  async function abrirPainelAdmin() {
    if ((await getCurrentAdminAccess()) !== "master") return;
    router.push("/painel-admin");
  }

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        const savedUri = await getTela11Uri();
        if (alive) setUri(savedUri);
      })();

      return () => {
        alive = false;
      };
    }, [])
  );

  if (!uri) {
    return <View style={{ flex: 1, backgroundColor: "#fff" }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground source={{ uri }} style={styles.bg} resizeMode="cover">
        <View pointerEvents="none" style={styles.topStripe} />
        <Pressable
          style={styles.topButton}
          onLongPress={abrirPainelAdmin}
          delayLongPress={2500}
          hitSlop={20}
          pressRetentionOffset={24}
        />

        <Pressable
          onPress={() => router.push("/tela6")}
          style={[
            styles.hitbox,
            {
              left: width * 0.02,
              top: height * 0.02,
              width: width * 0.45,
              height: height * 0.18,
            },
          ]}
        />
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  topStripe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 38,
    backgroundColor: "#ffffff",
  },
  topButton: {
    position: "absolute",
    top: 380,
    left: 10,
    minWidth: 160,
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  hitbox: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});
