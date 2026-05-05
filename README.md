# Backend OCR

Servidor local para Google Vision OCR no formato esperado pela `tela13.tsx`.

## Instalação

```sh
cd backend-ocr
npm install
```

## Configuração

1. Copie `.env.example` para `.env`
2. Coloque a chave do Google em `backend-ocr/google-credentials.json`
3. Ajuste o app com:

```env
EXPO_PUBLIC_GOOGLE_OCR_ENDPOINT=http://SEU_IP:3000/ocr
```

## Rodar

```sh
cd backend-ocr
node server.js
```

## Healthcheck

```sh
curl http://localhost:3000/health
```
