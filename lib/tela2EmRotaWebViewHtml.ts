import { extractAtIdFromText, TELA2_EM_ROTA_FALLBACK_PAYLOAD } from "./tela2EmRotaEngine";
import type { Tela2EmRotaPayload } from "./tela2EmRotaTypes";

const FALLBACK_AT_ID = extractAtIdFromText(TELA2_EM_ROTA_FALLBACK_PAYLOAD.atId);

function getPayloadAtId(payload: Tela2EmRotaPayload) {
  const payloadAtId = extractAtIdFromText(payload.atId);
  if (payloadAtId) {
    return payloadAtId;
  }

  for (const stop of payload.stops) {
    const orderAtId = stop.orders.map((order) => extractAtIdFromText(order.atId)).find(Boolean);
    if (orderAtId) {
      return orderAtId;
    }
  }

  return (
    extractAtIdFromText(payload.sourceFileName) ||
    extractAtIdFromText(payload.sourceFileUri) ||
    FALLBACK_AT_ID
  );
}

export function buildTela2EmRotaHtml(payload: Tela2EmRotaPayload) {
  const totalOrders = payload.totalOrders;
  const dataJson = JSON.stringify(payload.stops);
  const atId = getPayloadAtId(payload);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Lista de Entregas</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#f5f6fb;height:100%;overflow:hidden;touch-action:pan-y}
body{-webkit-text-size-adjust:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:430px;margin:0 auto;color:#1C1C1E;font-size:14px}
.page-shell{height:100vh;display:flex;flex-direction:column;overflow:hidden}
.phone-top-space{background:#fff;height:36px;width:100%}
.top-nav{background:#fff;padding:10px 16px 12px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.nav-left{display:flex;align-items:center;gap:10px}
.hamburger{display:flex;flex-direction:column;gap:3.5px;cursor:pointer}
.hamburger span{display:block;width:16px;height:1.8px;background:#2e3a4e;border-radius:2px}
.brand-pill{display:flex;align-items:center;gap:7px;background:#f2f2f2;border-radius:20px;padding:6px 14px 6px 12px}
.brand-label{font-size:15px;font-weight:500;color:#687487}
.nav-icons{display:flex;align-items:center;gap:14px}
.tab-bar{background:#fff;display:flex;padding:0;border-bottom:1.5px solid #e5e5e5;width:100%;flex-shrink:0}
.scroll-area{flex:1;overflow-y:auto;overflow-x:hidden;padding-bottom:116px}
.tab{flex:1;padding:12px 0 10px;font-size:15px;font-weight:400;color:#888;position:relative;cursor:pointer;white-space:nowrap;text-align:center}
.tab.active{color:#222;font-weight:500}
.tab.active::after{content:'';position:absolute;bottom:-1.5px;left:10%;width:80%;height:2.5px;background:#e85d2a;border-radius:2px}
.screen-pad{padding:10px 12px 0}
.recommend-card{height:50px;background:#fff;border:2px solid #df6d47;border-radius:4px;position:relative;display:flex;align-items:center;justify-content:center;color:#e45c31;font-weight:600;font-size:16px}
.recommend-card:before{content:"";position:absolute;left:-1px;top:-1px;width:0;height:0;border-top:24px solid #f05a2b;border-right:24px solid transparent}
.recommend-card:after{content:"✓";position:absolute;left:3px;top:0;color:#fff;font-size:12px;font-weight:700}
.recommend-arrow{display:inline-block;margin-left:8px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #f05a2b}
.toolbar{display:grid;grid-template-columns:minmax(0,1.7fr) 58px 58px;gap:8px;padding:14px 0 10px;align-items:stretch}
.toolbar-map{min-width:0;height:50px;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:16px;padding:0 14px;font-size:clamp(13px,3.2vw,16px);color:#667284;cursor:pointer;background:#fff;border:1px solid #eff1f6;white-space:nowrap;overflow:hidden}
.toolbar-map svg{width:28px;height:28px;flex-shrink:0}
.toolbar-sq{width:58px;height:50px;border:1px solid #eff1f6;border-radius:16px;display:flex;align-items:center;justify-content:center;background:#fff;cursor:pointer;flex-shrink:0}
.at-row{display:flex;align-items:center;justify-content:center;gap:16px;padding:8px 10px 8px;color:#7f8897;font-size:12px;font-weight:600;letter-spacing:.2px}
.at-line{width:72px;height:2px;background:#7f8897;border-radius:2px;opacity:.85}
.scroll-list{padding-bottom:52px}
.stop-block{background:#fff;border:1px solid #eff1f6;border-radius:18px;overflow:hidden;margin-top:10px}
.stop-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;background:#fff;border-bottom:1px solid #f0f1f5}
.stop-header b{font-size:15px;font-weight:700;color:#212734}
.stop-arrow{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid #dfe3eb;border-radius:10px;background:#fff}
.card{background:#fff;border-bottom:1px solid #f0f1f5;padding:16px 18px 18px}
.pedido-card{cursor:pointer}
.pedido-card:active{background:#fafbfe}
.card:last-child{border-bottom:none}
.card-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.num{background:#fff3f0;color:#ef6540;border-radius:4px;font-size:12px;font-weight:700;padding:4px 8px;min-width:34px;text-align:center;display:inline-block}
.code{font-size:12px;color:#8f98a6;letter-spacing:.2px}
.copy{background:none;border:none;cursor:pointer;padding:0 3px;display:inline-flex;align-items:center}
.addr{display:flex;gap:8px;align-items:flex-start;margin-bottom:14px}
.addr-text{font-size:17px;font-weight:700;color:#2f3441;line-height:1.35;word-break:break-word}
.bottom-row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.dest-label{font-size:13px;color:#7d8795;margin-bottom:2px}
.dest-name{font-size:13px;color:#5f6673;line-height:1.25;max-width:190px}
.btns{display:flex;gap:12px;flex-shrink:0;padding-bottom:2px}
.circle-btn{width:58px;height:58px;background:#f5f6fb;border-radius:50%;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer}
.tags{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
.tag{font-size:11px;border:1px solid #cfd4dc;border-radius:4px;padding:3px 8px;color:#7b8593;background:#fff}
.fab-scan{position:fixed;right:54px;bottom:98px;width:clamp(68px,18vw,78px);height:clamp(68px,18vw,78px);border-radius:999px;background:#e56a49;box-shadow:0 8px 18px rgba(229,106,73,.18),0 2px 6px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;z-index:20}
.fab-scan svg{width:clamp(30px,8vw,36px);height:clamp(30px,8vw,36px)}
</style>
</head>
<body>
<div class="page-shell">
<div class="phone-top-space"></div>
<div class="top-nav">
  <div class="nav-left">
    <div class="hamburger"><span></span><span></span><span></span></div>
    <div class="brand-pill">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5568" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 9h20v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9z"/>
        <path d="M2 9l2-5h16l2 5"/>
        <line x1="12" y1="13" x2="12" y2="19"/>
        <polyline points="9 16 12 13 15 16"/>
      </svg>
      <span class="brand-label">Entrega</span>
    </div>
  </div>
  <div class="nav-icons">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d4a5c" stroke-width="2.2" stroke-linecap="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d4a5c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <circle cx="9" cy="11" r="1" fill="#3d4a5c" stroke="none"/>
      <circle cx="12" cy="11" r="1" fill="#3d4a5c" stroke="none"/>
      <circle cx="15" cy="11" r="1" fill="#3d4a5c" stroke="none"/>
    </svg>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d4a5c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  </div>
</div>
<div class="tab-bar">
  <div class="tab active" id="em-rota-label">Em Rota (${totalOrders})</div>
  <div class="tab" id="ocorrencia-label">Ocorrência</div>
  <div class="tab" id="encerrado-label">Encerrado</div>
</div>
<div class="screen-pad">
  <div class="recommend-card">
    Recomendar <span class="recommend-arrow"></span>
  </div>
  <div class="toolbar">
    <div class="toolbar-map">
      <svg viewBox="0 0 24 24" fill="none" stroke="#667284" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        <line x1="8" y1="2" x2="8" y2="18"/>
        <line x1="16" y1="6" x2="16" y2="22"/>
      </svg>
      Mostrar no mapa
    </div>
    <button class="toolbar-sq">
      <svg width="32" height="32" viewBox="0 0 28 28" fill="none" stroke="#5f6875" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8.2 18.8H7.1A2.9 2.9 0 0 1 4.2 15.9V9a2.9 2.9 0 0 1 2.9-2.9h3.2"/>
        <path d="M19.8 6.1H20.9A2.9 2.9 0 0 1 23.8 9v6.9a2.9 2.9 0 0 1-2.9 2.9H8.2"/>
        <line x1="14" y1="4.9" x2="14" y2="16.5"/>
        <polyline points="10.8 13.4 14 16.7 17.2 13.4"/>
      </svg>
    </button>
    <button class="toolbar-sq">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 3.6 24.4 14 14 24.4 3.6 14 14 3.6Z" stroke="#5f6875" stroke-width="2.15" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M11.5 16.7V14.1C11.5 12.9 12.45 11.95 13.65 11.95H16.15" stroke="#5f6875" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <polyline points="14.55 10.15 16.95 11.95 14.55 13.8" stroke="#5f6875" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
    </button>
  </div>
</div>
<div class="scroll-area">
<div class="screen-pad">
  <div class="at-row">
    <span class="at-line"></span>
    <span>${atId}</span>
    <span class="at-line"></span>
  </div>
  <div class="scroll-list" id="list"></div>
</div>
</div>
<div class="fab-scan">
  <svg viewBox="0 0 100 100" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M34 22H22v12"/>
    <path d="M66 22h12v12"/>
    <path d="M34 78H22V66"/>
    <path d="M66 78h12V66"/>
    <path d="M38 50h24"/>
  </svg>
</div>
</div>
<script>
const data = ${dataJson};
const totalOrders = data.reduce(function(sum, stop) { return sum + stop.count; }, 0);
const emRotaLabel = document.getElementById("em-rota-label");
if (emRotaLabel) {
  emRotaLabel.textContent = "Em Rota (" + totalOrders + ")";
}
const pinSVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#8e96a5" style="flex-shrink:0;margin-top:3px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
const copySVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#8f98a6"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>';
const phoneSVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="#5b6778"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>';
const msgSVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="#5b6778"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 11H7v-2h6v2zm3-4H7V7h9v2z"/></svg>';
const stopArrow = '<div class="stop-arrow"><svg width="20" height="20" viewBox="0 0 28 28" fill="none"><path d="M14 3.6 24.4 14 14 24.4 3.6 14 14 3.6Z" stroke="#5f6875" stroke-width="2.15" stroke-linejoin="round" stroke-linecap="round"/><path d="M11.5 16.7V14.1C11.5 12.9 12.45 11.95 13.65 11.95H16.15" stroke="#5f6875" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="14.55 10.15 16.95 11.95 14.55 13.8" stroke="#5f6875" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>';
const list = document.getElementById("list");
const currentAtId = ${JSON.stringify(atId)};
const pedidosByRef = {};
let pedidoRefSeq = 0;
function buildCard(order, stopLabel) {
  const pedidoRef = "pedido-" + (++pedidoRefSeq);
  pedidosByRef[pedidoRef] = Object.assign({}, order, {
    stopLabel: stopLabel || "",
    sourceAtId: currentAtId
  });

  return '<div class="card pedido-card" data-pedido-ref="' + pedidoRef + '">' +
    '<div class="card-top">' +
    '<span class="num">' + (order.num || '-') + '</span>' +
    '<span class="code">' + order.code + '</span>' +
    '<button class="copy">' + copySVG + '</button>' +
    '</div>' +
    '<div class="addr">' + pinSVG + '<span class="addr-text">' + order.address + '</span></div>' +
    '<div class="bottom-row">' +
    '<div><div class="dest-label">Destinatário</div><div class="dest-name">' + order.recipient + '</div></div>' +
    '<div class="btns"><button class="circle-btn">' + phoneSVG + '</button><button class="circle-btn">' + msgSVG + '</button></div>' +
    '</div>' +
    '<div class="tags"><span class="tag">Home</span></div>' +
    '</div>';
}
let html = "";
data.forEach(function(stop) {
  if (stop.stop === "Sem parada") {
    stop.orders.forEach(function(order) {
      html += '<div class="stop-block">' + buildCard(order, "Sem parada") + '</div>';
    });
    return;
  }

  const stopLabel = "Parada " + stop.stop;
  html += '<div class="stop-block"><div class="stop-header"><b>' + stopLabel + ' (' + stop.count + ' Pedido' + (stop.count > 1 ? 's' : '') + ')</b>' + stopArrow + '</div>';
  stop.orders.forEach(function(order) {
    html += buildCard(order, stopLabel);
  });
  html += '</div>';
});
list.innerHTML = html;
Array.prototype.forEach.call(document.querySelectorAll(".pedido-card"), function(card) {
  card.addEventListener("click", function(event) {
    if (event.target && event.target.closest && event.target.closest("button")) {
      return;
    }

    const pedidoRef = card.getAttribute("data-pedido-ref");
    const pedido = pedidosByRef[pedidoRef];
    if (!pedido || !window.ReactNativeWebView) {
      return;
    }

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "openPedidoInfo",
      pedido: pedido
    }));
  });
});
</script>
</body>
</html>`;
}

export const TELA2_EM_ROTA_HTML = buildTela2EmRotaHtml(TELA2_EM_ROTA_FALLBACK_PAYLOAD);
