# Backend OCR / Admin

Servidor Node/Express usado pelo app para:

- OCR em `/ocr`
- login/cadastro em `/auth/*`
- painel admin em `/admin/*`
- envio de fotos em `/photos/*`
- aplicacao de placa gerada em `/admin/generated-plate`

## Rodar localmente

1. Entre em `backend-ocr`
2. Copie `.env.example` para `.env`
3. Preencha `FIREBASE_WEB_API_KEY`
4. Use uma destas opcoes para a credencial Google/Firebase Admin:

```env
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

ou

```env
GOOGLE_SERVICE_ACCOUNT_JSON={...json da service account...}
```

ou

```env
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=...json em base64...
```

5. Rode:

```sh
npm install
npm start
```

Healthcheck:

```sh
curl http://localhost:3000/health
```

## Deploy no Render

Este projeto agora inclui [render.yaml](./render.yaml). Para publicar a versao que contem `/admin/generated-plate`:

1. Suba este projeto para um repositório Git
2. No Render, crie um Web Service a partir do repositório
3. Confirme `rootDir=backend-ocr`, `buildCommand=npm install` e `startCommand=npm start`
4. Configure as variaveis:

```env
FIREBASE_PROJECT_ID=spx-motorista-parceiro
FIREBASE_WEB_API_KEY=...
GOOGLE_SERVICE_ACCOUNT_JSON={...json da service account...}
```

5. Aguarde o deploy e teste:

```sh
curl https://SUA-URL.onrender.com/health
```

Se estiver tudo certo, a rota abaixo tambem precisa existir:

```sh
curl -X POST https://SUA-URL.onrender.com/admin/generated-plate
```

Sem token ela deve responder `401` JSON. Se responder `Cannot POST /admin/generated-plate`, o servidor publicado ainda esta antigo.

## Apontar o app para a URL nova

Ao iniciar o app Expo, defina:

```env
EXPO_PUBLIC_AUTH_BASE_URL=https://SUA-URL.onrender.com
```

As chamadas do app passarao a usar essa URL antes do fallback antigo.
