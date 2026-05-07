import React from "react";
import {
  View,
  ImageBackground,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import { router } from "expo-router";

const { width, height } = Dimensions.get("window");

export default function Tela5() {
  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={require("../assets/images/tela5.jpeg")}
        style={styles.bg}
        resizeMode="cover"
      >
        {/* 🟢 VERDE (Topo Esquerdo Grande) -> Tela 2 */}
        <Pressable
          onPress={() => router.push("/tela2")}
          style={[
            styles.hitbox,
            {
              left: width * 0.02,
              top: height * 0.02,
              width: width * 0.45,
              height: height * 0.20,
            },
          ]}
        />

        {/* 🔴 VERMELHO (Topo Direito Grande) -> Tela 9 */}
        <Pressable
          onPress={() => router.push("/tela9")}
          style={[
            styles.hitbox,
            {
              right: width * 0.02,
              top: height * 0.02,
              width: width * 0.45,
              height: height * 0.20,
            },
          ]}
        />

        {/* 🟡 AMARELO (Ícone pequeno topo esquerdo) -> Tela 6 */}
        <Pressable
          onPress={() => router.push("/tela6")}
          style={[
            styles.hitbox,
            {
              left: width * 0.05,
              top: height * 0.02,
              width: width * 0.20,
              height: height * 0.12,
            },
          ]}
        />

        {/* 🔵 AZUL (Círculo central grande) -> Tela 3 */}
        <Pressable
          onPress={() => router.push("/tela3")}
          style={[
            styles.hitbox,
            {
              left: width * 0.15,
              top: height * 0.30,
              width: width * 0.70,
              height: height * 0.50,
            },
          ]}
        />
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  hitbox: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});