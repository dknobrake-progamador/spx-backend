import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FlexiblePhotoPreview } from "../components/flexible-photo-preview";
import { apiRequest } from "../lib/apiClient";
import { getAuthIdToken } from "../lib/devStorage";

type AdminUser = {
  uid: string;
  phone: string;
  role: "user" | "admin2" | "master";
  active: boolean;
  editMode: boolean;
  editScope: "none" | "tela4" | "all";
  mustChangePassword: boolean;
  canUploadPhotos: boolean;
  lastLoginAtIso: string;
  loginHistory: Array<{ atIso: string }>;
};

type UserPhotosResponse = {
  ok: boolean;
  exists: boolean;
  requiredComplete: boolean;
  hasPlaca: boolean;
  hasTela6: boolean;
  hasTela11: boolean;
  hasPlaca2: boolean;
  updatedAtIso: string;
  photos: Partial<Record<"placa" | "placa2" | "tela6" | "tela11", string>>;
};

type PasswordUpdateResponse = {
  ok: boolean;
  uid: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
};

type AdminAuditItem = {
  id: string;
  actorUid: string;
  action: string;
  targetUid: string;
  details?: Record<string, unknown>;
  createdAtIso: string;
};

type SignupRequest = {
  uid: string;
  phone: string;
  status: "pending" | "approved" | "blocked" | "deleted";
  requestedAtIso: string;
  updatedAtIso: string;
};

const PHOTO_LABELS: Record<"placa" | "placa2" | "tela6" | "tela11", string> = {
  placa: "Placa 1",
  tela6: "Tela 6",
  tela11: "Tela 11",
  placa2: "Placa 2",
};
const PHOTO_KEYS = ["placa", "tela6", "tela11", "placa2"] as const;

type FilterKey =
  | "all"
  | "active"
  | "blocked"
  | "editing"
  | "password_pending"
  | "has_photos";

type SortKey = "phone_asc" | "phone_desc" | "blocked_first" | "pending_first" | "editing_first";

