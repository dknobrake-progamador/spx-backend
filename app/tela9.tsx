import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { RefreshAnimado, useRefreshAnimado } from "../components/refresh animado";

const { width } = Dimensions.get("window");
const TOP_WHITE_MARGIN = 26;
const HEADER_HEIGHT = 170;

const sections = [
  {
    source: require("../assets/rolagem/entregues/rolo.png"),
    width: 720,
    height: 1282,
  },
  {
    source: require("../assets/rolagem/entregues/rolo2.png"),
    width: 720,
    height: 940,
  },
  {
    source: require("../assets/rolagem/entregues/Rolo3.png"),
    width: 720,
    height: 1099,
  },
  {
    source: require("../assets/rolagem/entregues/rolo4.png"),
    width: 720,
    height: 966,
  },
  {
    source: require("../assets/rolagem/entregues/rolo5.png"),
    width: 720,
    height: 921,
  },
  {
    source: require("../assets/rolagem/entregues/rolo6.png"),
    width: 720,
    height: 1128,
  },
  {
    source: require("../assets/rolagem/entregues/rolo7.png"),
    width: 706,
    height: 1183,
  },
  {
    source: require("../assets/rolagem/entregues/rolo8.png"),
    width: 720,
    height: 1158,
  },
  {
    source: require("../assets/rolagem/entregues/rolo9.png"),
    width: 705,
    height: 1131,
  },
  {
    source: require("../assets/rolagem/entregues/rolo10.png"),
    width: 720,
    height: 1118,
  },
  {
    source: require("../assets/rolagem/entregues/rolo11.png"),
    width: 720,
    height: 1154,
  },
  {
    source: require("../assets/rolagem/entregues/rolo12.png"),
    width: 720,
    height: 1152,
  },
  {
    source: require("../assets/rolagem/entregues/rolo13.png"),
    width: 720,
    height: 1176,
  },
  {
    source: require("../assets/rolagem/entregues/rolo14.png"),
    width: 720,
    height: 1160,
  },
  {
    source: require("../assets/rolagem/entregues/rolo15.png"),
    width: 720,
    height: 1145,
  },
  {
    source: require("../assets/rolagem/entregues/rolo16.png"),
    width: 720,
    height: 1150,
  },
] as const;

export default function Tela9() {
  const refreshAnimado = useRefreshAnimado();
  const swipePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) + 20 &&
      Math.abs(gestureState.vx) > 0.12,
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx <= -50) {
        router.push("/tela3-imagem");
      }
    },
  });

  return (
    <View style={styles.container} {...swipePanResponder.panHandlers}>
      <Image
        source={require("../assets/images/tela9.png")}
        style={styles.headerImage}
        resizeMode="cover"
      />
      <View style={styles.headerDivider} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refreshAnimado.iniciarAnimacao}
            colors={["transparent"]}
            progressBackgroundColor="transparent"
            tintColor="transparent"
            titleColor="transparent"
            progressViewOffset={-120}
          />
        }
      >
        {sections.map((section, index) => (
          <Image
            key={index}
            source={section.source}
            style={[
              styles.sectionImage,
              {
                height: (width * section.height) / section.width,
              },
            ]}
            resizeMode="stretch"
          />
        ))}
      </ScrollView>

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
    backgroundColor: "#fff",
  },

  headerImage: {
    position: "absolute",
    top: TOP_WHITE_MARGIN,
    left: 0,
    right: 0,
    width: "100%",
    height: HEADER_HEIGHT,
  },

  headerDivider: {
    position: "absolute",
    top: TOP_WHITE_MARGIN + HEADER_HEIGHT,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#d9d9d9",
  },

  scroll: {
    position: "absolute",
    top: TOP_WHITE_MARGIN + HEADER_HEIGHT,
    left: 0,
    right: 0,
    bottom: 0,
  },

  content: {
    paddingBottom: 24,
  },

  sectionImage: {
    width: "100%",
    backgroundColor: "transparent",
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
