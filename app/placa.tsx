import { useFocusEffect, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { FlexiblePhotoPreview } from "../components/flexible-photo-preview";
import {
  getPlaca2Active,
  getPlaca2DisplayUri,
  getPlacaDisplayUri,
  hydrateCurrentUserPhotosFromCloud,
  setPlaca2Active,
} from "../lib/devStorage";

const { width, height } = Dimensions.get("window");

async function resolvePlateState() {
  const placa2Active = await getPlaca2Active();
  const [placa1Uri, placa2Uri] = await Promise.all([
    getPlacaDisplayUri(),
    getPlaca2DisplayUri(),
  ]);

  if (placa2Active && placa2Uri) {
    return {
      activePlate: "placa2" as const,
      uri: placa2Uri,
      hasPlaca2: true,
    };
  }

  if (placa2Active && !placa2Uri && placa1Uri) {
    await setPlaca2Active(false);
    return {
      activePlate: "placa1" as const,
      uri: placa1Uri,
      hasPlaca2: !!placa2Uri,
    };
  }

  if (placa1Uri) {
    return {
      activePlate: "placa1" as const,
      uri: placa1Uri,
      hasPlaca2: !!placa2Uri,
    };
  }

  if (placa2Uri) {
    await setPlaca2Active(true);
    return {
      activePlate: "placa2" as const,
      uri: placa2Uri,
      hasPlaca2: true,
    };
  }

  return {
    activePlate: "placa1" as const,
    uri: null,
    hasPlaca2: !!placa2Uri,
  };
}

export default function Placa() {
  const [uri, setUri] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [activePlate, setActivePlate] = useState<"placa1" | "placa2">("placa1");
  const [hasPlaca2, setHasPlaca2] = useState(false);

  const carregarImagem = useCallback(async () => {
    setLoadingImage(true);
    setUri(null);

    const rawPlaca1 = await AsyncStorage.getItem("@DEV_PLACA_URI");
    const rawPlaca2 = await AsyncStorage.getItem("@DEV_PLACA_2_URI");
    const rawPlaca2Active = await AsyncStorage.getItem("@DEV_PLACA_2_ACTIVE");
    console.log("[PLACA] raw:", { rawPlaca1, rawPlaca2, rawPlaca2Active });

    const placa2Active = rawPlaca2Active === "true" || rawPlaca2Active === "1";
    const uriLocal = (placa2Active && rawPlaca2) ? rawPlaca2 : (rawPlaca1 || rawPlaca2);

    if (uriLocal) {
      console.log("[PLACA] usando uri local direto:", uriLocal);
      setActivePlate(placa2Active && rawPlaca2 ? "placa2" : "placa1");
      setHasPlaca2(!!rawPlaca2);
      setUri(uriLocal);
      setLoadingImage(false);
      return;
    }

    try {
      await hydrateCurrentUserPhotosFromCloud({ force: true });
    } catch {
    }

    const p1 = await AsyncStorage.getItem("@DEV_PLACA_URI");
    const p2 = await AsyncStorage.getItem("@DEV_PLACA_2_URI");
    const p2active = (await AsyncStorage.getItem("@DEV_PLACA_2_ACTIVE")) === "true";
    const uriFinal = (p2active && p2) ? p2 : (p1 || p2);

    setActivePlate(p2active && p2 ? "placa2" : "placa1");
    setHasPlaca2(!!p2);
    setUri(uriFinal ?? null);
    setLoadingImage(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      async function carregar() {
        setLoadingImage(true);
        const rawPlaca1 = await AsyncStorage.getItem("@DEV_PLACA_URI");
        const rawPlaca2 = await AsyncStorage.getItem("@DEV_PLACA_2_URI");
        const rawPlaca2Active = await AsyncStorage.getItem("@DEV_PLACA_2_ACTIVE");
        console.log("[PLACA] raw:", { rawPlaca1, rawPlaca2, rawPlaca2Active });

        const placa2Active = rawPlaca2Active === "true" || rawPlaca2Active === "1";
        const uriLocal = (placa2Active && rawPlaca2) ? rawPlaca2 : (rawPlaca1 || rawPlaca2);

        if (uriLocal) {
          console.log("[PLACA] usando uri local direto:", uriLocal);
          setActivePlate(placa2Active && rawPlaca2 ? "placa2" : "placa1");
          setHasPlaca2(!!rawPlaca2);
          setUri(uriLocal);
          setLoadingImage(false);
          return;
        }

        try {
          await hydrateCurrentUserPhotosFromCloud({ force: true });
        } catch {
        }

        const p1 = await AsyncStorage.getItem("@DEV_PLACA_URI");
        const p2 = await AsyncStorage.getItem("@DEV_PLACA_2_URI");
        const p2active = (await AsyncStorage.getItem("@DEV_PLACA_2_ACTIVE")) === "true";
        const uriFinal = (p2active && p2) ? p2 : (p1 || p2);

        if (!alive) return;
        setActivePlate(p2active && p2 ? "placa2" : "placa1");
        setHasPlaca2(!!p2);
        setUri(uriFinal ?? null);
        setLoadingImage(false);
      }

      carregar();

      return () => {
        alive = false;
      };
    }, [])
  );

  async function alternarPlaca() {
    if (!hasPlaca2) {
      return;
    }

    const nextActive = activePlate === "placa2";
    await setPlaca2Active(!nextActive);
    await carregarImagem();
  }

  if (!uri) {
    return (
      <View style={styles.emptyScreen}>
        {loadingImage ? <ActivityIndicator size="large" color="#e85d2a" /> : null}
        <Text style={styles.emptyText}>
          {loadingImage ? "Carregando placa..." : "Imagem da placa nao encontrada."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlexiblePhotoPreview uri={uri} style={styles.bg} />
      <Pressable
        onLongPress={alternarPlaca}
        delayLongPress={2000}
        disabled={!hasPlaca2}
        hitSlop={24}
        pressRetentionOffset={32}
        style={styles.topButton}
      />
      <Pressable
        onPress={() => router.push("/tela6")}
        style={[
          styles.hitbox,
          {
            left: 0,
            top: 0,
            width: width * 0.35,
            height: height * 0.18,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  bg: { flex: 1 },
  topButton: {
    position: "absolute",
    top: 216,
    alignSelf: "center",
    minWidth: 280,
    minHeight: 96,
    paddingHorizontal: 44,
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
