import Constants from "expo-constants";

const FALLBACK_API_BASE_URLS = [
  "https://spx-backend-1m83.onrender.com",
  "https://spx-backend-1m83.onrender.com",
  "https://spx-backend-1m83.onrender.com",
];

function getConfiguredApiBaseUrl() {
  const envConfigured =
    typeof process !== "undefined" ? String(process.env.EXPO_PUBLIC_AUTH_BASE_URL || "").trim() : "";
  const extraConfigured = String(
    ((Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.authBaseUrl as string) || ""
  ).trim();

  return envConfigured || extraConfigured;
}

function buildHtmlResponseError(path: string, text: string) {
  const routeMissingMatch = text.match(/Cannot\s+(GET|POST|PATCH|DELETE)\s+([^\s<]+)/i);
  if (routeMissingMatch?.[2]) {
    return new Error(
      `Rota ausente no backend: ${routeMissingMatch[2]}. Atualize o servidor publicado ou a URL configurada.`
    );
  }

  return new Error(
    `Servidor respondeu HTML em ${path}. O backend pode estar desatualizado ou a rota nao existe.`
  );
}

export function getApiBaseUrls() {
  const configured = getConfiguredApiBaseUrl();

  const urls = configured ? [configured, ...FALLBACK_API_BASE_URLS] : FALLBACK_API_BASE_URLS;
  return Array.from(new Set(urls.filter(Boolean))).map((url) => url.replace(/\/$/, ""));
}

export async function wakeUpServer(): Promise<boolean> {
  const urls = getApiBaseUrls();
  for (const baseUrl of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) {
        console.log("[API] wakeup_ok", { baseUrl });
        return true;
      }
      console.log("[API] wakeup_not_ok", { baseUrl, status: response.status });
    } catch (error) {
      console.log("[API] wakeup_error", {
        baseUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return false;
}

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  idToken?: string | null;
  timeoutMs?: number;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  let lastError: unknown = null;

  for (const baseUrl of getApiBaseUrls()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
    const startedAt = Date.now();
    const hasToken = !!options.idToken;

    try {
      console.log("[API] request", {
        method: options.method || "GET",
        url: `${baseUrl}${path}`,
        hasToken,
        timeoutMs: options.timeoutMs ?? 12000,
      });
      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(options.idToken ? { Authorization: `Bearer ${options.idToken}` } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      const contentType = response.headers.get("content-type") || "";
      let data: unknown = {};

      if (text) {
        const looksLikeHtml = text.trimStart().startsWith("<");
        const isJsonResponse = contentType.toLowerCase().includes("application/json");

        if (looksLikeHtml && !isJsonResponse) {
          throw buildHtmlResponseError(path, text);
        }

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            `Resposta invalida do servidor em ${path}. Verifique se o backend esta atualizado.`
          );
        }
      }
      console.log("[API] response", {
        method: options.method || "GET",
        url: `${baseUrl}${path}`,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
        contentType,
      });

      if (!response.ok) {
        const errorData = data as { error?: string; details?: string };
        throw new Error(errorData?.error || errorData?.details || `Falha HTTP ${response.status}`);
      }

      return data as T;
    } catch (error) {
      console.log("[API] error", {
        method: options.method || "GET",
        url: `${baseUrl}${path}`,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Servidor indisponivel.";
  if (message.includes("aborted") || message.includes("Network request failed")) {
    throw new Error("Sem conexao com o servidor. Verifique backend, Wi-Fi ou URL publica.");
  }

  throw new Error(message);
}
