import * as ImagePicker from "expo-image-picker";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  getLabelPhotoUri,
  getScannedOccurrence,
  setLabelPhotoUri,
  setScannedBrCode,
  setScannedOccurrence,
} from "../lib/devStorage";
import { hasGoogleOcrEndpoint, runGoogleOcr } from "../lib/googleOcr";
import { extractOccurrenceFromText } from "../lib/occurrenceParser";
import { OCR_WEBVIEW_HTML } from "../lib/ocrWebViewHtml";

const TOTAL_CARDS = 5;

export default function Tela13() {
  const params = useLocalSearchParams<{ index?: string }>();
  const webViewRef = useRef<WebView>(null);
  const [labelPhotoUri, setLabelPhotoUriState] = useState<string | null>(null);
  const [ocrImageUri, setOcrImageUri] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrVisible, setOcrVisible] = useState(false);
  const cardIndex = Number(params.index ?? "0");
  const cardLabel = Number.isFinite(cardIndex) ? cardIndex + 1 : 1;

  useEffect(() => {
    let active = true;

    async function loadSavedPhoto() {
      const savedUri = await getLabelPhotoUri(cardIndex);
      if (active) {
        setLabelPhotoUriState(savedUri);
      }
    }

    loadSavedPhoto();

    return () => {
      active = false;
    };
  }, [cardIndex]);

  async function savePhoto(uri: string) {
    await setLabelPhotoUri(uri, cardIndex);
    setLabelPhotoUriState(uri);
  }

  async function processOcrText(
    text: string,
    fields?: {
      trackingCode?: string;
      address?: string;
      recipientName?: string;
      status?: string;
      statusDate?: string;
      rawText?: string;
    }
  ) {
    const extracted = extractOccurrenceFromText(text);
    const trackingCode = fields?.trackingCode?.trim() || extracted.codigo || "";

    if (!trackingCode && !extracted.endereco && !extracted.pessoa) {
      Alert.alert("OCR sem resultado", "Nao encontrei BR, nome ou endereco na etiqueta.");
      return;
    }

    const current = await getScannedOccurrence(cardIndex);
    const merged = {
      codigo: trackingCode || current?.codigo || "",
      endereco: fields?.address?.trim() || extracted.endereco || current?.endereco || null,
      pessoa: fields?.recipientName?.trim() || extracted.pessoa || current?.pessoa || null,
      status: fields?.status?.trim() || current?.status || null,
      statusDate: fields?.statusDate?.trim() || current?.statusDate || null,
      raw: fields?.rawText || text,
      scanType: "ocr",
    };

    if (!merged.codigo) {
      Alert.alert("Faltou BR", "O texto foi lido, mas nenhum codigo BR valido foi identificado.");
      return;
    }

    await setScannedBrCode(merged.codigo);
    await setScannedOccurrence(merged, cardIndex);

    Alert.alert("Etiqueta lida", `O card ${cardLabel} foi atualizado a partir da foto.`, [
      {
        text: "OK",
        onPress: () => router.push("/tela3"),
      },
    ]);
  }

  async function startOcr(imageUri: string) {
    setOcrProgress(0);
    setOcrImageUri(imageUri);
    setOcrVisible(true);
  }

  async function saveAndProcess(asset: ImagePicker.ImagePickerAsset) {
    await savePhoto(asset.uri);
    if (!asset.base64) {
      Alert.alert("Sem base64", "A imagem foi salva, mas nao foi possivel iniciar o OCR.");
      return;
    }

    const mimeType = asset.mimeType || "image/jpeg";

    if (hasGoogleOcrEndpoint()) {
      setOcrProgress(0);
      setOcrVisible(true);

      try {
        const result = await runGoogleOcr({
          base64: asset.base64,
          mimeType,
        });

        setOcrVisible(false);
        setOcrProgress(0);
        await processOcrText(result.text, result.fields);
        return;
      } catch (error) {
        setOcrVisible(false);
        setOcrProgress(0);
        Alert.alert(
          "Google OCR falhou",
          error instanceof Error ? error.message : "Falha ao consultar o endpoint."
        );
        return;
      }
    }

    await startOcr(`data:${mimeType};base64,${asset.base64}`);
  }

  async function pedirPermissaoGaleria() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Libere a galeria para selecionar a foto da etiqueta.");
      return false;
    }

    return true;
  }
  async function escolherDaGaleria() {
    const granted = await pedirPermissaoGaleria();
    if (!granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      base64: true,
      quality: 1,
    });

    if (!result.canceled) {
      await saveAndProcess(result.assets[0]);
    }
  }

  function handleWebViewMessage(rawMessage: string) {
    try {
      const message = JSON.parse(rawMessage) as
        | { type: "ready" }
        | { type: "progress"; progress: number }
        | {
            type: "result";
            text: string;
            fields?: {
              trackingCode?: string;
              address?: string;
              recipientName?: string;
              status?: string;
              statusDate?: string;
              rawText?: string;
            };
          }
        | { type: "error"; message: string };

      if (message.type === "ready" && ocrImageUri) {
        webViewRef.current?.injectJavaScript(
          `window.startOcr(${JSON.stringify(ocrImageUri)}); true;`
        );
        return;
      }

      if (message.type === "progress") {
        setOcrProgress(message.progress);
        return null;
      }

      if (message.type === "result") {
        setOcrVisible(false);
        setOcrImageUri(null);
        setOcrProgress(0);
        console.log("OCR_RESULT_JSON", JSON.stringify(message, null, 2));
        Alert.alert(
          "OCR debug",
          [
            `trackingCode: ${message.fields?.trackingCode ?? "(vazio)"}`,
            `address: ${message.fields?.address ?? "(vazio)"}`,
            `recipientName: ${message.fields?.recipientName ?? "(vazio)"}`,
            `status: ${message.fields?.status ?? "(vazio)"}`,
            `statusDate: ${message.fields?.statusDate ?? "(vazio)"}`,
            `text: ${message.text || "(vazio)"}`,
          ].join("\n\n")
        );
        processOcrText(message.text, message.fields).catch(() => {
          Alert.alert("Erro no OCR", "Nao foi possivel aplicar o texto lido.");
        });
        return null;
      }

      if (message.type === "error") {
        setOcrVisible(false);
        setOcrImageUri(null);
        setOcrProgress(0);
        Alert.alert("Erro no OCR", message.message);
      }
    } catch {
      setOcrVisible(false);
      setOcrImageUri(null);
      setOcrProgress(0);
      Alert.alert("Erro no OCR", "Falha ao interpretar a resposta do OCR.");
    }

  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={24} color="#222" />
        </Pressable>
        <Text style={styles.title}>Etiqueta do card {cardLabel}</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.previewCard}>
          {labelPhotoUri ? (
            <Image source={{ uri: labelPhotoUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.emptyPreview}>
              <MaterialIcons name="document-scanner" size={40} color="#999" />
              <Text style={styles.emptyText}>Nenhuma foto de etiqueta salva</Text>
            </View>
          )}
        </View>

        <Text style={styles.description}>
          Escolha a foto da etiqueta pela galeria para preencher este card com OCR.
        </Text>

        <Pressable onPress={escolherDaGaleria} style={[styles.actionButton, styles.secondaryButton]}>
          <MaterialIcons name="photo-library" size={20} color="#222" />
          <Text style={styles.secondaryButtonText}>Escolher da galeria</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/tela3")} style={styles.linkButton}>
          <Text style={styles.linkText}>Voltar para ocorrencias</Text>
        </Pressable>
      </View>

      <Modal visible={ocrVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lendo etiqueta</Text>
            <Text style={styles.modalSubtitle}>Processando OCR... {ocrProgress}%</Text>
            <WebView
              ref={webViewRef}
              originWhitelist={["*"]}
              source={{ html: OCR_WEBVIEW_HTML }}
              onMessage={(event) => {
                handleWebViewMessage(event.nativeEvent.data);
              }}
              style={styles.hiddenWebView}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f0ea",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#fffaf2",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd2bf",
  },

  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  iconPlaceholder: {
    width: 40,
    height: 40,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },

  content: {
    flex: 1,
    padding: 20,
    gap: 16,
  },

  previewCard: {
    minHeight: 280,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2d7c8",
  },

  previewImage: {
    width: "100%",
    height: 320,
  },

  emptyPreview: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },

  emptyText: {
    fontSize: 15,
    color: "#777",
  },

  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4b433a",
  },

  actionButton: {
    minHeight: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  primaryButton: {
    backgroundColor: "#e85d2a",
  },

  secondaryButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8cdbd",
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  secondaryButtonText: {
    color: "#222",
    fontSize: 16,
    fontWeight: "700",
  },

  linkButton: {
    alignSelf: "center",
    paddingVertical: 12,
  },

  linkText: {
    color: "#7d4a1d",
    fontSize: 15,
    fontWeight: "600",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#fffaf2",
    borderRadius: 18,
    padding: 20,
    gap: 8,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },

  modalSubtitle: {
    fontSize: 14,
    color: "#5d554b",
  },

  hiddenWebView: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});
