import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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

  const swipeLinePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) + 12 &&
      Math.abs(gestureState.dx) > 24,
    onPanResponderRelease: async (_, gestureState) => {
      const threshold = 35;
      if (gestureState.dx >= threshold) {
        router.push("/tela2");
        return;
      }
      if (gestureState.dx <= -threshold) {
        router.push("/tela9");
      }
    },
  });

  if (!telaPrincipal) {
    return <SafeAreaView style={styles.container} />;
  }

  if (telaPrincipal === "tela30") {
    return <Redirect href="/tela3" />;
  }

  return (
    <SafeAreaView style={styles.container} {...swipeLinePanResponder.panHandlers}>
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
            progressViewOffset={-120}
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
            resizeMode="contain"
          />

          <View pointerEvents="none" style={styles.ocorrenciaLabelMask}>
            <Text style={styles.ocorrenciaLabelText}>Ocorrência</Text>
          </View>

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

          <View style={styles.centerBlueButton}>
            <Pressable
              onLongPress={abrirTela3ComQuantidade}
              delayLongPress={3000}
              style={styles.centerBlueButtonTouch}
            />
          </View>
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
    width: "100%",
    height: height,
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#fff",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  ocorrenciaLabelMask: {
    position: "absolute",
    top: height * 0.106,
    left: width * 0.355,
    width: width * 0.31,
    height: 30,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },

  ocorrenciaLabelText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9ca3af",
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

  centerBlueButtonTouch: {
    flex: 1,
  },
});
