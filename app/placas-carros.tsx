import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Code128Barcode, buildCode128Bars } from "../components/code128-barcode";
import {
  assertBarcodePageLock,
  BARCODE_PAGE_LOCK,
  getLockedBarcodeMetrics,
} from "../lib/barcode-page-lock";
import { applyGeneratedPlateToUser, getPlaca2Active } from "../lib/devStorage";

const GENERATE_BUTTON_BARS = Array.from({ length: 56 }, (_, index) => {
  const pattern = ["hair", "thin", "wide", "thin", "medium", "hair", "wide", "thin"];
  return pattern[index % pattern.length] as "hair" | "thin" | "medium" | "wide";
});

const SVG_WIDTH = BARCODE_PAGE_LOCK.svg.width;
const SVG_HEIGHT = BARCODE_PAGE_LOCK.svg.height;
const BARCODE_DRAW_WIDTH = BARCODE_PAGE_LOCK.svg.barcodeDrawWidth;
const GENERATED_HEADER_HEIGHT = 94;
const GENERATED_HEADER_TEXT_Y = 70;
const GENERATED_HEADER_LINE_Y = GENERATED_HEADER_HEIGHT;
const GENERATED_TOP_CARD_X = 14;
const GENERATED_TOP_CARD_WIDTH = 362;
const GENERATED_TOP_CARD_RIGHT = GENERATED_TOP_CARD_X + GENERATED_TOP_CARD_WIDTH;
const GENERATED_TOP_CARD_Y = 110;
const GENERATED_TOP_CARD_HEIGHT = 284;
const GENERATED_BOTTOM_CARD_X = 14;
const GENERATED_BOTTOM_CARD_WIDTH = 362;
const GENERATED_BOTTOM_CARD_RIGHT = GENERATED_BOTTOM_CARD_X + GENERATED_BOTTOM_CARD_WIDTH;
const GENERATED_BOTTOM_CARD_Y = 406;
const GENERATED_BOTTOM_CARD_HEIGHT = 106;
const GENERATED_BARCODE_WIDTH = 292;
const GENERATED_BARCODE_X = (SVG_WIDTH - GENERATED_BARCODE_WIDTH) / 2;
const GENERATED_BARCODE_Y = 252;
const GENERATED_BARCODE_HEIGHT = 98;
const GENERATED_NAME_Y = GENERATED_TOP_CARD_Y + 75;
const GENERATED_ID_Y = GENERATED_TOP_CARD_Y + 103;
const GENERATED_INFO_DIVIDER_Y = GENERATED_BOTTOM_CARD_Y + 53;
const GENERATED_INFO_TOP_LABEL_Y = GENERATED_BOTTOM_CARD_Y + 31;
const GENERATED_INFO_BOTTOM_LABEL_Y = GENERATED_BOTTOM_CARD_Y + 84;
const GENERATED_INFO_TEXT_LEFT = GENERATED_BOTTOM_CARD_X + 18;
const GENERATED_CONTENT_SHIFT_Y = 0;

assertBarcodePageLock();
function normalizeLogin(value: string) {
  return value.replace(/\D/g, "");
}

