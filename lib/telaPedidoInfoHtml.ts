import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Tela2EmRotaOrder } from "./tela2EmRotaTypes";

export const SELECTED_PEDIDO_INFO_KEY = "@DEV_SELECTED_PEDIDO_INFO";

export type TelaPedidoInfoData = Tela2EmRotaOrder & {
  stopLabel?: string;
  sourceAtId?: string;
  sourceType?: "route" | "occurrence";
};

export async function saveSelectedPedidoInfo(data: TelaPedidoInfoData) {
  await AsyncStorage.setItem(SELECTED_PEDIDO_INFO_KEY, JSON.stringify(data));
}

export async function getSelectedPedidoInfo() {
  const raw = await AsyncStorage.getItem(SELECTED_PEDIDO_INFO_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as TelaPedidoInfoData;
  } catch {
    await AsyncStorage.removeItem(SELECTED_PEDIDO_INFO_KEY);
    return null;
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAddress(data: TelaPedidoInfoData) {
  const line1 = escapeHtml(data.address || "Endereco nao informado");
  const line2 = [data.zipcode, data.city, data.district].filter(Boolean).map(escapeHtml).join(", ");
  return line2 ? `${line1}<br>${line2}` : line1;
}

function formatPhone(value: unknown) {
  const phone = String(value ?? "").trim();
  return phone ? `Tel ${phone}` : "Tel nao informado";
}

function buildFallbackPhone(seedText: string) {
  let seed = 0;
  for (let index = 0; index < seedText.length; index += 1) {
    seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0;
  }

  let suffix = "";
  for (let index = 0; index < 7; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    suffix += String(seed % 10);
  }

  return `+552196${suffix}`;
}

export function buildTelaPedidoInfoHtml(data: TelaPedidoInfoData | null) {
  const safeData: TelaPedidoInfoData = data || {
    num: "-",
    sequenceValue: null,
    stopValue: null,
    code: "Codigo nao informado",
    atId: "",
    address: "Endereco nao informado",
    recipient: "Recebedor nao informado",
    district: "",
    city: "",
    zipcode: "",
    latitude: "",
    longitude: "",
    tags: [],
  };

  const code = escapeHtml(safeData.code || safeData.atId || "Codigo nao informado");
  const address = formatAddress(safeData);
  const recipient = escapeHtml(safeData.recipient || "Recebedor nao informado");
  const phoneValue = safeData.phone || buildFallbackPhone(`${safeData.code}|${safeData.address}|${safeData.recipient}`);
  const phone = escapeHtml(formatPhone(phoneValue));
  const hub = escapeHtml(safeData.hub || "Hub nao informado");
  const isOccurrence = safeData.sourceType === "occurrence";
  const shellClass = isOccurrence ? "phone-shell occurrence-page" : "phone-shell";
  const topbarIconsHtml = isOccurrence
    ? `<button aria-label="Ajuda">
        <svg viewBox="0 0 28 28">
          <path d="M14 4.5c5.2 0 9.5 3.6 9.5 8.1 0 4.5-4.3 8.1-9.5 8.1-1 0-2-.13-2.9-.4L6 23l1.2-4.1c-1.7-1.5-2.7-3.7-2.7-6.3 0-4.5 4.3-8.1 9.5-8.1z"/>
          <path d="M11.4 10.5c.35-1.25 1.35-2.05 2.75-2.05 1.65 0 2.9 1.05 2.9 2.55 0 1.3-.8 1.95-1.8 2.65-.8.55-1.25 1.05-1.25 2.05"/>
          <circle cx="14" cy="18.4" r="0.55" fill="#4f5b68" stroke="none"/>
        </svg>
      </button>`
    : `<button aria-label="Compartilhar">
        <svg viewBox="0 0 28 28">
          <rect x="4" y="4" width="17" height="17" rx="1.8"/>
          <path d="M10 4v7h5V4"/>
          <path d="M17 22.5h6.5v-6.5"/>
          <path d="M15.5 24 23.2 16.3"/>
        </svg>
      </button>
      <button aria-label="Ajuda">
        <svg viewBox="0 0 28 28">
          <path d="M14 4.5c5.2 0 9.5 3.6 9.5 8.1 0 4.5-4.3 8.1-9.5 8.1-1 0-2-.13-2.9-.4L6 23l1.2-4.1c-1.7-1.5-2.7-3.7-2.7-6.3 0-4.5 4.3-8.1 9.5-8.1z"/>
          <path d="M11.4 10.5c.35-1.25 1.35-2.05 2.75-2.05 1.65 0 2.9 1.05 2.9 2.55 0 1.3-.8 1.95-1.8 2.65-.8.55-1.25 1.05-1.25 2.05"/>
          <circle cx="14" cy="18.4" r="0.55" fill="#4f5b68" stroke="none"/>
        </svg>
      </button>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Informa&ccedil;&otilde;es do pedido</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body { width: 100%; min-height: 100%; background: #f4f6fb; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Roboto', 'Segoe UI', sans-serif;
      color: #111;
      max-width: 430px;
      margin: 0 auto;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .phone-shell { min-height: 100vh; background: #f4f6fb; display: flex; flex-direction: column; }
    .topbar {
      background: #f4f6fb;
      padding: 48px 22px 28px;
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) 94px;
      align-items: center;
      column-gap: 14px;
      flex-shrink: 0;
    }
    .topbar-left { display: contents; }
    button { font: inherit; }
    .back-btn, .topbar-icons button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .back-btn svg { width: 28px; height: 28px; stroke: #2f3742; stroke-width: 2.35; fill: none; }
    .topbar h1 {
      font-size: clamp(23px, 7vw, 34px);
      font-weight: 500;
      color: #202834;
      letter-spacing: 0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
    }
    .topbar-icons { display: flex; gap: 18px; align-items: center; justify-content: flex-end; }
    .topbar-icons svg { width: 34px; height: 34px; stroke: #4f5b68; stroke-width: 1.9; fill: none; }
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 0 20px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 1px 2px rgba(18,24,40,0.02);
    }
    .tracking-id { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
    .tracking-id-left { min-width: 0; }
    .tracking-code {
      font-size: clamp(18px, 5.2vw, 22px);
      font-weight: 500;
      color: #111827;
      letter-spacing: 0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 18px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
      max-width: 100%;
    }
    .tracking-code-text { min-width: 0; overflow: hidden; text-overflow: clip; white-space: nowrap; }
    .tracking-code button { background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; flex-shrink: 0; }
    .tracking-code svg { width: 21px; height: 21px; stroke: #7b8490; stroke-width: 1.75; fill: none; }
    .address { font-size: 20px; color: #4b5563; line-height: 1.34; max-width: 286px; word-break: break-word; }
    .map-btn {
      background: #f5f7fa;
      border: none;
      cursor: pointer;
      border-radius: 50%;
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .map-btn svg { width: 33px; height: 33px; fill: #4d5a66; }
    .receiver-title {
      font-size: 20px;
      font-weight: 700;
      color: #151a22;
      margin-bottom: 18px;
      padding-bottom: 20px;
      border-bottom: 1px solid #edf0f4;
    }
    .receiver-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 74px; }
    .receiver-info { min-width: 0; }
    .receiver-name { font-size: 18px; color: #6b7280; margin-bottom: 10px; word-break: break-word; }
    .receiver-phone { font-size: clamp(15px, 4.2vw, 18px); font-weight: 500; color: #111827; white-space: nowrap; }
    .receiver-actions { display: flex; gap: 12px; flex-shrink: 0; }
    .action-btn {
      background: #f5f7fa;
      border: none;
      cursor: pointer;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .action-btn svg { width: 27px; height: 27px; fill: #4d5a66; stroke: none; }
    .hub-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .hub-label { font-size: 20px; font-weight: 500; color: #151a22; }
    .hub-value { font-size: 18px; color: #4b5563; text-align: right; }
    .bottom-bar {
      background: #ffffff;
      padding: 14px 20px 38px;
      display: flex;
      gap: 12px;
      border-top: 1px solid #e8e8e8;
      flex-shrink: 0;
    }
    .btn-ocorrencia, .btn-entregue {
      flex: 1;
      height: 44px;
      border-radius: 3px;
      font-size: 17px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.01em;
    }
    .btn-ocorrencia { border: 1.5px solid #e8533a; background: #ffffff; color: #e8533a; }
    .btn-entregue { border: none; background: #f0442e; color: #ffffff; }
    .btn-ocorrencia:active { opacity: 0.8; }
    .btn-entregue:active { opacity: 0.85; }
    .occurrence-page { background: #eef0f3; }
    .occurrence-page .topbar {
      background: #fdf8ee;
      grid-template-columns: 42px minmax(0, 1fr) 42px;
      padding: 42px 22px 12px;
    }
    .occurrence-page .topbar h1 { font-weight: 500; }
    .occurrence-page .topbar-icons { gap: 0; }
    .occurrence-page .content { padding: 0 12px 18px; gap: 10px; }
    .occurrence-banner {
      background: #fdf8ee;
      padding: 8px 20px 22px;
      text-align: center;
    }
    .occurrence-banner h2 {
      color: #f3b12b;
      font-size: clamp(30px, 9vw, 38px);
      font-weight: 800;
      letter-spacing: 0.01em;
    }
    .proof-bar {
      margin: 0 12px 12px;
      background: #ffffff;
      border-radius: 12px;
      min-height: 64px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #f3b12b;
      font-size: clamp(19px, 5vw, 24px);
      font-weight: 500;
    }
    .proof-bar svg {
      width: 28px;
      height: 28px;
      stroke: #8b96a3;
      stroke-width: 2.6;
      fill: none;
      flex-shrink: 0;
    }
    .occurrence-page .card { border-radius: 12px; padding: 18px; }
    .occurrence-page .tracking-id { align-items: center; }
    .occurrence-page .tracking-code { font-size: clamp(20px, 5vw, 25px); font-weight: 500; margin-bottom: 18px; }
    .occurrence-page .address { font-size: clamp(18px, 4.6vw, 23px); line-height: 1.34; max-width: 310px; }
    .occurrence-page .map-btn { width: 66px; height: 66px; background: #f3f5f8; }
    .occurrence-page .receiver-title { font-size: clamp(20px, 5vw, 25px); padding-bottom: 18px; }
    .occurrence-page .receiver-name { font-size: clamp(17px, 4.1vw, 21px); line-height: 1.22; color: #7b7f86; }
    .occurrence-page .receiver-phone { font-size: clamp(16px, 3.8vw, 20px); }
    .occurrence-page .receiver-actions { gap: 18px; }
    .phone-action-wrap { position: relative; display: inline-flex; }
    .green-badge {
      position: absolute;
      right: -2px;
      bottom: -1px;
      width: 18px;
      height: 18px;
      background: #22c55e;
      border: 2px solid #ffffff;
      border-radius: 50%;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .green-badge svg { width: 10px; height: 10px; stroke: #ffffff; stroke-width: 2.4; fill: none; }
    .occurrence-page .green-badge { display: flex; }
    .occurrence-page .hub-label { font-size: clamp(20px, 5vw, 25px); font-weight: 700; }
    .occurrence-page .hub-value { font-size: clamp(17px, 4.1vw, 21px); line-height: 1.18; max-width: 52%; }
    .occurrence-page .bottom-bar { background: #eef0f3; padding: 16px 12px 24px; border-top: none; }
    .btn-reentrega {
      width: 100%;
      height: 60px;
      border: none;
      border-radius: 4px;
      background: #f0442e;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      cursor: pointer;
    }
  </style>
</head>
<body>
<div class="${shellClass}">
  <div class="topbar">
    <div class="topbar-left">
      <button class="back-btn" id="back-btn" aria-label="Voltar">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h1>Informa&ccedil;&otilde;es do pedido</h1>
    </div>
    <div class="topbar-icons">
      ${topbarIconsHtml}
    </div>
  </div>

  ${isOccurrence ? `<div class="occurrence-banner"><h2>Ocorr&ecirc;ncia</h2></div>
  <div class="proof-bar">
    <span>Enviando comprovante de Ocorr&ecirc;ncia</span>
    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>` : ""}

  <div class="content">
    <div class="card">
      <div class="tracking-id">
        <div class="tracking-id-left">
          <div class="tracking-code">
            <span class="tracking-code-text">${code}</span>
            <button aria-label="Copiar codigo">
              <svg viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
          <div class="address">${address}</div>
        </div>
        <button class="map-btn" aria-label="Ver no mapa">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5" fill="#f0f2f5"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="card">
      <div class="receiver-title">Informa&ccedil;&otilde;es do recebedor</div>
      <div class="receiver-row">
        <div class="receiver-info">
          <div class="receiver-name">${recipient}</div>
          <div class="receiver-phone">${phone}</div>
        </div>
        <div class="receiver-actions">
          <span class="phone-action-wrap">
            <button class="action-btn" aria-label="Ligar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
            </button>
            <span class="green-badge"><svg viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          </span>
          <button class="action-btn" aria-label="Mensagem">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 11h8v2H8v-2zm0-4h8v2H8V7z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="hub-row">
        <span class="hub-label">Hub atribu&iacute;do</span>
        <span class="hub-value">${hub}</span>
      </div>
    </div>
  </div>

  <div class="bottom-bar">
    ${isOccurrence
      ? `<button class="btn-reentrega">Reentrega</button>`
      : `<button class="btn-ocorrencia">Ocorr&ecirc;ncia</button><button class="btn-entregue">Entregue</button>`}
  </div>
</div>
<script>
  document.getElementById("back-btn").addEventListener("click", function() {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage("goBack");
    }
  });
</script>
</body>
</html>`;
}
