import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, NativeScrollEvent, NativeSyntheticEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path, Polyline, Rect } from "react-native-svg";
import { WebView } from "react-native-webview";
import { RefreshAnimado, useRefreshAnimado } from "../components/refresh animado";
import {
  getAllScannedOccurrences,
  getTela2Variant,
  getTela3OccurrenceCount,
  getScannedOccurrence,
  getTela3PrimaryScreen,
  setTela3OccurrenceCount,
  setTela3PrimaryScreen,
  type ScannedOccurrence,
  type Tela3PrimaryScreen,
} from "../lib/devStorage";
import { getTela2EmRotaTotal } from "../lib/tela2EmRotaMeta";
import { TELA2_HTML } from "../lib/tela2WebViewHtml";
import { saveSelectedPedidoInfo } from "../lib/telaPedidoInfoHtml";

const dados = {
  pendente: 0,
  ocorrencias: [
    {
      codigo: "BR26308889 4891K",
      endereco: "Rua Mario Neves, 1, EcoPonte / Sampaio - Trafego",
      pessoa: "Gabriel Sampaio_",
      status: "Comercio Fechado",
      data: "18-04-2026 11:13",
    },
    {
      codigo: "BR26861768 7071X",
      endereco: "Travessa George Alan, 3, Bar do Brito no campo",
      pessoa: "Yasmim Goncalves Da Silva_",
      status: "Comercio Fechado",
      data: "18-04-2026 11:13",
    },
    {
      codigo: "BR27012894 5530W",
      endereco: "Alameda Paris, 110, Icarai",
      pessoa: "Lucas Ferreira_",
      status: "Comercio Fechado",
      data: "19-04-2026 10:48",
    },
    {
      codigo: "BR27108653 9914E",
      endereco: "Rua Voluntarios da Patria, 220, Botafogo",
      pessoa: "Fernanda Lima_",
      status: "Endereco nao encontrado",
      data: "19-04-2026 11:00",
    },
    {
      codigo: "BR27201337 4421K",
      endereco: "Rua Comendador Queiroz, 8, Niteroi",
      pessoa: "Weslla Lima Gomes_",
      status: "Comercio Fechado",
      data: "19-04-2026 11:13",
    },
  ],
} as const;
const MAX_OCORRENCIAS = 15;
const DEFAULT_OCCURRENCES = 15;
const EMPTY_STATE_BG = "#eef0f5";
const TELA2_IMAGE_BASE64 =
  TELA2_HTML.match(/img\.src = 'data:image\/jpeg;base64,([^']+)'/) ?.[1] ?? "";

