import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { getTela6Uri } from "../lib/devStorage";

const { width, height } = Dimensions.get("window");

export default function Tela6() {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const savedUri = await getTela6Uri();
      setUri(savedUri);
    })();
  }, []);

  // ✅ Enquanto não tiver imagem DEV, fica branco
  if (!uri) {
    return <View style={{ flex: 1, backgroundColor: "#fff" }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={{ uri }}
        style={styles.bg}
        resizeMode="cover"
      >
        <View pointerEvents="none" style={styles.topStripe} />
        {/* 🟩 VERDE (faixa direita inteira) -> Tela 2 */}
        <Pressable
          onPress={() => router.push("/tela2")}
          style={[
            styles.hitbox,
            {
              left: width * 0.84,
              top: 0,
              width: width * 0.18,
              height: height,
            },
          ]}
        />

        {/* 🔵 AZUL (círculo topo direito) -> Placa */}
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

        {/* 🔴 VERMELHO (topo esquerdo) -> Tela 11 */}
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
  hitbox: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});
