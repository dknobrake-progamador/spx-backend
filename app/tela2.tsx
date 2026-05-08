import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { RefreshAnimado, useRefreshAnimado } from "../components/refresh animado";

const { width, height } = Dimensions.get("window");

export default function Tela2() {
  const refreshAnimado = useRefreshAnimado();

  function onRefresh() {
    refreshAnimado.iniciarAnimacao();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            colors={["transparent"]}
            progressBackgroundColor="transparent"
            tintColor="transparent"
            titleColor="transparent"
            progressViewOffset={0}
          />
        }
      >
        <ImageBackground
          source={require("../assets/images/tela2.jpeg")}
          style={styles.bg}
          resizeMode="cover"
        >
          {/* 🔵 AZUL -> Tela 6 */}
          <Pressable
            onPress={() => router.push("/tela6")}
            style={[
              styles.hitbox,
              {
                left: width * 0.02,
                top: height * 0.02,
                width: width * 0.30,
                height: height * 0.12,
              },
            ]}
          />

          {/* 🔴 VERMELHO -> Tela 6 */}
          <Pressable
            onPress={() => router.push("/tela6")}
            style={[
              styles.hitbox,
              {
                left: width * 0.02,
                top: height * 0.14,
                width: width * 0.35,
                height: height * 0.18,
              },
            ]}
          />

          {/* 🟡 AMARELO -> Tela 3 */}
          <Pressable
            onPress={() => router.push("/tela3")}
            style={[
              styles.hitbox,
              {
                left: width * 0.30,
                top: height * 0.08,
                width: width * 0.40,
                height: height * 0.20,
              },
            ]}
          />

          {/* 🟢 VERDE -> Tela 9 */}
          <Pressable
            onPress={() => router.push("/tela9")}
            style={[
              styles.hitbox,
              {
                right: width * 0.02,
                top: height * 0.02,
                width: width * 0.45,
                height: height * 0.28,
              },
            ]}
          />

          {/* 🟤 MARROM -> Tela 12 */}
          <Pressable
            onPress={() => router.push("/tela-mapa")}
            style={[
              styles.hitbox,
              {
                left: width * 0.15,
                top: height * 0.24,
                width: width * 0.70,
                height: height * 0.12,
              },
            ]}
          />

          {/* 🩷 ROSA -> Tela 8 */}
          <Pressable
            onPress={() => router.push("/tela8")}
            style={[
              styles.hitbox,
              {
                left: width * 0.15,
                top: height * 0.65,
                width: width * 0.70,
                height: height * 0.18,
              },
            ]}
          />
        </ImageBackground>
      </ScrollView>

      <RefreshAnimado
        visible={refreshAnimado.visible}
        fadeAnim={refreshAnimado.fadeAnim}
        spin={refreshAnimado.spin}
      />
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
