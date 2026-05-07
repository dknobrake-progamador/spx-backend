import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FlexiblePhotoPreview } from "../components/flexible-photo-preview";
import { wakeUpServer } from "../lib/apiClient";
import {
  completeCurrentUserEditMode,
  getAuthEditScope,
  getPlaca2Uri,
  getPlacaUri,
  getTela11Uri,
  getTela6Uri,
  setPlaca2Uri,
  setPlacaUri,
  setTela11Uri,
  setTela6Uri,
  syncSinglePhotoToCloud,
  validateCurrentUserPhotosInCloud,
  type CloudPhotoKey,
} from "../lib/devStorage";

type SlotKey = "tela4" | "tela6" | "tela11" | "placa2";

function slotToCloudKey(slot: SlotKey): CloudPhotoKey {
  if (slot === "tela4") return "placa";
  if (slot === "tela6") return "tela6";
  if (slot === "tela11") return "tela11";
  return "placa2";
}

export default function UploadFotos() {
  const [placaUri, setPlacaUriState] = useState<string | null>(null);
  const [tela6Uri, setTela6UriState] = useState<string | null>(null);
  const [tela11Uri, setTela11UriState] = useState<string | null>(null);
  const [placa2Uri, setPlaca2UriState] = useState<string | null>(null);
  const [editScope, setEditScope] = useState<"none" | "tela4" | "all">("none");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Aguardando upload...");
  const isEditMode = editScope !== "none";
  const canEditAll = editScope === "all";
  const canEditTela4Only = editScope === "tela4";
  const liberado = isEditMode ? !!placaUri : !!placaUri && !!tela6Uri && !!tela11Uri;

  useEffect(() => {
    let active = true;
    (async () => {
      const [scope, p, t6, t11, p2] = await Promise.all([
        getAuthEditScope(),
        getPlacaUri(),
        getTela6Uri(),
        getTela11Uri(),
        getPlaca2Uri(),
      ]);
      if (!active) return;
      setEditScope(scope);
      setPlacaUriState(p);
      setTela6UriState(t6);
      setTela11UriState(t11);
      setPlaca2UriState(p2);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function pedirPermissao() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted) return true;
    Alert.alert("Permissao necessaria", "Libere a galeria para fazer upload das fotos.");
    return false;
  }

  async function escolher(slot: SlotKey) {
    if (canEditTela4Only && slot !== "tela4") {
      Alert.alert("Indisponivel", "Essa imagem nao esta disponivel no momento.");
      return;
    }

    console.log("[UPLOAD_FLOW] iniciar_escolha", { slot, editScope });
    setLoading(true);
    setStatus("Selecionando imagem...");
    const ok = await pedirPermissao();
    if (!ok) {
      setLoading(false);
      setStatus("Permissao negada.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.6,
    });

    if (result.canceled) {
      setLoading(false);
      setStatus("Selecao cancelada.");
      return;
    }
    const uri = result.assets[0]?.uri;
    if (!uri) {
      setLoading(false);
      setStatus("Falha ao ler imagem.");
      return;
    }

    try {
      setStatus("Salvando local...");
      if (slot === "tela4") {
        await setPlacaUri(uri);
        setPlacaUriState(uri);
      } else if (slot === "tela6") {
        await setTela6Uri(uri);
        setTela6UriState(uri);
      } else if (slot === "tela11") {
        await setTela11Uri(uri);
        setTela11UriState(uri);
      } else {
        await setPlaca2Uri(uri);
        setPlaca2UriState(uri);
      }

      setStatus("Conectando ao servidor...");
      await wakeUpServer();

      setStatus("Enviando foto para nuvem...");
      const cloudKey = slotToCloudKey(slot);
      let synced;
      try {
        synced = await syncSinglePhotoToCloud(cloudKey, uri);
      } catch {
        setStatus("Tentando novamente...");
        synced = await syncSinglePhotoToCloud(cloudKey, uri);
      }

      console.log("[UPLOAD_FLOW] sync_nuvem_ok", synced);
      setStatus("Validando na nuvem...");
      const cloud = await validateCurrentUserPhotosInCloud();

      if (cloud.requiredInCloud || isEditMode) {
        setStatus("Upload validado. Pode concluir.");
      } else {
        setStatus("Upload parcial. Faltam fotos obrigatorias na nuvem.");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha no upload.";
      setStatus(`Erro: ${msg}`);
      Alert.alert("Falha no upload", msg);
    } finally {
      setLoading(false);
    }
  }

  async function concluirEdicaoEEntrar() {
    if (!liberado) {
      Alert.alert(
        "Faltam fotos",
        isEditMode
          ? "Envie a foto liberada para concluir a edicao."
          : "Envie Placa 1, Tela 6 e Tela 11 para continuar."
      );
      return;
    }

    if (isEditMode) {
      try {
        setLoading(true);
        setStatus("Finalizando edicao...");
        await completeCurrentUserEditMode();
        setEditScope("none");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha ao concluir a edicao.";
        Alert.alert("Erro", message);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    router.replace("/tela6");
  }

  function Slot({
    title,
    uri,
    slot,
  }: {
    title: string;
    uri: string | null;
    slot: SlotKey;
  }) {
    const blocked = canEditTela4Only && slot !== "tela4";

    return (
      <View style={[styles.card, blocked ? styles.cardBlocked : null]}>
        <Text style={styles.cardTitle}>{title}</Text>
        {uri ? (
          <FlexiblePhotoPreview uri={uri} style={styles.image} />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Sem foto</Text>
          </View>
        )}
        <Pressable
          onPress={() => escolher(slot)}
          disabled={loading || blocked}
          style={[styles.button, blocked ? styles.buttonBlocked : null]}
        >
          <Text style={styles.buttonText}>
            {blocked ? "Bloqueado neste modo" : loading ? "Aguarde..." : "Escolher da galeria"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Upload de Fotos</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Slot title="Foto 1 (Placa 1)" uri={placaUri} slot="tela4" />
        <Slot title="Foto 2 (Tela 6)" uri={tela6Uri} slot="tela6" />
        <Slot title="Foto 3 (Tela 11)" uri={tela11Uri} slot="tela11" />
        <Slot title="Foto 4 (Placa 2 - opcional)" uri={placa2Uri} slot="placa2" />

        <Pressable
          onPress={concluirEdicaoEEntrar}
          disabled={loading}
          style={[styles.enterButton, !liberado && styles.enterButtonDisabled]}
        >
        <Text style={styles.enterButtonText}>
            {isEditMode ? "Concluir e entrar" : "Entrar no aplicativo"}
          </Text>
        </Pressable>

        <Text style={styles.status}>{status}</Text>
        <Text style={styles.hint}>
          {isEditMode
            ? ""
            : liberado
              ? "Liberado. Pode entrar no aplicativo. Placa 2 e opcional."
              : "Para liberar o app: envie Placa 1, Tela 6 e Tela 11. Placa 2 e opcional."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f6f6" },
  header: {
    height: 56,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  back: { width: 64, height: 36, justifyContent: "center" },
  backText: { color: "#e85d2a", fontWeight: "600" },
  title: { fontSize: 18, fontWeight: "700", color: "#222" },
  content: { padding: 12, gap: 12, paddingBottom: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    padding: 12,
    gap: 10,
  },
  cardBlocked: {
    opacity: 0.7,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#222" },
  image: { width: "100%", height: 180, borderRadius: 10 },
  empty: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: "#888" },
  button: {
    backgroundColor: "#e85d2a",
    minHeight: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonBlocked: {
    backgroundColor: "#bdbdbd",
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  enterButton: {
    backgroundColor: "#0a8f3e",
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  enterButtonDisabled: {
    backgroundColor: "#7bbf95",
  },
  enterButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { color: "#666", fontSize: 13, textAlign: "center", marginTop: 6 },
  status: { color: "#333", fontSize: 13, textAlign: "center", marginTop: 8 },
});
