import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { apiRequest } from "../lib/apiClient";
import {
  getPlacaUri,
  getProfileFaceUri,
  hydrateCurrentUserPhotosFromCloud,
  setAuthSession,
} from "../lib/devStorage";
import { ensureTela2EmRotaDownloadsPermission } from "../lib/tela2EmRotaEngine";

const LAST_PHONE_KEY = "spx_last_phone";
const LAST_PASSWORD_KEY = "spx_last_password";

type AuthResponse = {
  ok: boolean;
  uid: string;
  phone: string;
  idToken: string;
  role?: string;
  canUploadPhotos?: boolean;
  editMode?: boolean;
  editScope?: "none" | "tela4" | "all";
  mustChangePassword?: boolean;
  pendingApproval?: boolean;
  message?: string;
};

function formatPhoneDisplay(raw: string) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);

  if (!digits) return "";
  const ddd = digits.slice(0, 2);
  const first = digits.slice(2, 7);
  const second = digits.slice(7, 11);

  let result = "(+55)";
  if (ddd) result += ` ${ddd}`;
  if (first) result += ` ${first}`;
  if (second) result += ` ${second}`;
  return result;
}

function normalizePhoneBR(raw: string) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

export default function Tela10() {
  const { width } = useWindowDimensions();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const hasPhoneValue = phone.trim().length > 0;

  const canSubmit = useMemo(() => {
    return normalizePhoneBR(phone).length >= 12 && password.trim().length >= 4;
  }, [phone, password]);
  const largeScreen = width >= 768;
  const largePhone = width >= 410 && width < 768;

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(LAST_PHONE_KEY),
      AsyncStorage.getItem(LAST_PASSWORD_KEY),
    ])
      .then(([savedPhone, savedPassword]) => {
        if (savedPhone) setPhone(formatPhoneDisplay(savedPhone));
        if (savedPassword) setPassword(savedPassword);
      })
      .catch(() => undefined);
  }, []);

  async function requestFirstAccessPermissions() {
    setStatus("Preparando permissoes do primeiro acesso...");

    try {
      await ensureTela2EmRotaDownloadsPermission();
    } catch (error) {
      console.log("LOGIN_FLOW", "romaneio_permission_skipped_or_failed", error);
    }

    try {
      await Location.requestForegroundPermissionsAsync();
    } catch (error) {
      console.log("LOGIN_FLOW", "location_permission_failed", error);
    }
  }

  async function finishAuth(data: AuthResponse, loginPassword: string) {
    setStatus("");
    await setAuthSession({
      phone: data.phone,
      uid: data.uid,
      idToken: data.idToken,
      role: data.role,
      editScope: data.editScope || (data.editMode ? "all" : "none"),
      mustChangePassword: data.mustChangePassword === true,
    });
    await AsyncStorage.setItem(LAST_PHONE_KEY, data.phone);
    await AsyncStorage.setItem(LAST_PASSWORD_KEY, loginPassword);
    setPassword("");

    if (data.mustChangePassword) {
      router.replace("/trocar-senha");
      return;
    }

    if (data.editMode) {
      router.replace("/upload-fotos");
      return;
    }

    try {
      await hydrateCurrentUserPhotosFromCloud({ force: true });
    } catch (error) {
      console.log("LOGIN_FLOW", "cloud_hydrate_failed", error);
    }

    const [profileFaceUri, placaUri] = await Promise.all([getProfileFaceUri(), getPlacaUri()]);

    if (!profileFaceUri) {
      await requestFirstAccessPermissions();
      router.replace("/facial-verification");
      return;
    }

    if (!placaUri) {
      await requestFirstAccessPermissions();
      router.replace("/placas-carros?cadastro=1");
      return;
    }

    router.replace("/tela2");
  }

  async function submit(mode: "login" | "register") {
    if (!canSubmit || loading) return;

    const normalizedPhone = normalizePhoneBR(phone);
    const cleanPassword = password.trim();

    try {
      setLoading(mode === "login");
      if (mode === "login") setStatus("Entrando...");
      const data = await apiRequest<AuthResponse>(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: {
          phone: normalizedPhone,
          password: cleanPassword,
        },
      });

      if (mode === "register") {
        await AsyncStorage.setItem(LAST_PHONE_KEY, data.phone || normalizedPhone);
        setPassword("");
        setStatus(data.message || "Solicitacao enviada. Aguarde aprovacao do administrador.");
        return;
      }

      await finishAuth(data, cleanPassword);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      const isConnectionError =
        /network request failed|failed to fetch|timeout|timed out|aborted|sem conexao|sem conexão|conexao|conexão/i.test(
          rawMessage
        );
      const isWrongPassword =
        /senha incorreta|senha errada|wrong password|invalid password/i.test(rawMessage);
      const message =
        mode === "login"
          ? isWrongPassword
            ? "Senha errada."
            : "Nao foi possivel entrar. Verifique seus dados e tente novamente."
          : isConnectionError
            ? "Sem conexao. Verifique sua internet."
            : "Nao foi possivel concluir sua solicitacao de cadastro. Tente novamente em instantes.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <View style={styles.statusBar} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios-new" size={22} color="#e84118" />
          </Pressable>
          <Pressable onPress={() => router.replace("/")} hitSlop={8}>
            <Text style={[styles.headerTitle, largeScreen ? styles.headerTitleLarge : null]}>Log in</Text>
          </Pressable>
        </View>

        <View style={[styles.logoArea, largeScreen ? styles.logoAreaLarge : null]}>
          <Image
            source={require("../assets/images/logo.png")}
            style={[
              styles.logoImage,
              largePhone ? styles.logoImageLargePhone : null,
              largeScreen ? styles.logoImageLarge : null,
            ]}
            resizeMode="contain"
          />
        </View>

        <View style={[styles.form, largeScreen ? styles.formLarge : null]}>
          <View style={styles.inputRow}>
            <MaterialIcons name="phone" size={23} color="#9a9a9a" />
            <TextInput
              value={phone}
              onChangeText={(value) => setPhone(formatPhoneDisplay(value))}
              placeholder="Número de Telefone"
              placeholderTextColor="#bdbdbd"
              keyboardType="phone-pad"
              inputMode="tel"
              maxLength={20}
              style={styles.input}
            />
            {hasPhoneValue ? (
              <Pressable onPress={() => setPhone("")} style={styles.iconButton} hitSlop={8}>
                <MaterialIcons name="close" size={24} color="#8f8f8f" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.inputRow}>
            <MaterialIcons name="lock-outline" size={23} color="#9a9a9a" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Senha"
              placeholderTextColor="#bdbdbd"
              secureTextEntry={!showPassword}
              style={styles.input}
            />
            <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.iconButton}>
              <MaterialIcons
                name={showPassword ? "visibility" : "visibility-off"}
                size={21}
                color="#9a9a9a"
              />
            </Pressable>
            <View style={styles.divider} />
            <Text style={styles.forgot}>Esqueceu?</Text>
          </View>

          <View style={styles.infoRow}>
            <MaterialIcons name="info-outline" size={16} color="#888" />
            <Text style={styles.infoText}>
              Se estiver fazendo login pela primeira vez, por favor, faça login com o número de telefone.
            </Text>
          </View>

          <Pressable
            disabled={!canSubmit || loading}
            onPress={() => submit("login")}
            style={[styles.primaryButton, canSubmit && !loading ? styles.primaryButtonActive : null]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  canSubmit ? styles.primaryButtonTextActive : styles.primaryButtonTextInactive,
                ]}
              >
                Log in
              </Text>
            )}
          </Pressable>

          <Text style={styles.phoneLogin}>Login com Telefone</Text>

          <Pressable disabled={loading} onPress={() => submit("register")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Inscreva-se agora</Text>
          </Pressable>

          {status ? <Text style={styles.statusText}>{status}</Text> : null}
        </View>

        <Text style={[styles.version, largeScreen ? styles.versionLarge : null]}>v.8.1.8</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  keyboard: { flex: 1 },
  statusBar: { height: 24, backgroundColor: "#6b6b6b" },
  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8e8e8",
    paddingHorizontal: 16,
    paddingTop: 2,
    zIndex: 3,
    elevation: 3,
    backgroundColor: "#fff",
  },
  backButton: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontSize: 20, color: "#111", fontWeight: "400", marginLeft: -2 },
  headerTitleLarge: { fontSize: 18 },
  logoArea: { alignItems: "center", paddingTop: 8, paddingBottom: 20, marginTop: -8 },
  logoImage: { width: 420, height: 210 },
  logoImageLargePhone: { transform: [{ translateX: 12 }] },
  logoAreaLarge: { marginTop: -6, paddingTop: 6, paddingBottom: 14 },
  logoImageLarge: { width: 248, height: 118 },
  form: { paddingHorizontal: 28, marginTop: -8 },
  formLarge: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    paddingHorizontal: 14,
  },
  inputRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  input: { flex: 1, color: "#333", fontSize: 16, paddingVertical: 8 },
  iconButton: { padding: 4 },
  divider: { width: 1, height: 18, backgroundColor: "#ccc" },
  forgot: { color: "#2979ff", fontSize: 15, fontWeight: "500" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingTop: 14 },
  infoText: { flex: 1, color: "#666", fontSize: 13, lineHeight: 18 },
  primaryButton: {
    minHeight: 56,
    borderRadius: 4,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  primaryButtonActive: { backgroundColor: "#e84118" },
  primaryButtonText: { fontSize: 17, fontWeight: "500" },
  primaryButtonTextActive: { color: "#fff" },
  primaryButtonTextInactive: { color: "#b3b3b3" },
  phoneLogin: {
    alignSelf: "flex-end",
    color: "#2979ff",
    fontSize: 16,
    fontWeight: "500",
    paddingTop: 16,
    paddingBottom: 18,
  },
  secondaryButton: {
    minHeight: 58,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#d1d1d1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  secondaryButtonText: { color: "#222", fontSize: 18, fontWeight: "400" },
  statusText: { color: "#666", fontSize: 13, textAlign: "center", marginTop: 14 },
  version: {
    marginTop: "auto",
    paddingBottom: 34,
    textAlign: "center",
    color: "#aaa",
    fontSize: 13,
  },
  versionLarge: {
    marginTop: 14,
    paddingBottom: 14,
  },
});
