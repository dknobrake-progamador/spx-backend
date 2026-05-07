import { useFocusEffect, router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { FlexiblePhotoPreview } from "../components/flexible-photo-preview";
import {
  getCurrentProfile,
  getPlaca2Uri,
  getPlaca2DisplayUri,
  getPlacaDisplayUri,
  hydrateCurrentUserPhotosFromCloud,
  setCurrentProfile,
} from "../lib/devStorage";

const { width, height } = Dimensions.get("window");

export default function Placa() {
  const [uri, setUri] = useState<string | null>(null);
  const [currentProfile, setCurrentProfileState] = useState<"007" | "008">("007");
  const [hasPlaca2, setHasPlaca2] = useState(false);

  const carregarImagem = useCallback(async () => {
    setUri(null);

    const profile = await getCurrentProfile();
    const savedUri = profile === "008"
      ? await getPlaca2DisplayUri()
      : await getPlacaDisplayUri();

    setCurrentProfileState(profile);
    setUri(savedUri);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      async function carregar() {
        setUri(null);

        try {
          await hydrateCurrentUserPhotosFromCloud();
        } catch {
          // Mantem a tela utilizavel mesmo sem sincronizar nuvem.
        }

        const profile = await getCurrentProfile();
        const savedUri = profile === "008"
          ? await getPlaca2DisplayUri()
          : await getPlacaDisplayUri();
        const placa2Uri = await getPlaca2Uri();

        if (!alive) return;
        setCurrentProfileState(profile);
        setHasPlaca2(!!placa2Uri);
        setUri(savedUri);
      }

      carregar();

      return () => {
        alive = false;
      };
    }, [carregarImagem])
  );

  async function alternarPlaca() {
    if (!hasPlaca2) {
      return;
    }

    const nextProfile = currentProfile === "008" ? "007" : "008";
    await setCurrentProfile(nextProfile);
    await carregarImagem();
  }

  if (!uri) {
    return <View style={{ flex: 1, backgroundColor: "#fff" }} />;
  }

  return (
    <View style={styles.screen}>
      <FlexiblePhotoPreview uri={uri} style={styles.bg} />
      <Pressable
        onLongPress={alternarPlaca}
        delayLongPress={3500}
        disabled={!hasPlaca2}
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
});
