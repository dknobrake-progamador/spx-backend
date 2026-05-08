import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Dimensions, Image, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { RefreshAnimado, useRefreshAnimado } from "../components/refresh animado";
import {
  getTela3PrimaryScreen,
  setTela3PrimaryScreen,
  type Tela3PrimaryScreen,
} from "../lib/devStorage";

const { width, height } = Dimensions.get("window");

export default function Tela3Imagem() {
  const [telaPrincipal, setTelaPrincipal] = useState<Tela3PrimaryScreen | null>(null);
  const refreshAnimado = useRefreshAnimado();

  function onRefresh() {
    refreshAnimado.iniciarAnimacao();
  }

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregarTelaPrincipal() {
        const principal = await getTela3PrimaryScreen();
        if (ativo) {
          setTelaPrincipal(principal);
        }
      }

      carregarTelaPrincipal();

      return () => {
        ativo = false;
      };
    }, [])
  );

  async function ativarTela3() {
    await setTela3PrimaryScreen("tela3");
    router.replace("/tela3");
  }

  async function abrirTela3ComQuantidade() {
    await setTela3PrimaryScreen("tela3");
    router.replace("/tela3?editCount=1");
  }

  if (!telaPrincipal) {
    return <SafeAreaView style={styles.container} />;
  }

  if (telaPrincipal === "tela3") {
    return <Redirect href="/tela3" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#222" />
          </Pressable>
        </View>

        <View style={styles.imageWrapper}>
          <Image
            source={require("../assets/images/tela30.png")}
            style={styles.image}
            resizeMode="cover"
          />

          <Pressable
            onPress={() => router.push("/tela6")}
            style={[
              styles.hitbox,
              {
                left: width * 0.02,
                top: height * 0.02,
                width: width * 0.3,
                height: height * 0.12,
              },
            ]}
          />

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

          <Pressable
            onPress={() => router.push("/tela3")}
            style={[
              styles.hitbox,
              {
                left: width * 0.3,
                top: height * 0.08,
                width: width * 0.4,
                height: height * 0.2,
              },
            ]}
          />

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

          <Pressable
            onPress={() => router.push("/tela12")}
            style={[
              styles.hitbox,
              {
                left: width * 0.15,
                top: height * 0.24,
                width: width * 0.7,
                height: height * 0.12,
              },
            ]}
          />

          <Pressable
            onPress={() => router.push("/tela8")}
            style={[
              styles.hitbox,
              {
                left: width * 0.15,
                top: height * 0.65,
                width: width * 0.7,
                height: height * 0.18,
              },
            ]}
          />

          <Pressable
            onLongPress={ativarTela3}
            delayLongPress={2500}
            style={styles.centerButton}
          />

          <Pressable
            onLongPress={abrirTela3ComQuantidade}
            delayLongPress={3000}
            style={styles.centerBlueButton}
          />
        </View>
      </ScrollView>

      <RefreshAnimado
        visible={refreshAnimado.visible}
        fadeAnim={refreshAnimado.fadeAnim}
        spin={refreshAnimado.spin}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  scrollContent: {
    flexGrow: 1,
  },

  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  imageWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#f5f5f5",
    marginTop: -42,
  },

  image: {
    width: "100%",
    height: "100%",
  },

  hitbox: {
    position: "absolute",
    backgroundColor: "transparent",
  },

  centerButton: {
    position: "absolute",
    top: "60%",
    left: "50%",
    transform: [{ translateX: -205 }, { translateY: -92 }],
    minWidth: 410,
    minHeight: 184,
    paddingHorizontal: 72,
    paddingVertical: 48,
    borderRadius: 34,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },

  centerBlueButton: {
    position: "absolute",
    top: "12%",
    left: "50%",
    transform: [{ translateX: -70 }, { translateY: -20 }],
    width: 140,
    height: 40,
    borderRadius: 10,
    backgroundColor: "transparent",
  },
});
