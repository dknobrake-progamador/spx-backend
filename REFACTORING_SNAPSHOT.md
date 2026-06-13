# Snapshot de Refatoracao Segura

Data: 2026-06-05

## Objetivo

Aplicar refatoracao incremental sem alterar comportamento publico do app.
Esta etapa protege os fluxos que ja estavam funcionando e reduz arquivos grandes
com extracoes pequenas e testaveis.

## Fluxos Protegidos

- Login e decisao de navegacao apos senha.
- Cache local de fotos baixadas da nuvem.
- Tela 6 usando cache local/nuvem sem depender sempre de assets.
- Upload da Tela 6 em WebP quando a imagem e selecionada pelo usuario.
- Placas com dois slots e troca por long press.
- Mapa normal abrindo na localizacao atual quando permitido.
- Mapa em rota com card de AT e marcadores da rota.
- Scanner e armazenamento de ocorrencias.

## Regras Aplicadas

- Nao gerar APK sem ordem direta do usuario.
- Nao renomear exports usados por telas.
- Nao remover codigo morto sem prova e validacao.
- Nao mexer em backend, Firebase, schema ou rotas de API nesta etapa.
- Rodar validacao TypeScript apos extracoes estruturais.

## Refatoracao Aplicada Nesta Etapa

- Criado `lib/photoCache.ts` para concentrar persistencia local de imagens,
  leitura para data URL, download de imagens remotas e cache gerenciado.
- `lib/devStorage.ts` continua expondo as mesmas funcoes publicas, mas agora
  delega a parte de arquivos/imagens para `lib/photoCache.ts`.
- Criado `lib/telaMapaWebViewHtml.ts` para concentrar o HTML do WebView do mapa.
- Criado `lib/telaMapaFallbackMarkers.ts` para manter os marcadores fallback
  da rota fora da tela.
- Criado `lib/telaMapaRouteAdapter.ts` para converter payload da rota em
  marcadores e extrair o label da AT.
- `app/tela-mapa.tsx` ficou focado em estado, permissao de localizacao e UI.

## Validacao Executada

- `npx tsc --noEmit` executado com sucesso apos as extracoes.
- Nenhum APK foi gerado nesta etapa.

## Como Validar

- Executar `npx tsc --noEmit`.
- Entrar no app, fazer login e abrir Tela 6.
- Ir para Tela 2 e voltar para Tela 6, conferindo se a imagem continua.
- Abrir mapa normal e mapa em rota, verificando localizacao, marcadores e AT.
- Testar upload de uma imagem da Tela 6 e confirmar que nao abre loop.

## Observacao

Este arquivo e um marco de seguranca da refatoracao. Ele nao participa do app
em runtime e pode ser usado para conferir o que foi feito sem depender do chat.
