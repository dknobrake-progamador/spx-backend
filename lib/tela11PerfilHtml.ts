export const TELA11_PERFIL_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Meu Perfil</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; min-height: 100%; background: #f2f2f7; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #111;
    -webkit-font-smoothing: antialiased;
  }
  .topbar {
    background: #fff;
    display: flex;
    align-items: center;
    padding: 12px 18px 10px;
    border-bottom: 0.5px solid #e0e0e5;
    min-height: 48px;
  }
  .back-arrow { font-size: 24px; line-height: 1; color: #222; margin-right: 14px; }
  .title { font-size: 17px; font-weight: 600; color: #111; }
  .section {
    background: #fff;
    margin-top: 8px;
    border-top: 0.5px solid #e0e0e5;
    border-bottom: 0.5px solid #e0e0e5;
  }
  .section.first { margin-top: 0; border-top: none; }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 18px;
    border-bottom: 0.5px solid #ebebef;
    min-height: 44px;
    gap: 16px;
  }
  .row:last-child { border-bottom: none; }
  .row-label { font-size: 14px; color: #111; white-space: nowrap; }
  .row-value {
    font-size: 14px;
    color: #aaaaaf;
    display: flex;
    align-items: center;
    gap: 4px;
    text-align: right;
    min-width: 0;
  }
  .chevron { color: #c7c7cc; font-size: 18px; line-height: 1; }
  .avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #c0bfbf;
    overflow: hidden;
    flex: 0 0 auto;
  }
  .avatar-placeholder img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .avatar-placeholder svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .bank-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
  }
  .edit-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #3a3a3c;
    font-size: 14px;
  }
  .bottom-white {
    background: #fff;
    border-top: 0.5px solid #e0e0e5;
    height: 44px;
    margin-top: 8px;
  }
</style>
</head>
<body>
<div class="topbar">
  <span class="back-arrow">&#8592;</span>
  <span class="title">Meu Perfil</span>
</div>

<div class="section first">
  <div class="row">
    <span class="row-label">Foto</span>
    <div class="avatar-placeholder">__PROFILE_AVATAR__</div>
  </div>
</div>

<div class="section">
  <div class="row">
    <span class="row-label">Nome do motorista</span>
    <span class="row-value">__PROFILE_NAME__</span>
  </div>
  <div class="row">
    <span class="row-label">Número de contato</span>
    <span class="row-value">__PROFILE_PHONE__ <span class="chevron">›</span></span>
  </div>
</div>

<div class="section">
  <div class="row"><span class="row-label">Tipo de contrato</span><span class="row-value">3PL</span></div>
  <div class="row"><span class="row-label">Grupo do motorista</span><span class="row-value">Indefinido</span></div>
  <div class="row"><span class="row-label">Função do motorista</span><span class="row-value">Entrega</span></div>
  <div class="row"><span class="row-label">ID Nacional/Passaporte</span><span class="row-value">Indefinido</span></div>
  <div class="row"><span class="row-label">Número da CNH</span><span class="row-value">__PROFILE_CNH__</span></div>
  <div class="row"><span class="row-label">Tipo de licença</span><span class="row-value">AB</span></div>
  <div class="row"><span class="row-label">Tipo do veículo</span><span class="row-value">__PROFILE_VEHICLE_TYPE__</span></div>
</div>

<div class="section">
  <div class="bank-row">
    <span class="row-label">Informações bancárias</span>
    <div class="edit-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      <span>Editar</span>
    </div>
  </div>
</div>

<div class="bottom-white"></div>
</body>
</html>`;

export const TELA11_DEFAULT_AVATAR = `<svg width="44" height="44" viewBox="0 0 44 44" fill="none">
  <circle cx="22" cy="22" r="22" fill="#c0bfbf"/>
  <ellipse cx="22" cy="17" rx="7.5" ry="8" fill="#e2dfdf"/>
  <ellipse cx="22" cy="35" rx="13.5" ry="9" fill="#e2dfdf"/>
</svg>`;
