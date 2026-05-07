import React from "react";
import {
  View,
  ImageBackground,
  Pressable,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";

export default function Tela1() {
  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={require("../assets/images/tela1.jpeg")}
        style={styles.bg}
        resizeMode="cover"
      >
        {/* Botão invisível -> Tela 10 */}
        <Pressable onPress={() => router.push("/tela10")} style={styles.botao} />
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },

  // Ajuste a área do botão conforme a posição no print da Tela 1
  botao: {
    position: "absolute",
    left: "10%",
    top: "70%",
    width: "80%",
    height: "18%",
    backgroundColor: "transparent",
  },
});