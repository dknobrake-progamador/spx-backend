import { router, useFocusEffect } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import React, { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getCurrentAdminAccess, getTela11Uri, hydrateCurrentUserPhotosFromCloud, KEY_TELA11 } from "../lib/devStorage";

const { width, height } = Dimensions.get("window");
let lastKnownTela11Uri: string | null = null;

export default function Tela11() {
  const [uri, setUri] = useState<string | null>(() => lastKnownTela11Uri);
  const [loadingImage, setLoadingImage] = useState(true);
  const [cloudAttempted, setCloudAttempted] = useState(false);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [isTela11Resolved, setIsTela11Resolved] = useState(() => !!lastKnownTela11Uri);

  console.log("[TELA11] render", {
    uri,
    loadingImage,
    cloudAttempted,
    sourceRevision,
    isTela11Resolved,
  });

  async function abrirPainelAdmin() {
    if ((await getCurrentAdminAccess()) !== "master") return;
    router.push("/painel-admin");
  }

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      async function loadTela11Image() {
        console.log("[TELA11] loadTela11Image START");
        setLoadingImage(true);
        setIsTela11Resolved(false);
        const savedUri = await AsyncStorage.getItem(KEY_TELA11);
        console.log("[TELA11] savedUri:", savedUri);

        setCloudAttempted(false);

        if (savedUri) {
          console.log("[TELA11] setUri com savedUri:", savedUri);
          lastKnownTela11Uri = savedUri;
          setUri(savedUri);
          setSourceRevision((current) => current + 1);
          setLoadingImage(false);
          setIsTela11Resolved(true);
          console.log("[TELA11] loadTela11Image END with savedUri");
          return;
        }

        console.log("[TELA11] savedUri null, tentando nuvem...");

        if (lastKnownTela11Uri) {
          console.log("[TELA11] usando lastKnownTela11Uri:", lastKnownTela11Uri);
          setUri(lastKnownTela11Uri);
        }

        try {
          await hydrateCurrentUserPhotosFromCloud({ force: true });
        } catch (error) {
          console.log("[TELA11] hydrate erro:", error);
        }

        const hydratedUri = await getTela11Uri();
        console.log("[TELA11] hydratedUri:", hydratedUri, "alive:", alive);
        if (alive) {
          setCloudAttempted(true);
          if (hydratedUri) {
            console.log("[TELA11] setUri com hydratedUri:", hydratedUri);
            lastKnownTela11Uri = hydratedUri;
            setUri(hydratedUri);
            setSourceRevision((current) => current + 1);
          }
        }

        setLoadingImage(false);
        setIsTela11Resolved(true);
        console.log("[TELA11] loadTela11Image END");
      }

      void loadTela11Image();

      return () => {
        alive = false;
      };
    }, [])
  );

  async function recoverTela11FromCloud() {
    console.log(
      "[TELA11] recoverTela11FromCloud chamado, cloudAttempted:",
      cloudAttempted,
      "uri:",
      uri
    );

    if (cloudAttempted) {
      return;
    }

    setCloudAttempted(true);
    try {
      await hydrateCurrentUserPhotosFromCloud({ force: true });
    } catch {}

    const recoveredUri = await getTela11Uri();
    console.log("[TELA11] recoveredUri:", recoveredUri);
    if (recoveredUri) {
      lastKnownTela11Uri = recoveredUri;
      setUri(recoveredUri);
      setSourceRevision((current) => current + 1);
      setIsTela11Resolved(true);
    }
  }

  const imageSource = uri
    ? { uri }
    : isTela11Resolved
      ? require("../assets/images/tela6.jpg")
      : null;

  console.log("[TELA11] imageSource", {
    hasUri: !!uri,
    isFallback: !uri && isTela11Resolved,
    imageSourceType: uri ? "remote" : isTela11Resolved ? "fallback" : "none",
  });

  if (!imageSource) {
    console.log("[TELA11] renderizando emptyScreen");
    return (
      <View style={styles.emptyScreen}>
        {loadingImage ? <ActivityIndicator size="large" color="#e85d2a" /> : null}
        <Text style={styles.emptyText}>
          {loadingImage ? "Carregando imagem..." : "Imagem da Tela 11 nao encontrada."}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ExpoImage
        key={`${uri || "fallback"}-${sourceRevision}`}
        source={imageSource}
        onError={
          uri
            ? (error) => {
                console.log(
                  "[TELA11] onError disparou, uri:",
                  uri,
                  "erro:",
                  JSON.stringify(error)
                );
                void recoverTela11FromCloud();
              }
            : undefined
        }
        style={styles.bg}
        contentFit="cover"
        cachePolicy="memory"
        onLoadStart={() => console.log("[TELA11] ExpoImage onLoadStart")}
        onLoadEnd={() => console.log("[TELA11] ExpoImage onLoadEnd")}
      />
      <View style={styles.overlay}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
  },
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
  emptyScreen: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyText: {
    color: "#666",
    fontSize: 15,
    textAlign: "center",
  },
});