function svgMarkupToDataUrl(svgMarkup: string) {
  const maybeBuffer = (globalThis as { Buffer?: { from(input: string, encoding?: string): { toString(encoding: string): string } } }).Buffer;
  if (maybeBuffer) {
    const base64 = maybeBuffer.from(svgMarkup, "utf8").toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildPlateSvgMarkup({
  name,
  id,
  vehicleType,
  plate,
}: {
  name: string;
  id: string;
  vehicleType: string;
  plate: string;
}) {
  const bars = buildCode128Bars(id, GENERATED_BARCODE_WIDTH, BARCODE_PAGE_LOCK.barcode.quietZone);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#f3f4f7"/>
  <rect width="${SVG_WIDTH}" height="${GENERATED_HEADER_HEIGHT}" fill="#ffffff"/>
  <line x1="0" y1="${GENERATED_HEADER_HEIGHT}" x2="${SVG_WIDTH}" y2="${GENERATED_HEADER_HEIGHT}" stroke="#e8ecf2" stroke-width="1"/>
  <text x="28" y="35" font-family="Arial" font-size="22" font-weight="400" fill="#2d3561">←</text>
  <text x="62" y="36" font-family="Arial" font-size="18" font-weight="400" fill="#2d3561">${BARCODE_PAGE_LOCK.text.resultTitle}</text>
  <rect x="${GENERATED_TOP_CARD_X}" y="${GENERATED_TOP_CARD_Y}" width="${GENERATED_TOP_CARD_WIDTH}" height="284" rx="14" fill="#ffffff" stroke="#e5e9f0" stroke-width="1"/>
  <text x="${SVG_WIDTH / 2}" y="${147 + GENERATED_CONTENT_SHIFT_Y}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="600" fill="#1e2647" letter-spacing="1.8">${escapeXml(name)}</text>
  <text x="${SVG_WIDTH / 2}" y="${175 + GENERATED_CONTENT_SHIFT_Y}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="400" fill="#9ba3be" letter-spacing="0.5">${escapeXml(id)}</text>
  <rect x="${GENERATED_BARCODE_X}" y="${GENERATED_BARCODE_Y}" width="${GENERATED_BARCODE_WIDTH}" height="${GENERATED_BARCODE_HEIGHT}" fill="#ffffff"/>
  ${bars
    .map(
      (bar) =>
        `<rect x="${(GENERATED_BARCODE_X + bar.x).toFixed(2)}" y="${GENERATED_BARCODE_Y}" width="${bar.width.toFixed(2)}" height="${GENERATED_BARCODE_HEIGHT}" fill="#000000"/>`
    )
    .join("")}
  <rect x="${GENERATED_BOTTOM_CARD_X}" y="${GENERATED_BOTTOM_CARD_Y}" width="${GENERATED_BOTTOM_CARD_WIDTH}" height="106" rx="14" fill="#ffffff" stroke="#e5e9f0" stroke-width="1"/>
  <line x1="${GENERATED_BOTTOM_CARD_X}" y1="${421 + GENERATED_CONTENT_SHIFT_Y}" x2="${GENERATED_BOTTOM_CARD_RIGHT}" y2="${421 + GENERATED_CONTENT_SHIFT_Y}" stroke="#edf0f5" stroke-width="1"/>
  <text x="42" y="${399 + GENERATED_CONTENT_SHIFT_Y}" font-family="Arial" font-size="14" font-weight="400" fill="#5a6280">${BARCODE_PAGE_LOCK.text.vehicleType}</text>
  <text x="${GENERATED_BOTTOM_CARD_RIGHT - 18}" y="${399 + GENERATED_CONTENT_SHIFT_Y}" text-anchor="end" font-family="Arial" font-size="14" font-weight="500" fill="#1e2647" letter-spacing="0.4">${escapeXml(vehicleType)}</text>
  <text x="42" y="${452 + GENERATED_CONTENT_SHIFT_Y}" font-family="Arial" font-size="14" font-weight="400" fill="#5a6280">${BARCODE_PAGE_LOCK.text.vehiclePlate}</text>
  <text x="${GENERATED_BOTTOM_CARD_RIGHT - 18}" y="${452 + GENERATED_CONTENT_SHIFT_Y}" text-anchor="end" font-family="Arial" font-size="14" font-weight="500" fill="#1e2647" letter-spacing="0.4">${escapeXml(plate)}</text>
</svg>`;
}

function buildPlateSvgMarkupRefined({
  name,
  id,
  vehicleType,
  plate,
}: {
  name: string;
  id: string;
  vehicleType: string;
  plate: string;
}) {
  const bars = buildCode128Bars(id, GENERATED_BARCODE_WIDTH, BARCODE_PAGE_LOCK.barcode.quietZone);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#f3f4f7"/>
  <rect width="${SVG_WIDTH}" height="${GENERATED_HEADER_HEIGHT}" fill="#ffffff"/>
  <line x1="0" y1="${GENERATED_HEADER_LINE_Y}" x2="${SVG_WIDTH}" y2="${GENERATED_HEADER_LINE_Y}" stroke="#e8ecf2" stroke-width="1"/>
  <path d="M 39 ${GENERATED_HEADER_TEXT_Y - 15} L 23 ${GENERATED_HEADER_TEXT_Y - 1} L 39 ${GENERATED_HEADER_TEXT_Y + 13} M 23 ${GENERATED_HEADER_TEXT_Y - 1} H 55" fill="none" stroke="#2d3561" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="62" y="${GENERATED_HEADER_TEXT_Y}" font-family="Arial" font-size="18" font-weight="400" fill="#2d3561">${BARCODE_PAGE_LOCK.text.resultTitle}</text>
  <rect x="${GENERATED_TOP_CARD_X}" y="${GENERATED_TOP_CARD_Y}" width="${GENERATED_TOP_CARD_WIDTH}" height="${GENERATED_TOP_CARD_HEIGHT}" rx="14" fill="#ffffff" stroke="#e5e9f0" stroke-width="1"/>
  <text x="${SVG_WIDTH / 2}" y="${GENERATED_NAME_Y}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="600" fill="#1e2647" letter-spacing="1.8">${escapeXml(name)}</text>
  <text x="${SVG_WIDTH / 2}" y="${GENERATED_ID_Y}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="400" fill="#9ba3be" letter-spacing="0.5">${escapeXml(id)}</text>
  <rect x="${GENERATED_BARCODE_X}" y="${GENERATED_BARCODE_Y}" width="${GENERATED_BARCODE_WIDTH}" height="${GENERATED_BARCODE_HEIGHT}" fill="#ffffff"/>
  ${bars
    .map(
      (bar) =>
        `<rect x="${(GENERATED_BARCODE_X + bar.x).toFixed(2)}" y="${GENERATED_BARCODE_Y}" width="${bar.width.toFixed(2)}" height="${GENERATED_BARCODE_HEIGHT}" fill="#000000"/>`
    )
    .join("")}
  <rect x="${GENERATED_BOTTOM_CARD_X}" y="${GENERATED_BOTTOM_CARD_Y}" width="${GENERATED_BOTTOM_CARD_WIDTH}" height="${GENERATED_BOTTOM_CARD_HEIGHT}" rx="14" fill="#ffffff" stroke="#e5e9f0" stroke-width="1"/>
  <line x1="${GENERATED_BOTTOM_CARD_X}" y1="${GENERATED_INFO_DIVIDER_Y}" x2="${GENERATED_BOTTOM_CARD_RIGHT}" y2="${GENERATED_INFO_DIVIDER_Y}" stroke="#edf0f5" stroke-width="1"/>
  <text x="${GENERATED_INFO_TEXT_LEFT}" y="${GENERATED_INFO_TOP_LABEL_Y}" font-family="Arial" font-size="14" font-weight="400" fill="#5a6280">${BARCODE_PAGE_LOCK.text.vehicleType}</text>
  <text x="${GENERATED_BOTTOM_CARD_RIGHT - 18}" y="${GENERATED_INFO_TOP_LABEL_Y}" text-anchor="end" font-family="Arial" font-size="14" font-weight="500" fill="#1e2647" letter-spacing="0.4">${escapeXml(vehicleType)}</text>
  <text x="${GENERATED_INFO_TEXT_LEFT}" y="${GENERATED_INFO_BOTTOM_LABEL_Y}" font-family="Arial" font-size="14" font-weight="400" fill="#5a6280">${BARCODE_PAGE_LOCK.text.vehiclePlate}</text>
  <text x="${GENERATED_BOTTOM_CARD_RIGHT - 18}" y="${GENERATED_INFO_BOTTOM_LABEL_Y}" text-anchor="end" font-family="Arial" font-size="14" font-weight="500" fill="#1e2647" letter-spacing="0.4">${escapeXml(plate)}</text>
</svg>`;
}

export default function PlacasCarros() {
  const { width } = useWindowDimensions();
  const [barcodeResultMode, setBarcodeResultMode] = useState(false);
  const [barcodeName, setBarcodeName] = useState("RONALD MAC DONALDS");
  const [barcodeId, setBarcodeId] = useState("010102");
  const [barcodeVehicleType, setBarcodeVehicleType] = useState("VUC");
  const [barcodePlate, setBarcodePlate] = useState("TDH9J46");
  const [resultName, setResultName] = useState("RONALD MAC DONALDS");
  const [resultId, setResultId] = useState("010102");
  const [resultVehicleType, setResultVehicleType] = useState("VUC");
  const [resultPlate, setResultPlate] = useState("TDH9J46");
  const [targetLogin, setTargetLogin] = useState("");
  const [imageTarget, setImageTarget] = useState<"Placa 1" | "Placa 2">("Placa 1");
  const [sending, setSending] = useState(false);
  const { largeScreen, largePhone, barcodeHeight, barcodeWidth } = getLockedBarcodeMetrics(width);
  const resultBarcodeWidth = largeScreen ? Math.min(292, barcodeWidth) : barcodeWidth;
  const resultBarcodeHeight = largeScreen ? Math.min(96, barcodeHeight) : barcodeHeight;

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      (async () => {
        const placa2Active = await getPlaca2Active();
        if (!active) return;
        setImageTarget(placa2Active ? "Placa 2" : "Placa 1");
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  function gerarCodigoBarras() {
    const nome = (barcodeName.trim() || "MOTORISTA").toUpperCase();
    const id = barcodeId.trim() || "000000";
    const tipo = (barcodeVehicleType.trim() || "VUC").toUpperCase();
    const placa = (barcodePlate.trim() || "---").toUpperCase();
    void buildPlateSvgMarkupRefined({
      name: nome,
      id,
      vehicleType: tipo,
      plate: placa,
    });

    setResultName(nome);
    setResultId(id);
    setResultVehicleType(tipo);
    setResultPlate(placa);
    setBarcodeResultMode(true);
  }

  async function enviarCodigoGerado() {
    const login = normalizeLogin(targetLogin);
    if (!login) {
      Alert.alert("Login obrigatorio", "Digite o login que vai receber o codigo de barras.");
      return;
    }

    const nome = (barcodeName.trim() || "MOTORISTA").toUpperCase();
    const id = barcodeId.trim() || "000000";
    const tipo = (barcodeVehicleType.trim() || "VUC").toUpperCase();
    const placa = (barcodePlate.trim() || "---").toUpperCase();
    const svgMarkup = buildPlateSvgMarkupRefined({
      name: nome,
      id,
      vehicleType: tipo,
      plate: placa,
    });
    const imageDataUrl = svgMarkupToDataUrl(svgMarkup);

    try {
      setSending(true);
      await applyGeneratedPlateToUser(
        login,
        imageTarget === "Placa 2" ? "placa2" : "placa",
        imageDataUrl
      );
      Alert.alert(
        "Codigo enviado",
        `${imageTarget} enviada para o login ${login}.`
      );
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Nao foi possivel enviar o codigo gerado.";
      const message = /applygeneratedplate|applyGeneratedPlateToUser|generated-plate/i.test(rawMessage)
        ? "Nao foi possivel enviar a placa gerada para este login. Verifique o servidor e tente novamente."
        : rawMessage;
      Alert.alert("Erro ao enviar", message);
    } finally {
      setSending(false);
    }
  }

  function voltar() {
    if (barcodeResultMode) {
      setBarcodeResultMode(false);
      return;
    }
    router.back();
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, largePhone ? styles.topbarLargePhone : null]}>
        <View style={[styles.topbarContent, largeScreen ? styles.topbarContentLarge : null]}>
          <Pressable onPress={voltar} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#2d3561" />
          </Pressable>
          <Text style={styles.title}>
            {barcodeResultMode ? BARCODE_PAGE_LOCK.text.resultTitle : "Placas de carros"}
          </Text>
        </View>
      </View>

      {!barcodeResultMode ? (
        <KeyboardAvoidingView
          style={styles.keyboardArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.body,
              styles.formScrollContent,
              largePhone ? styles.bodyLargePhone : null,
              largeScreen ? styles.bodyLarge : null,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Dados do motorista</Text>
            <View style={styles.formCard}>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Nome</Text>
                <TextInput
                  value={barcodeName}
                  onChangeText={(value) => setBarcodeName(value.toUpperCase())}
                  placeholder="Nome completo"
                  placeholderTextColor="#c5cad8"
                  autoCapitalize="characters"
                  style={styles.formInput}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Numero / ID</Text>
                <TextInput
                  value={barcodeId}
                  onChangeText={(value) => setBarcodeId(value.toUpperCase())}
                  placeholder="Ex: 111091"
                  placeholderTextColor="#c5cad8"
                  autoCapitalize="characters"
                  style={styles.formInput}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Dados do veiculo</Text>
            <View style={styles.formCard}>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Tipo do veiculo</Text>
                <TextInput
                  value={barcodeVehicleType}
                  onChangeText={(value) => setBarcodeVehicleType(value.toUpperCase())}
                  placeholder="Ex: VUC"
                  placeholderTextColor="#c5cad8"
                  autoCapitalize="characters"
                  style={styles.formInput}
                />
              </View>
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>Placa do veiculo</Text>
                <TextInput
                  value={barcodePlate}
                  onChangeText={(value) => setBarcodePlate(value.toUpperCase())}
                  placeholder="Ex: LSA8I35"
                  placeholderTextColor="#c5cad8"
                  autoCapitalize="characters"
                  style={styles.formInput}
                />
              </View>
            </View>

            <Pressable style={styles.generateBtn} onPress={gerarCodigoBarras}>
              <View style={styles.generateBtnBars} pointerEvents="none">
                {GENERATE_BUTTON_BARS.map((kind, index) => (
                  <View
                    key={`${kind}-${index}`}
                    style={[
                      styles.generateStripeBase,
                      kind === "hair"
                        ? styles.generateStripeHair
                        : kind === "thin"
                          ? styles.generateStripeThin
                          : kind === "medium"
                            ? styles.generateStripeMedium
                            : styles.generateStripeWide,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.generateBtnCenterMask} pointerEvents="none" />
              <Text style={styles.generateBtnText}>Gerar codigo de barras</Text>
            </Pressable>
            <Text style={styles.generateHint}>O codigo gerado e funcional.</Text>
            <View style={styles.targetCard}>
              <Text style={styles.targetLabel}>Login que vai receber</Text>
              <TextInput
                value={targetLogin}
                onChangeText={(value) => setTargetLogin(normalizeLogin(value))}
                placeholder="Digite o login do usuario"
                placeholderTextColor="#c5cad8"
                keyboardType="number-pad"
                style={styles.targetInput}
              />
            </View>
            <View style={styles.targetCard}>
              <Text style={styles.targetLabel}>Tela que vai receber esta imagem</Text>
              <View style={styles.targetOptionsRow}>
                <Pressable
                  onPress={() => setImageTarget("Placa 1")}
                  style={[
                    styles.targetOption,
                    imageTarget === "Placa 1" ? styles.targetOptionActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.targetOptionText,
                      imageTarget === "Placa 1" ? styles.targetOptionTextActive : null,
                    ]}
                  >
                    Placa 1
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setImageTarget("Placa 2")}
                  style={[
                    styles.targetOption,
                    imageTarget === "Placa 2" ? styles.targetOptionActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.targetOptionText,
                      imageTarget === "Placa 2" ? styles.targetOptionTextActive : null,
                    ]}
                  >
                    Placa 2
                  </Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={enviarCodigoGerado}
              disabled={sending}
              style={[styles.sendBtn, sending ? styles.sendBtnDisabled : null]}
            >
              <Text style={styles.sendBtnText}>
                {sending ? "Enviando..." : "Enviar para o login informado"}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.body, largePhone ? styles.bodyLargePhone : null, largeScreen ? styles.bodyLarge : null]}>
          <View style={[styles.resultCard, largePhone ? styles.resultCardLargePhone : null, largeScreen ? styles.resultCardLarge : null]}>
            <Text style={[styles.personName, largePhone ? styles.personNameLargePhone : null]}>{resultName}</Text>
            <Text style={[styles.personId, largePhone ? styles.personIdLargePhone : null]}>{resultId}</Text>
            <View
              style={[
                styles.barcodeWrap,
                largePhone ? styles.barcodeWrapLargePhone : null,
                largeScreen ? styles.barcodeWrapLargeScreen : null,
              ]}
            >
              <Code128Barcode
                value={resultId}
                width={resultBarcodeWidth}
                height={resultBarcodeHeight}
                quietZone={0}
              />
            </View>
          </View>

          <View style={[styles.infoCard, largeScreen ? styles.infoCardLarge : null]}>
            <View style={[styles.infoRow, largePhone ? styles.infoRowLargePhone : null]}>
              <Text style={styles.infoLabel}>{BARCODE_PAGE_LOCK.text.vehicleType}</Text>
              <Text style={styles.infoValue}>{resultVehicleType}</Text>
            </View>
            <View style={[styles.infoRow, largePhone ? styles.infoRowLargePhone : null, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>{BARCODE_PAGE_LOCK.text.vehiclePlate}</Text>
              <Text style={styles.infoValue}>{resultPlate}</Text>
            </View>
          </View>

        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f0f2f6",
  },
  topbar: {
    backgroundColor: "#fff",
    paddingTop: BARCODE_PAGE_LOCK.layout.topbar.paddingTop,
    paddingBottom: BARCODE_PAGE_LOCK.layout.topbar.paddingBottom,
    paddingHorizontal: BARCODE_PAGE_LOCK.layout.topbar.paddingHorizontal,
    borderBottomWidth: 1,
    borderBottomColor: "#e8ecf2",
  },
  topbarLargePhone: {
    paddingTop: BARCODE_PAGE_LOCK.layout.topbarLargePhone.paddingTop,
    paddingBottom: BARCODE_PAGE_LOCK.layout.topbarLargePhone.paddingBottom,
    paddingHorizontal: BARCODE_PAGE_LOCK.layout.topbarLargePhone.paddingHorizontal,
  },
  topbarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    width: "100%",
  },
  topbarContentLarge: {
    maxWidth: 640,
    alignSelf: "center",
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "400",
    color: "#2d3561",
    letterSpacing: 0.1,
  },
  body: {
    flex: 1,
    paddingHorizontal: BARCODE_PAGE_LOCK.layout.body.paddingHorizontal,
    paddingVertical: BARCODE_PAGE_LOCK.layout.body.paddingVertical,
    gap: BARCODE_PAGE_LOCK.layout.body.gap,
  },
  keyboardArea: {
    flex: 1,
  },
  formScrollContent: {
    paddingBottom: 36,
  },
  bodyLargePhone: {
    paddingHorizontal: BARCODE_PAGE_LOCK.layout.bodyLargePhone.paddingHorizontal,
    paddingVertical: BARCODE_PAGE_LOCK.layout.bodyLargePhone.paddingVertical,
    gap: BARCODE_PAGE_LOCK.layout.bodyLargePhone.gap,
  },
  bodyLarge: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  sectionTitle: {
    fontSize: 11,
    color: "#9ba3be",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e9f0",
    overflow: "hidden",
  },
  formRow: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f5",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  formLabel: {
    minWidth: 125,
    fontSize: 14,
    color: "#5a6280",
  },
  formInput: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    color: "#1e2647",
    fontWeight: "500",
  },
  generateBtn: {
    marginTop: 4,
    backgroundColor: "#111827",
    borderRadius: 14,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  generateBtnText: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 1.6,
    zIndex: 2,
    textShadowColor: "#dc2626",
    textShadowOffset: {
      width: 0,
      height: 0,
    },
    textShadowRadius: 2.2,
  },
  generateBtnBars: {
    position: "absolute",
    left: 4,
    right: 4,
    top: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "stretch",
    opacity: 0.95,
  },
  generateBtnCenterMask: {
    position: "absolute",
    top: 8,
    bottom: 8,
    left: "16%",
    right: "16%",
    backgroundColor: "rgba(17,24,39,0.74)",
    borderRadius: 10,
    zIndex: 1,
  },
  generateHint: {
    marginTop: 2,
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
  },
  targetCard: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e9f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
    gap: 4,
  },
  targetLabel: {
    fontSize: 12,
    color: "#9ba3be",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  targetInput: {
    fontSize: 17,
    color: "#1e2647",
    fontWeight: "700",
  },
  targetOptionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  targetOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe1ec",
    backgroundColor: "#f7f9fc",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  targetOptionActive: {
    backgroundColor: "#1e2647",
    borderColor: "#1e2647",
  },
  targetOptionText: {
    fontSize: 15,
    color: "#53607d",
    fontWeight: "700",
  },
  targetOptionTextActive: {
    color: "#ffffff",
  },
  sendBtn: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#1e2647",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sendBtnDisabled: {
    opacity: 0.65,
  },
  sendBtnText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  generateStripeBase: {
    backgroundColor: "#ffffff",
    flexShrink: 0,
  },
  generateStripeHair: {
    width: 1,
    marginRight: 2,
  },
  generateStripeThin: {
    width: 3,
    marginRight: 3,
  },
  generateStripeMedium: {
    width: 6,
    marginRight: 4,
  },
  generateStripeWide: {
    width: 10,
    marginRight: 5,
  },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: BARCODE_PAGE_LOCK.layout.resultCard.radius,
    borderWidth: BARCODE_PAGE_LOCK.layout.resultCard.borderWidth,
    borderColor: "#e5e9f0",
    paddingHorizontal: BARCODE_PAGE_LOCK.layout.resultCard.paddingHorizontal,
    paddingTop: BARCODE_PAGE_LOCK.layout.resultCard.paddingTop,
    paddingBottom: BARCODE_PAGE_LOCK.layout.resultCard.paddingBottom,
    alignItems: "center",
    width: "100%",
  },
  resultCardLargePhone: {
    paddingHorizontal: BARCODE_PAGE_LOCK.layout.resultCardLargePhone.paddingHorizontal,
    paddingTop: BARCODE_PAGE_LOCK.layout.resultCardLargePhone.paddingTop,
    paddingBottom: BARCODE_PAGE_LOCK.layout.resultCardLargePhone.paddingBottom,
  },
  resultCardLarge: {
    maxWidth: BARCODE_PAGE_LOCK.layout.resultCardLarge.maxWidth,
    alignSelf: "center",
    width: "100%",
  },
  personName: {
    fontSize: BARCODE_PAGE_LOCK.layout.personName.fontSize,
    fontWeight: "600",
    color: "#1e2647",
    letterSpacing: BARCODE_PAGE_LOCK.layout.personName.letterSpacing,
    textAlign: "center",
    marginBottom: BARCODE_PAGE_LOCK.layout.personName.marginBottom,
  },
  personNameLargePhone: {
    fontSize: BARCODE_PAGE_LOCK.layout.personNameLargePhone.fontSize,
    marginBottom: BARCODE_PAGE_LOCK.layout.personNameLargePhone.marginBottom,
  },
  personId: {
    fontSize: BARCODE_PAGE_LOCK.layout.personId.fontSize,
    fontWeight: "400",
    color: "#9ba3be",
    letterSpacing: BARCODE_PAGE_LOCK.layout.personId.letterSpacing,
    marginBottom: BARCODE_PAGE_LOCK.layout.personId.marginBottom,
  },
  personIdLargePhone: {
    marginBottom: BARCODE_PAGE_LOCK.layout.personIdLargePhone.marginBottom,
  },
  barcodeWrap: {
    width: "100%",
    alignItems: "center",
  },
  barcodeWrapLargePhone: {
    marginTop: BARCODE_PAGE_LOCK.layout.barcodeWrapLargePhone.marginTop,
  },
  barcodeWrapLargeScreen: {
    paddingHorizontal: 18,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e9f0",
    overflow: "hidden",
    width: "100%",
  },
  infoCardLarge: {
    maxWidth: BARCODE_PAGE_LOCK.layout.infoCardLarge.maxWidth,
    alignSelf: "center",
    width: "100%",
  },
  infoRow: {
    paddingHorizontal: BARCODE_PAGE_LOCK.layout.infoRow.paddingHorizontal,
    paddingVertical: BARCODE_PAGE_LOCK.layout.infoRow.paddingVertical,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoRowLargePhone: {
    paddingHorizontal: BARCODE_PAGE_LOCK.layout.infoRowLargePhone.paddingHorizontal,
    paddingVertical: BARCODE_PAGE_LOCK.layout.infoRowLargePhone.paddingVertical,
  },
  infoRowLast: {
    borderTopWidth: 1,
    borderTopColor: "#edf0f5",
  },
  infoLabel: {
    fontSize: 14,
    color: "#5a6280",
  },
  infoValue: {
    fontSize: 14,
    color: "#1e2647",
    fontWeight: "500",
    letterSpacing: 0.4,
    textAlign: "right",
  },
});
