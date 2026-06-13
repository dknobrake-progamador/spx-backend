# Solucao Exata - Expo Go Estavel (SDK 54)

## Problema real

Nao era falha de rede/Wi-Fi.
O celular recebia o manifesto do Expo, mas falhava depois ao baixar o bundle Android, gerando erro de `failed download remote update` e carregamento infinito.

## Causa raiz

O bundle Android ainda nao estava "quente" quando o Expo Go tentava baixar.
Tambem havia risco de conflito de processo/porta em 8081.

## Solucao que funcionou (ordem exata)

1. Encerrar processos antigos (node/expo/metro) e liberar porta 8081.
2. Subir Expo em LAN, offline, producao e minificado.
3. Pre-gerar bundle Android antes de abrir no celular.
4. So depois abrir no Expo Go.

## Comando de inicializacao estavel

Executar no diretorio do projeto:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME='192.168.10.150'
$env:EXPO_NO_TELEMETRY='1'
$env:EXPO_OFFLINE='1'
$env:NODE_ENV='production'

node .\node_modules\expo\bin\cli start `
  --offline `
  --go `
  --clear `
  --port 8081 `
  --no-dev `
  --minify `
  --max-workers 2
```

## Pre-geracao do bundle Android (passo decisivo)

Com o Metro ja em execucao:

```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=android&dev=false&hot=false&lazy=true&transform.engine=hermes&minify=true" -OutFile "$env:TEMP\expo-android-bundle-stable.js"
(Get-Item "$env:TEMP\expo-android-bundle-stable.js").Length
```

Validacao esperada:
- Resposta HTTP 200
- Arquivo de bundle gerado com tamanho > 0

## Link para abrir no Expo Go

```text
exp://192.168.10.150:8081/--/
```

## Observacoes importantes

- Evitar alternar entre 8081 e 8082 durante a mesma sessao.
- Nao usar `--tunnel` quando ngrok estiver instavel.
- Se cair novamente, repetir exatamente este procedimento (mesma ordem).