const EMPTY_STATE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${EMPTY_STATE_BG};
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .wrap {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 12px;
    }
    canvas {
      width: 220px;
      height: auto;
      display: block;
      background: transparent;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <canvas id="illus"></canvas>
  </div>
  <script>
    (function () {
      var img = new Image();
      img.onload = function () {
        var c = document.getElementById("illus");
        c.width = img.width;
        c.height = img.height;
        var ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        var id = ctx.getImageData(0, 0, c.width, c.height);
        var d = id.data;
        for (var i = 0; i < d.length; i += 4) {
          var r = d[i], g = d[i + 1], b = d[i + 2];
          if (r > 220 && g > 224 && b > 230 && r < 250 && g < 252 && b < 255) {
            d[i] = 238;
            d[i + 1] = 240;
            d[i + 2] = 245;
            d[i + 3] = 255;
          }
        }
        ctx.putImageData(id, 0, 0);
      };
      img.src = 'data:image/jpeg;base64,${TELA2_IMAGE_BASE64}';
    })();
  </script>
</body>
</html>`;

function getEncerradoCount() {
  const min = 2860;
  const max = 3562;
  const now = new Date();
  const seed = Number(
    String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0")
  );
  const x = Math.sin(seed) * 10000;
  const rnd = x - Math.floor(x);
  return Math.floor(rnd * (max - min + 1)) + min;
}

function DeliveryBadgeIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3.25" y="7.6" width="17.5" height="11.8" rx="2.2" stroke="#687487" strokeWidth="1.8" />
      <Path d="M5.2 7.6 7.15 4.9h9.7l1.95 2.7" stroke="#687487" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 16.6v-5.8" stroke="#687487" strokeWidth="1.8" strokeLinecap="round" />
      <Polyline points="9.5,13.2 12,10.7 14.5,13.2" stroke="#687487" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function Tela3() {
  const params = useLocalSearchParams<{ editCount?: string }>();
  const [telaPrincipal, setTelaPrincipal] = useState<Tela3PrimaryScreen | null>(null);
  const [emRotaLabelCount, setEmRotaLabelCount] = useState<number>(dados.pendente);
  const [ocorrenciasCapturadas, setOcorrenciasCapturadas] = useState<Record<number, ScannedOccurrence>>({});
  const [quantidadeOcorrencias, setQuantidadeOcorrencias] = useState<number>(DEFAULT_OCCURRENCES);
  const [modalQuantidadeVisivel, setModalQuantidadeVisivel] = useState(false);
  const [quantidadeInput, setQuantidadeInput] = useState(String(DEFAULT_OCCURRENCES));
  const refreshAnimado = useRefreshAnimado();
  const scrollOffsetYRef = useRef(0);
  const lastCustomRefreshAtRef = useRef(0);
  const encerradoCount = getEncerradoCount();
  const swipePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      (Math.abs(gestureState.dx) > Math.abs(gestureState.dy) + 8 &&
        Math.abs(gestureState.dx) > 16) ||
      (gestureState.dy > Math.abs(gestureState.dx) + 8 &&
        gestureState.dy > 16),
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx >= 24) {
        router.push("/tela2");
        return;
      }

      if (gestureState.dx <= -24) {
        router.push("/tela9");
        return;
      }

      if (
        gestureState.dy >= 28 &&
        Math.abs(gestureState.dx) <= 32 &&
        scrollOffsetYRef.current <= 0
      ) {
        const now = Date.now();
        if (now - lastCustomRefreshAtRef.current > 650) {
          lastCustomRefreshAtRef.current = now;
          onRefresh();
        }
      }
    },
  });

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregarOcorrenciasCapturadas() {
        const principal = await getTela3PrimaryScreen();
        const tela2Variant = await getTela2Variant();
        const emRotaTotal = await getTela2EmRotaTotal();
        const ocorrenciasPorIndice = await getAllScannedOccurrences();
        const ocorrenciasPorLeituraDireta = await Promise.all(
          Array.from({ length: MAX_OCORRENCIAS }, (_, index) => getScannedOccurrence(index))
        );
        const fallbackPrimeiroCard = await getScannedOccurrence();
        const quantidadeSalva = await getTela3OccurrenceCount(DEFAULT_OCCURRENCES);
        const ocorrenciasMescladas = { ...ocorrenciasPorIndice } as Record<number, ScannedOccurrence>;
        ocorrenciasPorLeituraDireta.forEach((item, index) => {
          if (item?.codigo) {
            ocorrenciasMescladas[index] = item;
          }
        });

        if (ativo) {
          setTelaPrincipal(principal);
          setEmRotaLabelCount(
            tela2Variant === "em-rota" ? emRotaTotal : dados.pendente
          );
          setQuantidadeOcorrencias(quantidadeSalva);
          setOcorrenciasCapturadas(
            fallbackPrimeiroCard && !ocorrenciasMescladas[0]
              ? { 0: fallbackPrimeiroCard, ...ocorrenciasMescladas }
              : ocorrenciasMescladas
          );
        }
      }

      carregarOcorrenciasCapturadas();

      return () => {
        ativo = false;
      };
    }, [])
  );

  const ocorrenciasBase = dados.ocorrencias.map((item, index) =>
    ocorrenciasCapturadas[index]
      ? {
          ...item,
          codigo: ocorrenciasCapturadas[index].codigo,
          endereco: ocorrenciasCapturadas[index].endereco?.trim() || item.endereco,
          pessoa: ocorrenciasCapturadas[index].pessoa?.trim() || item.pessoa,
          status: ocorrenciasCapturadas[index].status?.trim() || item.status,
          data: ocorrenciasCapturadas[index].statusDate?.trim() || item.data,
        }
      : item
  );

  const ocorrencias = Array.from({ length: quantidadeOcorrencias }, (_, index) => {
    if (ocorrenciasBase[index]) return ocorrenciasBase[index];

    const capturada = ocorrenciasCapturadas[index];
    if (capturada) {
      return {
        codigo: capturada.codigo || `SEM CODIGO ${index + 1}`,
        endereco: capturada.endereco?.trim() || "Endereço da ocorrência",
        pessoa: capturada.pessoa?.trim() || "Pessoa nao informada",
        status: capturada.status?.trim() || "Ocorrência pendente",
        data: capturada.statusDate?.trim() || "--",
      };
    }

    return {
      codigo: `SEM CODIGO ${index + 1}`,
      endereco: "Endereço da ocorrência",
      pessoa: "Pessoa nao informada",
      status: "Ocorrência pendente",
      data: "--",
    };
  });

  async function ativarTela30() {
    await setTela3PrimaryScreen("tela30");
    router.replace("/tela3-imagem");
  }

  function onRefresh() {
    refreshAnimado.iniciarAnimacao();
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
  }

  function abrirEditorQuantidade() {
    setQuantidadeInput(String(quantidadeOcorrencias));
    setModalQuantidadeVisivel(true);
  }

  useEffect(() => {
    if (params.editCount === "1") {
      setQuantidadeInput(String(quantidadeOcorrencias));
      setModalQuantidadeVisivel(true);
    }
  }, [params.editCount, quantidadeOcorrencias]);

  async function salvarQuantidade() {
    const numero = Number.parseInt(quantidadeInput.trim(), 10);
    if (!Number.isFinite(numero) || numero < 0) {
      return;
    }
    const limite = Math.max(0, Math.min(numero, MAX_OCORRENCIAS));
    const persisted = await setTela3OccurrenceCount(limite);
    setQuantidadeOcorrencias(persisted);
    setModalQuantidadeVisivel(false);
    if (persisted === 0) {
      await setTela3PrimaryScreen("tela30");
      router.replace("/tela3-imagem");
    }
  }

  if (!telaPrincipal) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen} {...swipePanResponder.panHandlers}>
      <View style={styles.statusbar} />

      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <Pressable onPress={() => router.push("/tela6")} style={styles.hamburger}>
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
          </Pressable>

          <View style={styles.brandPill}>
            <DeliveryBadgeIcon />
            <Text style={styles.brandText}>Entrega</Text>
          </View>
        </View>

        <View style={styles.topbarRight}>
          <Pressable
            onLongPress={ativarTela30}
            delayLongPress={2500}
            style={styles.topbarIconButton}
          />
          <MaterialIcons name="search" size={22} color="#333" />
          <MaterialIcons name="notifications-none" size={22} color="#333" />
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable onPress={() => router.push("/tela2")} style={styles.tab}>
          <Text style={styles.tabText}>Em Rota ({emRotaLabelCount})</Text>
        </Pressable>

        <Pressable onLongPress={abrirEditorQuantidade} delayLongPress={3000} style={[styles.tab, styles.activeTab]}>
          <Text style={styles.activeTabText}>Ocorrência ({ocorrencias.length})</Text>
          <View style={styles.activeUnderline} />
        </Pressable>

        <Pressable onPress={() => router.push("/tela9")} style={styles.tab}>
          <Text style={styles.tabText}>Encerrado ({encerradoCount})</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          ocorrencias.length === 0 && styles.contentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {ocorrencias.length === 0 ? (
          <View style={styles.emptyStateWrap}>
            <WebView
              source={{ html: EMPTY_STATE_HTML }}
              originWhitelist={["*"]}
              scrollEnabled={false}
              bounces={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              overScrollMode="never"
              style={styles.emptyStateWebView}
              containerStyle={styles.emptyStateWebView}
              androidLayerType="software"
            />
          </View>
        ) : (
          ocorrencias.map((item, index) => (
            <Pressable
              key={`${item.codigo}-${index}`}
              onPress={() => {
                void saveSelectedPedidoInfo({
                  num: String(index + 1),
                  sequenceValue: null,
                  stopValue: null,
                  code: item.codigo,
                  atId: "",
                  address: item.endereco,
                  recipient: item.pessoa,
                  phone: "",
                  hub: "LM Hub_RJ_Sao Goncalo_02",
                  district: "",
                  city: "",
                  zipcode: "",
                  latitude: "",
                  longitude: "",
                  tags: [item.status, item.data].filter(Boolean),
                  sourceType: "occurrence",
                }).then(() => {
                  router.push("/pedido-info");
                });
              }}
              onLongPress={() =>
                router.push({
                  pathname: "/tela13",
                  params: { index: String(index) },
                })
              }
              delayLongPress={2500}
              style={styles.card}
            >
              <View style={styles.cardIdRow}>
                <Text style={styles.cardId}>{item.codigo}</Text>
                <MaterialIcons name="content-copy" size={16} color="#888" />
              </View>

              <View style={styles.addrRow}>
                <MaterialIcons
                  name="location-on"
                  size={15}
                  color="#777"
                  style={styles.pinIcon}
                />
                <Text style={styles.addrText}>{item.endereco}</Text>
              </View>

              <Text style={styles.person}>{item.pessoa}</Text>

              <View style={styles.statusRow}>
                <View style={styles.statusDot}>
                  <View style={styles.statusDash} />
                </View>
                <Text style={styles.statusText}>{item.status}</Text>
                <Text style={styles.statusDate}>{item.data}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <RefreshAnimado
        visible={refreshAnimado.visible}
        fadeAnim={refreshAnimado.fadeAnim}
        spin={refreshAnimado.spin}
      />

      <Modal visible={modalQuantidadeVisivel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Quantidade de ocorrências</Text>
            <TextInput
              value={quantidadeInput}
              onChangeText={setQuantidadeInput}
              keyboardType="number-pad"
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalAcoes}>
              <Pressable onPress={() => setModalQuantidadeVisivel(false)}>
                <Text style={styles.modalAcaoTexto}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={salvarQuantidade}>
                <Text style={styles.modalAcaoTexto}>Salvar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: EMPTY_STATE_BG,
  },

  statusbar: {
    backgroundColor: "#fff",
    height: 36,
  },

  topbar: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
  },

  topbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  hamburger: {
    gap: 4,
  },

  hamburgerLine: {
    width: 20,
    height: 2,
    backgroundColor: "#333",
    borderRadius: 2,
  },

  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#f2f2f2",
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 14,
  },

  brandText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#687487",
  },

  topbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  topbarIconButton: {
    position: "absolute",
    right: 0,
    top: -36,
    width: 64,
    height: 88,
    borderRadius: 14,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  tabs: {
    backgroundColor: "#fff",
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#e5e5e5",
  },

  tab: {
    flex: 1,
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 10,
    position: "relative",
  },

  tabText: {
    fontSize: 14,
    color: "#888",
  },

  activeTab: {
    position: "relative",
  },

  activeTabText: {
    fontSize: 14,
    color: "#222",
    fontWeight: "500",
  },

  activeUnderline: {
    position: "absolute",
    bottom: -1.5,
    left: "10%",
    width: "80%",
    height: 2.5,
    backgroundColor: "#e85d2a",
    borderRadius: 2,
  },

  scroll: {
    flex: 1,
    backgroundColor: EMPTY_STATE_BG,
  },

  content: {
    padding: 12,
    paddingBottom: 72,
    gap: 10,
    backgroundColor: EMPTY_STATE_BG,
  },

  contentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },

  emptyStateWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 0,
    paddingBottom: 72,
    backgroundColor: EMPTY_STATE_BG,
  },

  emptyStateWebView: {
    width: 260,
    height: 220,
    backgroundColor: EMPTY_STATE_BG,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingTop: 14,
    paddingRight: 16,
    paddingBottom: 14,
    paddingLeft: 16,
  },

  cardIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  cardId: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },

  addrRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginBottom: 6,
  },

  pinIcon: {
    marginTop: 1,
  },

  addrText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: "#333",
    fontWeight: "600",
  },

  person: {
    fontSize: 14,
    color: "#868686",
    marginBottom: 14,
    marginLeft: 22,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 2,
  },

  statusDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ffd65a",
    alignItems: "center",
    justifyContent: "center",
  },

  statusDash: {
    width: 8,
    height: 2,
    backgroundColor: "#fff",
    borderRadius: 2,
  },

  statusText: {
    fontSize: 13,
    color: "#f0b400",
    fontWeight: "500",
  },

  statusDate: {
    fontSize: 12,
    color: "#caa24d",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },

  modalTitulo: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },

  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#222",
  },

  modalAcoes: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
  },

  modalAcaoTexto: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e85d2a",
  },
});

