import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiRequest } from "../lib/apiClient";
import {
  getAuthEditScope,
  getAuthIdToken,
  getPlacaUri,
  getTela11Uri,
  getTela6Uri,
  hydrateCurrentUserPhotosFromCloud,
  setAuthSession,
} from "../lib/devStorage";

export default function TrocarSenhaScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return newPassword.trim().length >= 4 && newPassword.trim() === confirmPassword.trim();
  }, [confirmPassword, newPassword]);

  async function hasRequiredPhotos() {
    const [u4, u6, u11] = await Promise.all([getPlacaUri(), getTela6Uri(), getTela11Uri()]);
    return !!u4 && !!u6 && !!u11;
  }

  async function concluirFluxoAposTroca() {
    const editScope = await getAuthEditScope();
    await setAuthSession(null);

    const idToken = await getAuthIdToken();
    if (idToken) {
      // noop: defensive only, session is intentionally cleared above.
    }

    if (editScope !== "none") {
      router.replace("/tela10");
      return;
    }

    if (await hasRequiredPhotos()) {
      router.replace("/tela6");
      return;
    }

    try {
      await hydrateCurrentUserPhotosFromCloud();
    } catch {}

    if (await hasRequiredPhotos()) {
      router.replace("/tela6");
      return;
    }

    router.replace("/tela10");
  }

  async function salvarNovaSenha() {
    if (!canSubmit || loading) return;

    const idToken = await getAuthIdToken();
    if (!idToken) {
      Alert.alert("Sessao invalida", "Faca login novamente.");
      router.replace("/tela10");
      return;
    }

    try {
      setLoading(true);
      await apiRequest<{ ok: boolean }>("/auth/change-password", {
        method: "POST",
        idToken,
        timeoutMs: 30000,
        body: {
          newPassword: newPassword.trim(),
        },
      });
      Alert.alert("Senha alterada", "Agora entre novamente com a nova senha.", [
        {
          text: "Continuar",
          onPress: () => {
            concluirFluxoAposTroca().catch(() => router.replace("/tela10"));
          },
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao trocar senha.";
      Alert.alert("Erro", message);
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
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Seguranca</Text>
          <Text style={styles.title}>Atualize sua senha</Text>
          <Text style={styles.text}>
            Para continuar, atualize sua senha.
          </Text>

          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Nova senha"
            placeholderTextColor="#71717a"
            secureTextEntry
            style={styles.input}
            editable={!loading}
          />

          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirmar nova senha"
            placeholderTextColor="#71717a"
            secureTextEntry
            style={styles.input}
            editable={!loading}
          />

          <Pressable
            onPress={salvarNovaSenha}
            disabled={!canSubmit || loading}
            style={[styles.button, !canSubmit || loading ? styles.buttonDisabled : null]}
          >
            {loading ? <ActivityIndicator color="#09090b" /> : <Text style={styles.buttonText}>Salvar nova senha</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  keyboard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#0a0a0a",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 20,
    gap: 14,
  },
  eyebrow: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  title: {
    color: "#fafafa",
    fontSize: 28,
    fontWeight: "800",
  },
  text: {
    color: "#d4d4d8",
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#111111",
    color: "#fafafa",
    paddingHorizontal: 14,
    fontSize: 15,
  },
  button: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#facc15",
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#09090b",
    fontSize: 15,
    fontWeight: "900",
  },
});