export default function PainelAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [photosByUid, setPhotosByUid] = useState<Record<string, UserPhotosResponse | undefined>>({});
  const [loadingPhotosUid, setLoadingPhotosUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordForceChange, setPasswordForceChange] = useState(true);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AdminUser | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<1 | 2>(1);
  const [deleteConfirmDigits, setDeleteConfirmDigits] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [activeSort, setActiveSort] = useState<SortKey>("phone_asc");
  const [auditItems, setAuditItems] = useState<AdminAuditItem[]>([]);
  const [signupRequests, setSignupRequests] = useState<SignupRequest[]>([]);
  const [updatingSignupUid, setUpdatingSignupUid] = useState<string | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [expandedLoginUid, setExpandedLoginUid] = useState<string | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{
    uri: string;
    label: string;
    phone: string;
  } | null>(null);
  const totalUsers = users.length;
  const blockedUsers = users.filter((user) => !user.active).length;
  const editModeUsers = users.filter((user) => user.editScope !== "none").length;
  const pendingPasswordUsers = users.filter((user) => user.mustChangePassword).length;
  const pendingSignupRequests = useMemo(
    () => signupRequests.filter((item) => item.status === "pending"),
    [signupRequests]
  );

  const carregarUsuarios = useCallback(async () => {
    const idToken = await getAuthIdToken();
    if (!idToken) {
      setUsers([]);
      setErrorMessage("Sessao admin indisponivel.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const access = await apiRequest<{ ok: boolean; access: "master" | "admin2" }>("/admin/access", {
        idToken,
        timeoutMs: 30000,
      });
      if (access.access !== "master") {
        router.replace("/painel-adm");
        return;
      }
      const [config, data, audit, requests] = await Promise.all([
        apiRequest<{ ok: boolean; registrationEnabled: boolean }>("/admin/config", {
          idToken,
          timeoutMs: 30000,
        }),
        apiRequest<{ ok: boolean; users: AdminUser[] }>("/admin/users", {
          idToken,
          timeoutMs: 30000,
        }),
        apiRequest<{ ok: boolean; items: AdminAuditItem[] }>("/admin/audit", {
          idToken,
          timeoutMs: 30000,
        }),
        apiRequest<{ ok: boolean; requests: SignupRequest[] }>("/admin/signup-requests", {
          idToken,
          timeoutMs: 30000,
        }),
      ]);

      setUsers(data.users);
      setAuditItems(audit.items);
      setSignupRequests(requests.requests);
      setRegistrationEnabled(config.registrationEnabled);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar usuarios.";
      setUsers([]);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, []);

  async function atualizarSolicitacaoCadastro(uid: string, action: "approve" | "block" | "delete") {
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
        await carregarUsuarios();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar solicitacao.";
      Alert.alert("Solicitacao", message);
    } finally {
      setUpdatingSignupUid(null);
    }
  }

  useFocusEffect(
    useCallback(() => {
      carregarUsuarios().catch((error) => {
        const message = error instanceof Error ? error.message : "Falha ao carregar usuarios.";
        setUsers([]);
        setErrorMessage(message);
        setLoading(false);
      });
    }, [carregarUsuarios])
  );

  async function atualizarUsuario(
    uid: string,
    patch: Partial<Pick<AdminUser, "active" | "editMode" | "editScope" | "mustChangePassword">>
  ) {
    const idToken = await getAuthIdToken();
    if (!idToken) return;

    const previous = users;
    setUpdatingUid(uid);
    setUsers((current) =>
      current.map((user) => (user.uid === uid ? { ...user, ...patch } : user))
    );

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

  async function atualizarEscopoEdicao(uid: string, nextScope: "none" | "tela4" | "all") {
    await atualizarUsuario(uid, {
      editMode: nextScope !== "none",
      editScope: nextScope,
    });
  }

  async function atualizarTituloAdmin(uid: string, nextIsAdmin: boolean) {
    await atualizarUsuario(uid, {
      role: nextIsAdmin ? "admin2" : "user",
    } as Partial<AdminUser>);
  }

  async function alternarCadastroGlobal() {
    const idToken = await getAuthIdToken();
    if (!idToken) return;

    const next = !registrationEnabled;
    setSavingRegistration(true);
    setRegistrationEnabled(next);
    try {
      const data = await apiRequest<{ ok: boolean; registrationEnabled: boolean }>("/admin/config", {
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
      setSavingRegistration(false);
    }
  }

  async function alternarFotos(uid: string) {
    if (expandedUid === uid) {
      setExpandedUid(null);
      return;
    }

    setExpandedUid(uid);
    if (photosByUid[uid]) return;

    const idToken = await getAuthIdToken();
    if (!idToken) return;

    setLoadingPhotosUid(uid);
    try {
      const data = await apiRequest<UserPhotosResponse>(`/admin/users/${encodeURIComponent(uid)}/photos`, {
        idToken,
        timeoutMs: 30000,
      });
      setPhotosByUid((current) => ({ ...current, [uid]: data }));
    } catch {
      setPhotosByUid((current) => ({
        ...current,
        [uid]: {
          ok: false,
          exists: false,
          requiredComplete: false,
          hasPlaca: false,
          hasTela6: false,
          hasTela11: false,
          hasPlaca2: false,
          updatedAtIso: "",
          photos: {},
        },
      }));
    } finally {
      setLoadingPhotosUid((current) => (current === uid ? null : current));
    }
  }

  function abrirModalSenha(user: AdminUser) {
    setPasswordUser(user);
    setPasswordValue("");
    setPasswordForceChange(true);
  }

  function fecharModalSenha() {
    if (passwordSubmitting) return;
    setPasswordUser(null);
    setPasswordValue("");
    setPasswordForceChange(true);
  }

  async function enviarAcaoSenha(body: {
    newPassword?: string;
    generateTemporary?: boolean;
    forceChangeOnNextLogin?: boolean;
    forceChangeOnly?: boolean;
  }) {
    if (!passwordUser) return;

    const idToken = await getAuthIdToken();
    if (!idToken) return;

    setPasswordSubmitting(true);
    try {
      const data = await apiRequest<PasswordUpdateResponse>(
        `/admin/users/${encodeURIComponent(passwordUser.uid)}/password`,
        {
          method: "POST",
          idToken,
          timeoutMs: 30000,
          body,
        }
      );

      setUsers((current) =>
        current.map((user) =>
          user.uid === passwordUser.uid
            ? { ...user, mustChangePassword: data.mustChangePassword }
            : user
        )
      );

      if (data.temporaryPassword) {
        Alert.alert("Senha temporaria gerada", `Nova senha temporaria: ${data.temporaryPassword}`);
      } else if (body.forceChangeOnly) {
        Alert.alert("Troca obrigatoria ativada", "No proximo login o usuario tera que trocar a senha.");
      } else {
        Alert.alert("Senha atualizada", "A nova senha foi salva com sucesso.");
      }

      fecharModalSenha();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar senha.";
      Alert.alert("Erro de senha", message);
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function salvarNovaSenha() {
    if (passwordValue.trim().length < 4) {
      Alert.alert("Senha invalida", "Digite pelo menos 4 caracteres.");
      return;
    }

    await enviarAcaoSenha({
      newPassword: passwordValue.trim(),
      forceChangeOnNextLogin: passwordForceChange,
    });
  }

  async function gerarSenhaTemporaria() {
    await enviarAcaoSenha({
      generateTemporary: true,
      forceChangeOnNextLogin: true,
    });
  }

  async function forcarTrocaSemRedefinir() {
    await enviarAcaoSenha({
      forceChangeOnly: true,
    });
  }

  function confirmarExclusao(user: AdminUser) {
    setDeleteConfirmUser(user);
    setDeleteConfirmStep(1);
    setDeleteConfirmDigits("");
  }

  function avancarConfirmacaoExclusao() {
    setDeleteConfirmStep(2);
  }

  function fecharConfirmacaoExclusao() {
    if (deletingUid) return;
    setDeleteConfirmUser(null);
    setDeleteConfirmStep(1);
    setDeleteConfirmDigits("");
  }

  function abrirVisualizadorFoto(uri: string, label: string, phone: string) {
    if (!uri) return;
    setPhotoViewer({ uri, label, phone });
  }

  async function excluirUsuario(uid: string) {
    const idToken = await getAuthIdToken();
    if (!idToken) return;

    setDeletingUid(uid);
    try {
      await apiRequest<{ ok: boolean; uid: string }>(`/admin/users/${encodeURIComponent(uid)}`, {
        method: "DELETE",
        idToken,
        timeoutMs: 30000,
      });
      setUsers((current) => current.filter((user) => user.uid !== uid));
      setPhotosByUid((current) => {
        const next = { ...current };
        delete next[uid];
        return next;
      });
      setExpandedUid((current) => (current === uid ? null : current));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao excluir usuario.";
      Alert.alert("Erro ao excluir", message);
    } finally {
      setDeletingUid((current) => (current === uid ? null : current));
      setDeleteConfirmUser(null);
      setDeleteConfirmStep(1);
      setDeleteConfirmDigits("");
    }
  }

  function renderEditScope(scope: AdminUser["editScope"]) {
    if (scope === "all") return "Edita todas";
    if (scope === "tela4") return "Edita Placa 1";
    return "Edicao fechada";
  }

  function getDeleteConfirmSuffix(phone: string) {
    const digits = phone.replace(/\D/g, "");
    return digits.slice(-2);
  }

  function formatAuditDate(value: string) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("pt-BR");
  }

  function formatLoginDate(value: string) {
    if (!value) return "Sem login";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function formatAuditAction(item: AdminAuditItem) {
    if (item.action === "delete_user") return `Excluiu ${item.targetUid}`;
    if (item.action === "update_password") return `Atualizou senha de ${item.targetUid}`;
    if (item.action === "update_user") return `Atualizou acesso de ${item.targetUid}`;
    return `${item.action} em ${item.targetUid}`;
  }

  function renderRoleLabel(role: AdminUser["role"]) {
    if (role === "admin2") return "Administrador";
    if (role === "master") return "Protegido";
    return "Usuario";
  }

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let next = [...users];

    if (normalizedSearch) {
      next = next.filter((user) => {
        const haystack = `${user.phone} ${user.uid}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    if (activeFilter !== "all") {
      next = next.filter((user) => {
        if (activeFilter === "active") return user.active;
        if (activeFilter === "blocked") return !user.active;
        if (activeFilter === "editing") return user.editScope !== "none";
        if (activeFilter === "password_pending") return user.mustChangePassword;
        if (activeFilter === "has_photos") return !!photosByUid[user.uid]?.exists;
        return true;
      });
    }

    next.sort((left, right) => {
      if (activeSort === "phone_desc") {
        return right.phone.localeCompare(left.phone);
      }
      if (activeSort === "blocked_first") {
        if (left.active !== right.active) return left.active ? 1 : -1;
        return left.phone.localeCompare(right.phone);
      }
      if (activeSort === "pending_first") {
        if (left.mustChangePassword !== right.mustChangePassword) {
          return left.mustChangePassword ? -1 : 1;
        }
        return left.phone.localeCompare(right.phone);
      }
      if (activeSort === "editing_first") {
        const leftEditing = left.editScope !== "none";
        const rightEditing = right.editScope !== "none";
        if (leftEditing !== rightEditing) return leftEditing ? -1 : 1;
        return left.phone.localeCompare(right.phone);
      }
      return left.phone.localeCompare(right.phone);
    });

    return next;
  }, [activeFilter, activeSort, photosByUid, searchTerm, users]);

  const listExtraData = useMemo(
    () => ({
      expandedUid,
      expandedLoginUid,
      loadingPhotosUid,
      updatingUid,
      deletingUid,
      photosByUid,
    }),
    [expandedUid, expandedLoginUid, loadingPhotosUid, updatingUid, deletingUid, photosByUid]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={filteredUsers}
        extraData={listExtraData}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
              <Text style={styles.heroEyebrow}>Painel administrativo</Text>
            </View>
            <Text style={styles.title}>Controle administrativo</Text>
            <Text style={styles.heroText}>
              Acesso, fotos, escopo de edicao, senha e exclusao com dupla confirmacao.
            </Text>

            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, styles.metricCardYellow]}>
                <Text style={styles.metricValueYellow}>{totalUsers}</Text>
                <Text style={styles.metricLabel}>Usuarios</Text>
              </View>
              <View style={[styles.metricCard, styles.metricCardRed]}>
                <Text style={styles.metricValueRed}>{blockedUsers}</Text>
                <Text style={styles.metricLabel}>Bloqueados</Text>
              </View>
              <View style={[styles.metricCard, styles.metricCardGreen]}>
                <Text style={styles.metricValueGreen}>{editModeUsers}</Text>
                <Text style={styles.metricLabel}>Em edicao</Text>
              </View>
            </View>

            <View style={styles.metricsRowSecondary}>
              <View style={[styles.metricCard, styles.metricCardNeutral]}>
                <Text style={styles.metricValueNeutral}>{pendingPasswordUsers}</Text>
                <Text style={styles.metricLabel}>Senha pendente</Text>
              </View>
              <View style={[styles.metricCard, styles.metricCardNeutral]}>
                <Text style={styles.metricValueNeutral}>{filteredUsers.length}</Text>
                <Text style={styles.metricLabel}>Resultados</Text>
              </View>
            </View>

            <View style={styles.controlsBlock}>
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Buscar por telefone ou login"
                placeholderTextColor="#71717a"
                style={styles.searchInput}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {[
                  ["all", "Todos"],
                  ["active", "Ativos"],
                  ["blocked", "Bloqueados"],
                  ["editing", "Em edicao"],
                  ["password_pending", "Senha pendente"],
                  ["has_photos", "Com fotos"],
                ].map(([key, label]) => {
                  const selected = activeFilter === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setActiveFilter(key as FilterKey)}
                      style={[styles.chipButton, selected ? styles.chipButtonActive : null]}
                    >
                      <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {[
                  ["phone_asc", "Telefone A-Z"],
                  ["phone_desc", "Telefone Z-A"],
                  ["blocked_first", "Bloqueados primeiro"],
                  ["pending_first", "Senha pendente primeiro"],
                  ["editing_first", "Edicao primeiro"],
                ].map(([key, label]) => {
                  const selected = activeSort === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setActiveSort(key as SortKey)}
                      style={[styles.chipButton, selected ? styles.chipButtonSortActive : null]}
                    >
                      <Text style={[styles.chipText, selected ? styles.chipTextSortActive : null]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.signupRequestsBlock}>
              <Text style={styles.signupRequestsTitle}>Solicitacoes de cadastro</Text>
              {pendingSignupRequests.length === 0 ? (
                <Text style={styles.signupEmptyText}>Nenhuma solicitacao pendente.</Text>
              ) : null}

              {pendingSignupRequests.map((item) => (
                  <View key={item.uid} style={styles.signupCard}>
                    <Text style={styles.signupPhone}>{item.phone}</Text>
                    <Text style={styles.signupMeta}>
                      Solicitado em {formatAuditDate(item.requestedAtIso || item.updatedAtIso)}
                    </Text>
                    <View style={styles.signupActions}>
                      <Pressable
                        onPress={() => atualizarSolicitacaoCadastro(item.uid, "approve")}
                        disabled={updatingSignupUid === item.uid}
                        style={[styles.signupActionBtn, styles.signupActionApprove]}
                      >
                        <Text style={styles.signupActionText}>Aceitar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => atualizarSolicitacaoCadastro(item.uid, "block")}
                        disabled={updatingSignupUid === item.uid}
                        style={[styles.signupActionBtn, styles.signupActionBlock]}
                      >
                        <Text style={styles.signupActionText}>Bloquear</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => atualizarSolicitacaoCadastro(item.uid, "delete")}
                        disabled={updatingSignupUid === item.uid}
                        style={[styles.signupActionBtn, styles.signupActionDelete]}
                      >
                        <Text style={styles.signupActionText}>Excluir</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
            </View>

            <View style={styles.barcodeBlock}>
              <Text style={styles.barcodeTitle}>Placas de carros</Text>
              <Text style={styles.barcodeText}>
                Abra a funcao de placas e codigo de barras em tela dedicada.
              </Text>
              <Pressable onPress={() => router.push("/placas-carros")} style={styles.barcodeButton}>
                <View style={styles.barcodeButtonBarsFull} pointerEvents="none">
                  <View style={styles.barcodeStripeThin} />
                  <View style={styles.barcodeStripeHair} />
                  <View style={styles.barcodeStripeWide} />
                  <View style={styles.barcodeStripeThin} />
                  <View style={styles.barcodeStripeMedium} />
                  <View style={styles.barcodeStripeHair} />
                  <View style={styles.barcodeStripeWide} />
                  <View style={styles.barcodeStripeThin} />
                  <View style={styles.barcodeStripeMedium} />
                  <View style={styles.barcodeStripeThin} />
                  <View style={styles.barcodeStripeWide} />
                  <View style={styles.barcodeStripeHair} />
                  <View style={styles.barcodeStripeThin} />
                  <View style={styles.barcodeStripeMedium} />
                  <View style={styles.barcodeStripeWide} />
                  <View style={styles.barcodeStripeThin} />
                  <View style={styles.barcodeStripeHair} />
                  <View style={styles.barcodeStripeMedium} />
                  <View style={styles.barcodeStripeThin} />
                  <View style={styles.barcodeStripeWide} />
                  <View style={styles.barcodeStripeHair} />
                  <View style={styles.barcodeStripeThin} />
                  <View style={styles.barcodeStripeMedium} />
                  <View style={styles.barcodeStripeHair} />
                  <View style={styles.barcodeStripeWide} />
                  <View style={styles.barcodeStripeThin} />
                  <View style={styles.barcodeStripeHair} />
                  <View style={styles.barcodeStripeMedium} />
                  <View style={styles.barcodeStripeThin} />
                  <View style={styles.barcodeStripeWide} />
                  <View style={styles.barcodeStripeHair} />
                  <View style={styles.barcodeStripeThinEnd} />
                </View>
                <View style={styles.barcodeButtonLine} pointerEvents="none" />
                <View style={styles.barcodeButtonCenterMask} pointerEvents="none" />
                <View style={styles.barcodeButtonLabelWrap}>
                  <Text style={styles.barcodeButtonText}>Placas de carros</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.rowCard}>
              <View style={styles.rowTextBlock}>
                <Text style={styles.label}>Novos cadastros</Text>
                <Text style={styles.helperText}>
                  Controla se o aplicativo aceita criacao de novas contas.
                </Text>
              </View>
              <Pressable
                onPress={alternarCadastroGlobal}
                disabled={savingRegistration}
                style={[
                  styles.stateButton,
                  registrationEnabled ? styles.stateButtonGreen : styles.stateButtonRed,
                ]}
              >
                <Text style={styles.stateButtonText}>
                  {savingRegistration ? "Salvando" : registrationEnabled ? "Ligado" : "Desligado"}
                </Text>
              </Pressable>
            </View>

            {auditItems.length ? (
              <View style={styles.auditBlock}>
                <Text style={styles.auditTitle}>Historico recente</Text>
                {auditItems.slice(0, 6).map((item) => (
                  <View key={item.id} style={styles.auditCard}>
                    <Text style={styles.auditAction}>{formatAuditAction(item)}</Text>
                    <Text style={styles.auditMeta}>Por {item.actorUid || "sistema"}</Text>
                    <Text style={styles.auditMeta}>{formatAuditDate(item.createdAtIso)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {loading ? (
              <View style={styles.heroState}>
                <ActivityIndicator color="#facc15" />
              </View>
            ) : null}

            {!loading && errorMessage ? (
              <View style={styles.heroState}>
                <Text style={styles.errorTitle}>Painel indisponivel</Text>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {!loading && !errorMessage && users.length === 0 ? (
              <View style={styles.heroState}>
                <Text style={styles.emptyTitle}>Nenhum usuario encontrado</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const busy = updatingUid === item.uid;
          const deleting = deletingUid === item.uid;
          const loginHistoryVisible = expandedLoginUid === item.uid;
          const rawLoginHistory = item.loginHistory || [];
          const lastLogin = item.lastLoginAtIso || rawLoginHistory[0]?.atIso || "";
          const loginHistory = loginHistoryVisible ? rawLoginHistory.slice(0, 10) : [];
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.identityBlock}>
                  <Text style={styles.phone}>{item.phone}</Text>
                  <Text style={styles.uid}>Usuario: {item.uid}</Text>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.role}>{renderRoleLabel(item.role)}</Text>
                </View>
              </View>

              <View style={styles.badgesRow}>
                <View style={[styles.statusBadge, item.active ? styles.statusBadgeGreen : styles.statusBadgeRed]}>
                  <Text style={styles.statusBadgeText}>{item.active ? "Ativo" : "Bloqueado"}</Text>
                </View>
                <View style={styles.statusBadgeYellow}>
                  <Text style={styles.statusBadgeTextDark}>{renderEditScope(item.editScope)}</Text>
                </View>
                {item.mustChangePassword ? (
                  <View style={styles.statusBadgeRedSoft}>
                    <Text style={styles.statusBadgeText}>Troca de senha pendente</Text>
                  </View>
                ) : null}
              </View>

              <Pressable
                onPress={() =>
                  setExpandedLoginUid((current) => (current === item.uid ? null : item.uid))
                }
                style={styles.loginHistoryHeader}
              >
                <View style={styles.loginHistoryHeaderText}>
                  <Text style={styles.loginHistoryLabel}>Ultimos 10 logins</Text>
                  <Text style={styles.loginHistorySummary}>
                    {lastLogin ? `Ultimo acesso: ${formatLoginDate(lastLogin)}` : "Sem historico de login"}
                  </Text>
                </View>
                <Text style={styles.loginHistoryToggle}>
                  {loginHistoryVisible ? "Ocultar" : "Ver"}
                </Text>
              </Pressable>

              {loginHistoryVisible ? (
                <View style={styles.loginHistoryPanel}>
                  {loginHistory.length > 0 ? (
                    loginHistory.map((entry, index) => (
                      <View key={`${item.uid}-${entry.atIso}-${index}`} style={styles.loginHistoryRow}>
                        <View style={styles.loginHistoryDot} />
                        <Text style={styles.loginHistoryRowText}>
                          {formatLoginDate(entry.atIso)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.loginHistoryEmpty}>Sem registro de login.</Text>
                  )}
                </View>
              ) : null}

              <View style={styles.rowCard}>
                <View style={styles.rowTextBlock}>
                  <Text style={styles.label}>Acesso ao aplicativo</Text>
                  <Text style={styles.helperText}>
                    {item.role === "master"
                      ? "Conta principal protegida com acesso permanente."
                      : "Desligado bloqueia a entrada mesmo com senha correta."}
                  </Text>
                </View>
                {item.role === "master" ? (
                  <View style={[styles.stateButton, styles.stateButtonLocked]}>
                    <Text style={styles.stateButtonText}>Permanente</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => atualizarUsuario(item.uid, { active: !item.active })}
                    disabled={busy || deleting}
                    style={[
                      styles.stateButton,
                      item.active ? styles.stateButtonGreen : styles.stateButtonRed,
                    ]}
                  >
                    <Text style={styles.stateButtonText}>{item.active ? "Ligado" : "Desligado"}</Text>
                  </Pressable>
                )}
              </View>

              {item.role !== "master" ? (
                <View style={styles.rowCard}>
                  <View style={styles.rowTextBlock}>
                    <Text style={styles.label}>Permissao administrativa</Text>
                    <Text style={styles.helperText}>
                      Distribui ou remove o titulo administrativo desta conta.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => atualizarTituloAdmin(item.uid, item.role !== "admin2")}
                    disabled={busy || deleting}
                    style={[
                      styles.stateButton,
                      item.role === "admin2" ? styles.stateButtonGreen : styles.stateButtonOff,
                    ]}
                  >
                    <Text style={styles.stateButtonText}>
                      {item.role === "admin2" ? "Ligado" : "Desligado"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.rowCard}>
                <View style={styles.rowTextBlock}>
                  <Text style={styles.label}>Editar so Placa 1</Text>
                  <Text style={styles.helperText}>
                    O usuario troca apenas a imagem principal da Placa 1.
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    atualizarEscopoEdicao(item.uid, item.editScope === "tela4" ? "none" : "tela4")
                  }
                  disabled={busy || deleting || item.editScope === "all"}
                  style={[
                    styles.stateButton,
                    item.editScope === "tela4" ? styles.stateButtonYellow : styles.stateButtonOff,
                    item.editScope === "all" ? styles.stateButtonDisabled : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.stateButtonText,
                      item.editScope === "tela4" ? styles.stateButtonTextDark : null,
                    ]}
                  >
                    {item.editScope === "tela4" ? "Ligado" : "Desligado"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.rowCard}>
                <View style={styles.rowTextBlock}>
                  <Text style={styles.label}>Editar todas as telas</Text>
                  <Text style={styles.helperText}>
                    Libera Placa 1, Tela 6, Tela 11 e Placa 2 no proximo login.
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    atualizarEscopoEdicao(item.uid, item.editScope === "all" ? "none" : "all")
                  }
                  disabled={busy || deleting}
                  style={[
                    styles.stateButton,
                    item.editScope === "all" ? styles.stateButtonGreen : styles.stateButtonOff,
                  ]}
                >
                  <Text style={styles.stateButtonText}>
                    {item.editScope === "all" ? "Ligado" : "Desligado"}
                  </Text>
                </Pressable>
              </View>

              {busy ? <Text style={styles.infoHint}>Atualizando configuracoes...</Text> : null}
              {deleting ? <Text style={styles.deleteHint}>Excluindo usuario...</Text> : null}

              <View style={styles.actionsGrid}>
                <Pressable onPress={() => alternarFotos(item.uid)} style={styles.actionButtonYellow} disabled={deleting}>
                  <Text style={styles.actionButtonTextDark}>
                    {expandedUid === item.uid ? "Ocultar fotos" : "Ver fotos"}
                  </Text>
                </Pressable>

                <Pressable onPress={() => abrirModalSenha(item)} style={styles.actionButtonGreen} disabled={deleting}>
                  <Text style={styles.actionButtonText}>Senha</Text>
                </Pressable>

                <Pressable onPress={() => confirmarExclusao(item)} style={styles.actionButtonRed} disabled={deleting}>
                  <Text style={styles.actionButtonText}>Excluir cadastro</Text>
                </Pressable>
              </View>

              {expandedUid === item.uid ? (
                loadingPhotosUid === item.uid ? (
                  <View style={styles.photosLoading}>
                    <ActivityIndicator color="#facc15" />
                  </View>
                ) : (
                  <View style={styles.galleryBlock}>
                    {photosByUid[item.uid]?.exists ? (
                      <>
                        <Text style={styles.galleryTitle}>Fotos carregadas</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.galleryRow}
                        >
                          {PHOTO_KEYS.map((key) => {
                            const uri = photosByUid[item.uid]?.photos?.[key];
                            return (
                              <View key={key} style={styles.photoCard}>
                                <Text style={styles.photoLabel}>{PHOTO_LABELS[key]}</Text>
                                {uri ? (
                                  <Pressable
                                    onPress={() => abrirVisualizadorFoto(uri, PHOTO_LABELS[key], item.phone)}
                                    style={styles.photoPressable}
                                  >
                                    <FlexiblePhotoPreview uri={uri} style={styles.photoPreview} />
                                  </Pressable>
                                ) : (
                                  <View style={styles.photoEmpty}>
                                    <Text style={styles.photoEmptyText}>Sem foto</Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </ScrollView>
                      </>
                    ) : (
                      <Text style={styles.noPhotosText}>Esse usuario ainda nao enviou fotos.</Text>
                    )}
                  </View>
                )
              ) : null}
            </View>
          );
        }}
      />

      <Modal
        visible={!!passwordUser}
        transparent
        animationType="fade"
        onRequestClose={fecharModalSenha}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Gerenciar senha</Text>
            <Text style={styles.modalTitle}>{passwordUser?.phone || ""}</Text>
            <Text style={styles.modalText}>
              Defina nova senha, gere senha temporaria ou force a troca no proximo login.
            </Text>

            <TextInput
              value={passwordValue}
              onChangeText={setPasswordValue}
              placeholder="Nova senha"
              placeholderTextColor="#71717a"
              style={styles.modalInput}
              secureTextEntry
              editable={!passwordSubmitting}
            />

            <View style={styles.modalSwitchRow}>
              <View style={styles.rowTextBlock}>
                <Text style={styles.modalSwitchLabel}>Forcar troca no proximo login</Text>
              </View>
              <Pressable
                onPress={() => setPasswordForceChange((current) => !current)}
                disabled={passwordSubmitting}
                style={[
                  styles.stateButton,
                  passwordForceChange ? styles.stateButtonYellow : styles.stateButtonOff,
                ]}
              >
                <Text
                  style={[
                    styles.stateButtonText,
                    passwordForceChange ? styles.stateButtonTextDark : null,
                  ]}
                >
                  {passwordForceChange ? "Ligado" : "Desligado"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={salvarNovaSenha}
                disabled={passwordSubmitting}
                style={styles.modalPrimaryButton}
              >
                {passwordSubmitting ? <ActivityIndicator color="#030303" /> : <Text style={styles.modalPrimaryText}>Salvar senha</Text>}
              </Pressable>

              <Pressable
                onPress={gerarSenhaTemporaria}
                disabled={passwordSubmitting}
                style={styles.modalSecondaryGreen}
              >
                <Text style={styles.modalSecondaryText}>Gerar temporaria</Text>
              </Pressable>

              <Pressable
                onPress={forcarTrocaSemRedefinir}
                disabled={passwordSubmitting}
                style={styles.modalSecondaryRed}
              >
                <Text style={styles.modalSecondaryText}>So forcar troca</Text>
              </Pressable>

              <Pressable
                onPress={fecharModalSenha}
                disabled={passwordSubmitting}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalCancelText}>Fechar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!deleteConfirmUser}
        transparent
        animationType="fade"
        onRequestClose={fecharConfirmacaoExclusao}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Excluir cadastro</Text>
            <Text style={styles.modalTitle}>{deleteConfirmUser?.phone || ""}</Text>
            <Text style={styles.modalText}>
              {deleteConfirmStep === 1
                ? "Primeira confirmacao. Essa acao remove o usuario e as fotos salvas."
                : `Confirmacao final. Digite os 2 ultimos numeros do telefone para excluir: ${getDeleteConfirmSuffix(deleteConfirmUser?.phone || "")}`}
            </Text>

            {deleteConfirmStep === 2 ? (
              <TextInput
                value={deleteConfirmDigits}
                onChangeText={(value) => setDeleteConfirmDigits(value.replace(/\D/g, "").slice(0, 2))}
                placeholder="2 ultimos numeros"
                placeholderTextColor="#71717a"
                keyboardType="number-pad"
                style={styles.modalInput}
                editable={!deletingUid}
              />
            ) : null}

            <View
              style={[
                styles.deleteConfirmActions,
                deleteConfirmStep === 2 ? styles.deleteConfirmActionsReverse : null,
              ]}
            >
              <Pressable
                onPress={fecharConfirmacaoExclusao}
                disabled={!!deletingUid}
                style={styles.deleteCancelButton}
              >
                <Text style={styles.deleteCancelText}>Cancelar</Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  deleteConfirmStep === 1
                    ? avancarConfirmacaoExclusao()
                    : deleteConfirmUser
                      ? excluirUsuario(deleteConfirmUser.uid)
                      : undefined
                }
                disabled={
                  !!deletingUid ||
                  (deleteConfirmStep === 2 &&
                    deleteConfirmDigits !== getDeleteConfirmSuffix(deleteConfirmUser?.phone || ""))
                }
                style={styles.deleteDangerButton}
              >
                {deletingUid && deleteConfirmStep === 2 ? (
                  <ActivityIndicator color="#fafafa" />
                ) : (
                  <Text style={styles.deleteDangerText}>
                    {deleteConfirmStep === 1 ? "Continuar" : "Excluir agora"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!photoViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewer(null)}
      >
        <View style={styles.photoViewerOverlay}>
          <View style={styles.photoViewerCard}>
            <Text style={styles.photoViewerTitle}>{photoViewer?.label || "Foto"}</Text>
            <Text style={styles.photoViewerSubtitle}>{photoViewer?.phone || ""}</Text>
            <FlexiblePhotoPreview uri={photoViewer?.uri || null} style={styles.photoViewerImage} resizeMode="contain" />
            <Pressable onPress={() => setPhotoViewer(null)} style={styles.photoViewerCloseButton}>
              <Text style={styles.photoViewerCloseText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  listContent: {
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: "#040404",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomWidth: 1,
    borderColor: "#27272a",
    marginBottom: 10,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    minHeight: 40,
    minWidth: 70,
    justifyContent: "center",
  },
  backText: {
    color: "#facc15",
    fontSize: 15,
    fontWeight: "700",
  },
  heroEyebrow: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  title: {
    color: "#fafafa",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 10,
  },
  heroText: {
    color: "#d4d4d8",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  metricsRowSecondary: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  metricCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
  metricCardYellow: {
    backgroundColor: "#1c1917",
    borderColor: "#854d0e",
  },
  metricCardRed: {
    backgroundColor: "#1f1113",
    borderColor: "#7f1d1d",
  },
  metricCardGreen: {
    backgroundColor: "#07150d",
    borderColor: "#166534",
  },
  metricCardNeutral: {
    backgroundColor: "#101010",
    borderColor: "#3f3f46",
  },
  metricValueYellow: {
    color: "#facc15",
    fontSize: 28,
    fontWeight: "900",
  },
  metricValueRed: {
    color: "#ef4444",
    fontSize: 28,
    fontWeight: "900",
  },
  metricValueGreen: {
    color: "#22c55e",
    fontSize: 28,
    fontWeight: "900",
  },
  metricValueNeutral: {
    color: "#fafafa",
    fontSize: 24,
    fontWeight: "900",
  },
  metricLabel: {
    color: "#a1a1aa",
    fontSize: 12,
    marginTop: 3,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroState: {
    marginTop: 18,
    padding: 14,
    backgroundColor: "#101010",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  controlsBlock: {
    marginTop: 14,
    gap: 10,
  },
  signupRequestsBlock: {
    marginTop: 14,
    gap: 10,
    backgroundColor: "#0d0d0d",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 14,
  },
  signupRequestsTitle: {
    color: "#fafafa",
    fontSize: 15,
    fontWeight: "800",
  },
  signupEmptyText: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  signupCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#0b0b0b",
    padding: 12,
    gap: 8,
  },
  signupPhone: {
    color: "#facc15",
    fontSize: 15,
    fontWeight: "800",
  },
  signupMeta: {
    color: "#a1a1aa",
    fontSize: 12,
  },
  signupActions: {
    flexDirection: "row",
    gap: 8,
  },
  signupActionBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  signupActionApprove: {
    backgroundColor: "#166534",
  },
  signupActionBlock: {
    backgroundColor: "#92400e",
  },
  signupActionDelete: {
    backgroundColor: "#7f1d1d",
  },
  signupActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  searchInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#0f0f10",
    color: "#fafafa",
    paddingHorizontal: 14,
    fontSize: 15,
  },
  chipsRow: {
    gap: 10,
    paddingRight: 4,
  },
  chipButton: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  chipButtonActive: {
    backgroundColor: "#facc15",
    borderColor: "#facc15",
  },
  chipButtonSortActive: {
    backgroundColor: "#166534",
    borderColor: "#22c55e",
  },
  chipText: {
    color: "#d4d4d8",
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#09090b",
  },
  chipTextSortActive: {
    color: "#fafafa",
  },
  auditBlock: {
    marginTop: 14,
    gap: 10,
  },
  barcodeBlock: {
    marginTop: 14,
    gap: 10,
    backgroundColor: "#101010",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 14,
  },
  barcodeTitle: {
    color: "#fafafa",
    fontSize: 15,
    fontWeight: "800",
  },
  barcodeText: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 18,
  },
  barcodeButton: {
    minHeight: 84,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "#52525b",
    overflow: "hidden",
    position: "relative",
  },
  barcodeButtonText: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2.8,
    zIndex: 2,
  },
  barcodeButtonLabelWrap: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(9,9,11,0.64)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  barcodeButtonBarsFull: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "stretch",
    opacity: 0.95,
    zIndex: 0,
  },
  barcodeStripeThin: {
    width: 3,
    backgroundColor: "#fafafa",
    marginRight: 3,
  },
  barcodeStripeThinEnd: {
    width: 3,
    backgroundColor: "#fafafa",
    marginRight: 0,
  },
  barcodeStripeHair: {
    width: 1,
    backgroundColor: "#fafafa",
    marginRight: 2,
  },
  barcodeStripeMedium: {
    width: 6,
    backgroundColor: "#fafafa",
    marginRight: 4,
  },
  barcodeStripeWide: {
    width: 10,
    backgroundColor: "#fafafa",
    marginRight: 5,
  },
  barcodeButtonLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 2,
    marginTop: -1,
    backgroundColor: "#dc2626",
    zIndex: 1,
  },
  barcodeButtonCenterMask: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: "18%",
    right: "18%",
    backgroundColor: "rgba(9,9,11,0.36)",
    borderRadius: 12,
    zIndex: 1,
  },
  barcodePreviewCard: {
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    backgroundColor: "#fafafa",
    padding: 14,
  },
  barcodeValueText: {
    color: "#09090b",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  auditTitle: {
    color: "#fafafa",
    fontSize: 15,
    fontWeight: "800",
  },
  auditCard: {
    backgroundColor: "#101010",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
    gap: 4,
  },
  auditAction: {
    color: "#facc15",
    fontSize: 13,
    fontWeight: "800",
  },
  auditMeta: {
    color: "#a1a1aa",
    fontSize: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: "#facc15",
    fontSize: 17,
    textAlign: "center",
  },
  errorTitle: {
    color: "#ef4444",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  errorText: {
    color: "#d4d4d8",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  card: {
    backgroundColor: "#0c0c0d",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#26262b",
    gap: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  identityBlock: {
    flex: 1,
    gap: 4,
  },
  phone: {
    color: "#fafafa",
    fontSize: 20,
    fontWeight: "800",
  },
  uid: {
    color: "#a1a1aa",
    fontSize: 12,
  },
  roleBadge: {
    backgroundColor: "#14532d",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  role: {
    color: "#dcfce7",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statusBadgeGreen: {
    backgroundColor: "#052e16",
    borderColor: "#166534",
  },
  statusBadgeRed: {
    backgroundColor: "#450a0a",
    borderColor: "#b91c1c",
  },
  statusBadgeYellow: {
    backgroundColor: "#facc15",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeRedSoft: {
    backgroundColor: "#1f1113",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#7f1d1d",
  },
  statusBadgeText: {
    color: "#fafafa",
    fontSize: 12,
    fontWeight: "700",
  },
  statusBadgeTextDark: {
    color: "#09090b",
    fontSize: 12,
    fontWeight: "800",
  },
  rowCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#101113",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2a2a30",
  },
  rowTextBlock: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: "#fafafa",
    fontSize: 15,
    fontWeight: "700",
  },
  helperText: {
    color: "#b0b0b8",
    fontSize: 13,
    lineHeight: 18,
  },
  stateButton: {
    minWidth: 108,
    minHeight: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  stateButtonGreen: {
    backgroundColor: "#166534",
    borderColor: "#22c55e",
  },
  stateButtonRed: {
    backgroundColor: "#7f1d1d",
    borderColor: "#ef4444",
  },
  stateButtonYellow: {
    backgroundColor: "#facc15",
    borderColor: "#facc15",
  },
  stateButtonLocked: {
    backgroundColor: "#1e1b4b",
    borderColor: "#60a5fa",
  },
  stateButtonOff: {
    backgroundColor: "#111111",
    borderColor: "#3f3f46",
  },
  stateButtonDisabled: {
    opacity: 0.45,
  },
  stateButtonText: {
    color: "#fafafa",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  stateButtonTextDark: {
    color: "#09090b",
  },
  infoHint: {
    color: "#facc15",
    fontSize: 13,
    fontWeight: "700",
  },
  loginHistoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#0f0f10",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loginHistoryHeaderText: {
    flex: 1,
    gap: 3,
  },
  loginHistoryLabel: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  loginHistorySummary: {
    color: "#c7c7d1",
    fontSize: 13,
    lineHeight: 18,
  },
  loginHistoryToggle: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  loginHistoryPanel: {
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#09090b",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loginHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loginHistoryDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#facc15",
  },
  loginHistoryRowText: {
    color: "#e4e4e7",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  loginHistoryEmpty: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  deleteHint: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "700",
  },
  actionsGrid: {
    gap: 10,
  },
  actionButtonYellow: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#facc15",
  },
  actionButtonGreen: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#166534",
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  actionButtonRed: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7f1d1d",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  actionButtonText: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "800",
  },
  actionButtonTextDark: {
    color: "#09090b",
    fontSize: 14,
    fontWeight: "900",
  },
  photosLoading: {
    minHeight: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryBlock: {
    gap: 10,
  },
  galleryTitle: {
    color: "#22c55e",
    fontSize: 15,
    fontWeight: "800",
  },
  galleryRow: {
    gap: 12,
    paddingRight: 4,
  },
  photoCard: {
    width: 152,
    gap: 8,
  },
  photoPressable: {
    borderRadius: 16,
    overflow: "hidden",
  },
  photoLabel: {
    color: "#facc15",
    fontSize: 13,
    fontWeight: "700",
  },
  photoPreview: {
    width: 152,
    height: 184,
    borderRadius: 16,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  photoEmpty: {
    width: 152,
    height: 184,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#52525b",
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  photoEmptyText: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  noPhotosText: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#09090b",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: 14,
  },
  modalEyebrow: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  modalTitle: {
    color: "#fafafa",
    fontSize: 24,
    fontWeight: "800",
  },
  modalText: {
    color: "#a1a1aa",
    fontSize: 14,
    lineHeight: 20,
  },
  modalInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#111111",
    color: "#fafafa",
    paddingHorizontal: 14,
    fontSize: 15,
  },
  modalSwitchRow: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111111",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalSwitchLabel: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "700",
  },
  modalActions: {
    gap: 10,
  },
  modalPrimaryButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#facc15",
  },
  modalPrimaryText: {
    color: "#09090b",
    fontSize: 14,
    fontWeight: "900",
  },
  modalSecondaryGreen: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#166534",
  },
  modalSecondaryRed: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7f1d1d",
  },
  modalSecondaryText: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "800",
  },
  modalCancelButton: {
    minHeight: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#111111",
  },
  modalCancelText: {
    color: "#d4d4d8",
    fontSize: 14,
    fontWeight: "700",
  },
  deleteConfirmActions: {
    flexDirection: "row",
    gap: 10,
  },
  deleteConfirmActionsReverse: {
    flexDirection: "row-reverse",
  },
  deleteCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  deleteCancelText: {
    color: "#d4d4d8",
    fontSize: 14,
    fontWeight: "700",
  },
  deleteDangerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7f1d1d",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  deleteDangerText: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "800",
  },
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  photoViewerCard: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 20,
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 14,
    gap: 10,
  },
  photoViewerTitle: {
    color: "#fafafa",
    fontSize: 16,
    fontWeight: "800",
  },
  photoViewerSubtitle: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  photoViewerImage: {
    width: "100%",
    height: 430,
    borderRadius: 14,
    backgroundColor: "#111111",
  },
  photoViewerCloseButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#facc15",
  },
  photoViewerCloseText: {
    color: "#09090b",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
