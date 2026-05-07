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

export default function Tela12() {
  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={require("../assets/images/tela12.jpeg")}
        style={styles.bg}
        resizeMode="cover"
      >
        {/* 🟤 BOTÃO MARROM (Topo esquerdo) -> Tela 2 */}
        <Pressable
          onPress={() => router.push("/tela2")}
          style={[
            styles.hitbox,
            {
              left: 0,
              top: 0,
              width: width * 0.45,
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
  hitbox: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});