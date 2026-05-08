import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { RefreshAnimado, useRefreshAnimado } from "../components/refresh animado";
import {
  getAllScannedOccurrences,
  getTela3OccurrenceCount,
  getScannedOccurrence,
  getTela3PrimaryScreen,
  setTela3OccurrenceCount,
  setTela3PrimaryScreen,
  type ScannedOccurrence,
  type Tela3PrimaryScreen,
} from "../lib/devStorage";

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

export default function Tela3() {
  const [telaPrincipal, setTelaPrincipal] = useState<Tela3PrimaryScreen | null>(null);
  const [ocorrenciasCapturadas, setOcorrenciasCapturadas] = useState<Record<number, ScannedOccurrence>>({});
  const [quantidadeOcorrencias, setQuantidadeOcorrencias] = useState<number>(DEFAULT_OCCURRENCES);
  const [modalQuantidadeVisivel, setModalQuantidadeVisivel] = useState(false);
  const [quantidadeInput, setQuantidadeInput] = useState(String(DEFAULT_OCCURRENCES));
  const refreshAnimado = useRefreshAnimado();

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregarOcorrenciasCapturadas() {
        const principal = await getTela3PrimaryScreen();
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
        endereco: capturada.endereco?.trim() || "Endereco da ocorrencia",
        pessoa: capturada.pessoa?.trim() || "Pessoa nao informada",
        status: capturada.status?.trim() || "Ocorrencia pendente",
        data: capturada.statusDate?.trim() || "--",
      };
    }

    return {
      codigo: `SEM CODIGO ${index + 1}`,
      endereco: "Endereco da ocorrencia",
      pessoa: "Pessoa nao informada",
      status: "Ocorrencia pendente",
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

  function abrirEditorQuantidade() {
    setQuantidadeInput(String(quantidadeOcorrencias));
    setModalQuantidadeVisivel(true);
  }

  async function salvarQuantidade() {
    const numero = Number.parseInt(quantidadeInput.trim(), 10);
    if (!Number.isFinite(numero) || numero < 1) {
      return;
    }
    const limite = Math.min(numero, MAX_OCORRENCIAS);
    const persisted = await setTela3OccurrenceCount(limite);
    setQuantidadeOcorrencias(persisted);
    setModalQuantidadeVisivel(false);
  }

  if (!telaPrincipal) {
    return <View style={styles.screen} />;
  }

  if (telaPrincipal === "tela30") {
    return <Redirect href="/tela3-imagem" />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.statusbar} />

      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <Pressable onPress={() => router.push("/tela6")} style={styles.hamburger}>
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
          </Pressable>

          <View style={styles.brandPill}>
            <MaterialIcons name="inventory-2" size={18} color="#555" />
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
          <Text style={styles.tabText}>Pendente ({dados.pendente})</Text>
        </Pressable>

        <Pressable onLongPress={abrirEditorQuantidade} delayLongPress={5000} style={[styles.tab, styles.activeTab]}>
          <Text style={styles.activeTabText}>Ocorrencia ({ocorrencias.length})</Text>
          <View style={styles.activeUnderline} />
        </Pressable>

        <Pressable onPress={() => router.push("/tela9")} style={styles.tab}>
          <Text style={styles.tabText}>Encerrado</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            colors={["transparent"]}
            progressBackgroundColor="transparent"
            tintColor="transparent"
            titleColor="transparent"
            progressViewOffset={-1000}
          />
        }
      >
        {ocorrencias.map((item, index) => (
          <Pressable
            key={`${item.codigo}-${index}`}
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
        ))}
      </ScrollView>

      <RefreshAnimado
        visible={refreshAnimado.visible}
        fadeAnim={refreshAnimado.fadeAnim}
        spin={refreshAnimado.spin}
      />

      <Modal visible={modalQuantidadeVisivel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Quantidade de ocorrencias</Text>
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
    backgroundColor: "#f0f0f0",
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
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
    paddingHorizontal: 14,
  },

  brandText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#222",
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
  },

  content: {
    padding: 12,
    gap: 10,
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
