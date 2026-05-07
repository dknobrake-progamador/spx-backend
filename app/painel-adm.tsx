import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiRequest } from "../lib/apiClient";
import { getAuthIdToken } from "../lib/devStorage";

type AdminUser = {
  uid: string;
  phone: string;
  role: "user" | "admin2" | "master";
  active: boolean;
  editMode: boolean;
  editScope: "none" | "tela4" | "all";
};

type AdminAccessResponse = {
  ok: boolean;
  access: "master" | "admin2";
  registrationEnabled: boolean;
};

type AdminConfigResponse = {
  ok: boolean;
  registrationEnabled: boolean;
};

type SignupRequest = {
  uid: string;
  phone: string;
  status: "pending" | "approved" | "blocked" | "deleted";
  requestedAtIso: string;
  updatedAtIso: string;
};

export default function PainelAdm() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [updatingSignupUid, setUpdatingSignupUid] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [signupRequests, setSignupRequests] = useState<SignupRequest[]>([]);

  const visibleUsers = useMemo(
    () => users.filter((user) => user.role !== "master"),
    [users]
  );
  const pendingSignupRequests = useMemo(
    () => signupRequests.filter((item) => item.status === "pending"),
    [signupRequests]
  );

  const carregarPainel = useCallback(async () => {
    const idToken = await getAuthIdToken();
    if (!idToken) {
      setUsers([]);
      setErrorMessage("Sessao administrativa indisponivel.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const access = await apiRequest<AdminAccessResponse>("/admin/access", {
        idToken,
        timeoutMs: 30000,
      });
      if (access.access !== "master" && access.access !== "admin2") {
        throw new Error("Painel indisponivel.");
      }

      const [config, data, requests] = await Promise.all([
        apiRequest<AdminConfigResponse>("/admin/config", {
          idToken,
          timeoutMs: 30000,
        }),
        apiRequest<{ ok: boolean; users: AdminUser[] }>("/admin/users", {
          idToken,
          timeoutMs: 30000,
        }),
        apiRequest<{ ok: boolean; requests: SignupRequest[] }>("/admin/signup-requests", {
          idToken,
          timeoutMs: 30000,
        }),
      ]);

      setRegistrationEnabled(config.registrationEnabled);
      setUsers(data.users);
      setSignupRequests(requests.requests);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar painel.";
      setUsers([]);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarPainel().catch(() => undefined);
    }, [carregarPainel])
  );

  async function atualizarSolicitacaoCadastro(
    uid: string,
    action: "approve" | "block" | "delete"
  ) {
    const idToken = await getAuthIdToken();
    if (!idToken) return;

    setUpdatingSignupUid(uid);
    try {
      const data = await apiRequest<{ ok: boolean; request: SignupRequest }>(
        `/admin/signup-requests/${encodeURIComponent(uid)}`,
        {
          method: "PATCH",
          idToken,
          timeoutMs: 30000,
          body: { action },
        }
      );

      setSignupRequests((current) =>
        current.map((item) => (item.uid === uid ? { ...item, status: data.request.status } : item))
      );

      if (action === "approve") {
        await carregarPainel();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar solicitacao.";
      setErrorMessage(message);
    } finally {
      setUpdatingSignupUid(null);
    }
  }

  async function atualizarUsuario(uid: string, patch: Partial<Pick<AdminUser, "active" | "editScope" | "editMode">>) {
    const idToken = await getAuthIdToken();
    if (!idToken) return;

    const previous = users;
    setUpdatingUid(uid);
    setUsers((current) => current.map((user) => (user.uid === uid ? { ...user, ...patch } : user)));

    try {
      const data = await apiRequest<{ ok: boolean; user: AdminUser }>(`/admin/users/${encodeURIComponent(uid)}`, {
        method: "PATCH",
        idToken,
        timeoutMs: 30000,
        body: patch,
      });
      setUsers((current) => current.map((user) => (user.uid === uid ? data.user : user)));
    } catch {
      setUsers(previous);
    } finally {
      setUpdatingUid(null);
    }
  }

  async function alternarCadastro() {
    const idToken = await getAuthIdToken();
    if (!idToken) return;

    const next = !registrationEnabled;
    setSavingConfig(true);
    setRegistrationEnabled(next);
    try {
      const data = await apiRequest<AdminConfigResponse>("/admin/config", {
        method: "PATCH",
        idToken,
        timeoutMs: 30000,
        body: {
          registrationEnabled: next,
        },
      });
      setRegistrationEnabled(data.registrationEnabled);
    } catch {
      setRegistrationEnabled((current) => !current);
    } finally {
      setSavingConfig(false);
    }
  }

  function confirmarExcluirTelas(uid: string, phone: string) {
    Alert.alert(
      "Excluir todas as telas",
      `Remover todas as telas/fotos de ${phone}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => excluirTelasUsuario(uid),
        },
      ]
    );
  }

  async function excluirTelasUsuario(uid: string) {
    const idToken = await getAuthIdToken();
    if (!idToken) return;

    setUpdatingUid(uid);
    try {
      await apiRequest<{ ok: boolean; uid: string; cleared: boolean }>(
        `/admin/users/${encodeURIComponent(uid)}/clear-screens`,
        {
          method: "POST",
          idToken,
          timeoutMs: 30000,
        }
      );
      Alert.alert("Telas excluidas", "Todas as telas/fotos desse usuario foram removidas.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao excluir telas.";
      setErrorMessage(message);
      Alert.alert("Erro", message);
    } finally {
      setUpdatingUid(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={visibleUsers}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        ListHeaderComponent={
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backText}>Voltar</Text>
              </Pressable>
              <Text style={styles.eyebrow}>Painel administrativo</Text>
            </View>
            <Text style={styles.title}>Controle rapido</Text>
            <Text style={styles.heroText}>
              Edicao, acesso, cadastro e gerador operacional.
            </Text>

            <Pressable onPress={() => router.push("/placas-carros")} style={styles.primaryAction}>
              <Text style={styles.primaryActionText}>Placas de carros</Text>
            </Pressable>

            <View style={styles.controlCard}>
              <View style={styles.controlText}>
                <Text style={styles.controlTitle}>Autorizar cadastro</Text>
                <Text style={styles.controlHelper}>
                  Libera ou fecha a criacao de novos cadastros.
                </Text>
              </View>
              <Pressable
                onPress={alternarCadastro}
                disabled={savingConfig}
                style={[
                  styles.stateButton,
                  registrationEnabled ? styles.stateButtonGreen : styles.stateButtonRed,
                ]}
              >
                <Text style={styles.stateButtonText}>
                  {savingConfig ? "Salvando" : registrationEnabled ? "Ligado" : "Desligado"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.controlCardStack}>
              <Text style={styles.controlTitle}>
                Solicitacoes de cadastro ({pendingSignupRequests.length})
              </Text>
              {pendingSignupRequests.length === 0 ? (
                <Text style={styles.controlHelper}>Nenhuma solicitacao pendente.</Text>
              ) : (
                pendingSignupRequests.map((item) => (
                    <View key={item.uid} style={styles.requestCard}>
                      <View style={styles.requestPendingBadge}>
                        <Text style={styles.requestPendingBadgeText}>PENDENTE</Text>
                      </View>
                      <Text style={styles.requestPhone}>{item.phone}</Text>
                      <Text style={styles.requestMeta}>
                        {new Date(item.requestedAtIso).toLocaleString("pt-BR")}
                      </Text>
                      <View style={styles.requestActions}>
                        <Pressable
                          onPress={() => atualizarSolicitacaoCadastro(item.uid, "approve")}
                          disabled={updatingSignupUid === item.uid}
                          style={[styles.requestActionButton, styles.requestActionApprove]}
                        >
                          <Text style={styles.requestActionText}>Aceitar</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => atualizarSolicitacaoCadastro(item.uid, "block")}
                          disabled={updatingSignupUid === item.uid}
                          style={[styles.requestActionButton, styles.requestActionBlock]}
                        >
                          <Text style={styles.requestActionText}>Bloquear</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => atualizarSolicitacaoCadastro(item.uid, "delete")}
                          disabled={updatingSignupUid === item.uid}
                          style={[styles.requestActionButton, styles.requestActionDelete]}
                        >
                          <Text style={styles.requestActionText}>Excluir</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
              )}
            </View>

            {loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color="#facc15" />
              </View>
            ) : null}

            {!loading && errorMessage ? (
              <View style={styles.stateBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const busy = updatingUid === item.uid;
          const editing = item.editScope !== "none";
          return (
            <View style={styles.userCard}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.phone}>{item.phone}</Text>
                  <Text style={styles.uid}>Login: {item.uid}</Text>
                </View>
                {item.role === "admin2" ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Admin</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.controlCard}>
                <View style={styles.controlText}>
                  <Text style={styles.controlTitle}>Bloquear entrada</Text>
                  <Text style={styles.controlHelper}>
                    Ligado impede o acesso mesmo com a senha correta.
                  </Text>
                </View>
                <Pressable
                  onPress={() => atualizarUsuario(item.uid, { active: !item.active })}
                  disabled={busy}
                  style={[
                    styles.stateButton,
                    item.active ? styles.stateButtonGreen : styles.stateButtonRed,
                  ]}
                >
                  <Text style={styles.stateButtonText}>{item.active ? "Ligado" : "Desligado"}</Text>
                </Pressable>
              </View>

              <View style={styles.controlCard}>
                <View style={styles.controlText}>
                  <Text style={styles.controlTitle}>Edicao de placa</Text>
                  <Text style={styles.controlHelper}>
                    Libera apenas a edicao da Placa 1 no proximo acesso.
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    atualizarUsuario(item.uid, {
                      editScope: editing ? "none" : "tela4",
                      editMode: !editing,
                    })
                  }
                  disabled={busy}
                  style={[
                    styles.stateButton,
                    editing ? styles.stateButtonYellow : styles.stateButtonOff,
                  ]}
                >
                  <Text style={[styles.stateButtonText, editing ? styles.stateButtonTextDark : null]}>
                    {editing ? "Ligado" : "Desligado"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => confirmarExcluirTelas(item.uid, item.phone)}
                disabled={busy}
                style={styles.dangerAction}
              >
                <Text style={styles.dangerActionText}>Excluir todas as telas</Text>
              </Pressable>
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#06131f",
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  hero: {
    gap: 14,
    paddingBottom: 10,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    minHeight: 40,
    minWidth: 82,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1d4f73",
    backgroundColor: "#0a2234",
  },
  backText: {
    color: "#fafafa",
    fontSize: 13,
    fontWeight: "700",
  },
  eyebrow: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  title: {
    color: "#fafafa",
    fontSize: 28,
    fontWeight: "900",
  },
  heroText: {
    color: "#9fb3c8",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryAction: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0ea5e9",
  },
  primaryActionText: {
    color: "#03131e",
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  controlCard: {
    minHeight: 78,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1d4f73",
    backgroundColor: "#0a1c2b",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  controlCardStack: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1d4f73",
    backgroundColor: "#0a1c2b",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  controlText: {
    flex: 1,
    gap: 4,
  },
  controlTitle: {
    color: "#fafafa",
    fontSize: 15,
    fontWeight: "800",
  },
  controlHelper: {
    color: "#9fb3c8",
    fontSize: 13,
    lineHeight: 18,
  },
  requestCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#facc15",
    backgroundColor: "#2a240b",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  requestPendingBadge: {
    alignSelf: "flex-start",
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#facc15",
    marginBottom: 2,
  },
  requestPendingBadgeText: {
    color: "#09090b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  requestPhone: {
    color: "#fef08a",
    fontSize: 16,
    fontWeight: "900",
  },
  requestMeta: {
    color: "#9fb3c8",
    fontSize: 12,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  requestActionButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  requestActionApprove: {
    backgroundColor: "#0f766e",
  },
  requestActionBlock: {
    backgroundColor: "#9a3412",
  },
  requestActionDelete: {
    backgroundColor: "#7f1d1d",
  },
  requestActionText: {
    color: "#fafafa",
    fontSize: 12,
    fontWeight: "800",
  },
  stateButton: {
    minWidth: 110,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  stateButtonGreen: {
    backgroundColor: "#0f766e",
  },
  stateButtonRed: {
    backgroundColor: "#7f1d1d",
  },
  stateButtonYellow: {
    backgroundColor: "#38bdf8",
  },
  stateButtonOff: {
    backgroundColor: "#1e3a4f",
  },
  stateButtonText: {
    color: "#fafafa",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  stateButtonTextDark: {
    color: "#03131e",
  },
  stateBox: {
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: "#0a1c2b",
    borderWidth: 1,
    borderColor: "#1d4f73",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  errorText: {
    color: "#f87171",
    fontSize: 14,
    textAlign: "center",
  },
  userCard: {
    gap: 10,
    borderRadius: 24,
    backgroundColor: "#081826",
    borderWidth: 1,
    borderColor: "#1d4f73",
    padding: 16,
  },
  dangerAction: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#b91c1c",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  dangerActionText: {
    color: "#fafafa",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  phone: {
    color: "#fafafa",
    fontSize: 19,
    fontWeight: "800",
  },
  uid: {
    color: "#8aa3bb",
    fontSize: 12,
    marginTop: 3,
  },
  badge: {
    minHeight: 28,
    minWidth: 66,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#082f49",
    borderWidth: 1,
    borderColor: "#0ea5e9",
    paddingHorizontal: 12,
  },
  badgeText: {
    color: "#7dd3fc",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
