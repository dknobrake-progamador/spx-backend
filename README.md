# APK Shopee

Aplicativo Expo/React Native com `expo-router`.

## Instalacao

```bash
npm install
```

## Comandos principais

```bash
npm run start
npm run start:go
npm run start:stable
npm run android
npm run web
```

## Expo Go estavel

Use este comando quando o Expo Go falhar com `failed download remote update` ou ficar carregando sem abrir:

```bash
npm run start:stable
```

O script [`scripts/start-expo-go-stable.ps1`](./scripts/start-expo-go-stable.ps1):

- encerra processos antigos na porta `8081`
- detecta o IP LAN automaticamente
- sobe o Expo em modo estavel para Expo Go
- pre-gera o bundle Android antes da conexao do celular
- mostra no terminal o link `exp://...` pronto para abrir

## Fluxo recomendado

1. Conecte o celular e o PC na mesma rede Wi-Fi.
2. Execute `npm run start:stable`.
3. Aguarde a mensagem de bundle gerado com sucesso.
4. Abra o link `exp://...` no Expo Go.

## Observacoes

- A porta padrao do projeto para Expo Go e `8081`.
- Evite alternar entre `8081` e `8082` na mesma sessao.
- O projeto usa Expo SDK 54, entao mantenha o Expo Go atualizado.
