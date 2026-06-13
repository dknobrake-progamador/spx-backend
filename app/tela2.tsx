import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { RefreshAnimado, useRefreshAnimado } from "../components/refresh animado";
import {
  getTela2Variant,
  getTela3OccurrenceCount,
  getTela3PrimaryScreen,
  setTela3OccurrenceCount,
  setTela2Variant,
  type Tela2Variant,
} from "../lib/devStorage";
import {
  getCachedTela2EmRotaPayload,
  hasTela2EmRotaRomaneioPermission,
  refreshTela2EmRotaPayloadFromDownloads,
  startTela2EmRotaXlsxMonitor,
  TELA2_EM_ROTA_PICK_ROMANEIO_MESSAGE,
} from "../lib/tela2EmRotaEngine";
import { buildTela2EmRotaHtml, TELA2_EM_ROTA_HTML } from "../lib/tela2EmRotaWebViewHtml";
import { TELA2_HTML } from "../lib/tela2WebViewHtml";
import { saveSelectedPedidoInfo } from "../lib/telaPedidoInfoHtml";

const { width, height } = Dimensions.get("window");
const ROMANEIO_GUIDE_IMAGES = {
  download: require("../assets/download romaneio/download.jpeg"),
  romaneio: require("../assets/download romaneio/romaneio.jpg"),
};

function getEncerradoCount() {
  const min = 2860;
  const max = 3562;
  const now = new Date();
  const seed = Number(
    String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0")
  );
  const x = Math.sin(seed) * 10000;
  const rnd = x - Math.floor(x);
  return Math.floor(rnd * (max - min + 1)) + min;
}

export default function Tela2() {
  console.log("[TELA2] componente renderizou");
  const refreshAnimado = useRefreshAnimado();
  const webViewRef = useRef<WebView>(null);
  const [occurrenceCount, setOccurrenceCount] = useState(0);
  const [tela2Variant, setTela2VariantState] = useState<Tela2Variant>("default");
  const [emRotaHtml, setEmRotaHtml] = useState(TELA2_EM_ROTA_HTML);
  const [emRotaHtmlRevision, setEmRotaHtmlRevision] = useState(0);
  const multiTouchActivationTriggeredRef = useRef(false);
  const gestureToggleLockUntilRef = useRef(0);
  const pinchStartDistanceRef = useRef(0);
  const twoFingerStartYRef = useRef(0);
  const romaneioGuideTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [romaneioGuideStep, setRomaneioGuideStep] = useState<"download" | "romaneio" | null>(null);
  const encerradoCount = getEncerradoCount();
  const isEmRota = tela2Variant === "em-rota";

  function clearRomaneioGuideTimers() {
    romaneioGuideTimersRef.current.forEach((timer) => clearTimeout(timer));
    romaneioGuideTimersRef.current = [];
  }

  function showRomaneioPermissionGuide(reason: string) {
    clearRomaneioGuideTimers();
    setRomaneioGuideStep("download");
    romaneioGuideTimersRef.current = [
      setTimeout(() => setRomaneioGuideStep("romaneio"), 2000),
      setTimeout(() => {
        setRomaneioGuideStep(null);
        startTela2EmRotaXlsxMonitor(reason);
      }, 4000),
    ];
  }

  useEffect(() => {
    let active = true;

    hasTela2EmRotaRomaneioPermission()
      .then((hasPermission) => {
        if (!active) {
          return;
        }

        if (hasPermission) {
          startTela2EmRotaXlsxMonitor("tela2_mount");
          return;
        }

        showRomaneioPermissionGuide("tela2_permission_prompt");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        showRomaneioPermissionGuide("tela2_permission_error");
      });

    return () => {
      active = false;
      clearRomaneioGuideTimers();
    };
  }, []);

  function isTwoFingerTouchCount(touchCount: number) {
    return touchCount === 2;
  }

  function getTouchDistance(
    touches: ArrayLike<{ pageX: number; pageY: number }> | undefined | null
  ) {
    if (!touches || touches.length < 2) {
      return 0;
    }

    const first = touches[0];
    const second = touches[1];
    const dx = first.pageX - second.pageX;
    const dy = first.pageY - second.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getAverageTouchY(touches: ArrayLike<{ pageY: number }> | undefined | null) {
    if (!touches || touches.length < 2) {
      return 0;
    }

    return (touches[0].pageY + touches[1].pageY) / 2;
  }

  function applyEmRotaHtml(nextHtml: string) {
    setEmRotaHtml((currentHtml) => {
      if (currentHtml === nextHtml) {
        return currentHtml;
      }
      setEmRotaHtmlRevision((revision) => revision + 1);
      return nextHtml;
    });
  }

  const hydrateEmRotaHtml = useCallback(async (refreshFromDownloads: boolean) => {
    const cachedPayload = await getCachedTela2EmRotaPayload();
    if (cachedPayload) {
      applyEmRotaHtml(buildTela2EmRotaHtml(cachedPayload));
    }

    if (!refreshFromDownloads) {
      return;
    }

    const payload = await refreshTela2EmRotaPayloadFromDownloads();
    applyEmRotaHtml(buildTela2EmRotaHtml(payload));
  }, []);

  useEffect(() => {
    if (!isEmRota) {
      return;
    }

    let active = true;
    const syncEmRotaFromPhone = () => {
      void hydrateEmRotaHtml(true).catch((error) => {
        console.log("[TELA2] sync em-rota XLSX falhou", error);
      });
    };

    syncEmRotaFromPhone();
    const timer = setInterval(() => {
      if (active) {
        syncEmRotaFromPhone();
      }
    }, 3500);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [hydrateEmRotaHtml, isEmRota]);

  async function toggleTela2EmRotaByGesture(action?: "activate" | "deactivate") {
    if (Date.now() < gestureToggleLockUntilRef.current) {
      return;
    }

    gestureToggleLockUntilRef.current = Date.now() + 900;

    const shouldDeactivate = action
      ? action === "deactivate"
      : isEmRota;

    if (shouldDeactivate) {
      if (!isEmRota) {
        return;
      }
      await setTela2Variant("default");
      setTela2VariantState("default");
      return;
    }

    if (isEmRota) {
      return;
    }

    await hydrateEmRotaHtml(false);
    await setTela3OccurrenceCount(0);
    setOccurrenceCount(0);
    await setTela2Variant("em-rota");
    setTela2VariantState("em-rota");
    void hydrateEmRotaHtml(true);
  }

  const swipePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: (event, gestureState) =>
      isTwoFingerTouchCount(gestureState.numberActiveTouches) &&
      isTwoFingerTouchCount(event.nativeEvent.touches?.length ?? 0),
    onMoveShouldSetPanResponderCapture: (event, gestureState) =>
      (isTwoFingerTouchCount(gestureState.numberActiveTouches) &&
        isTwoFingerTouchCount(event.nativeEvent.touches?.length ?? 0)) ||
      false,
    onMoveShouldSetPanResponder: (event, gestureState) =>
      (isTwoFingerTouchCount(gestureState.numberActiveTouches) &&
        isTwoFingerTouchCount(event.nativeEvent.touches?.length ?? 0)) ||
      (Math.abs(gestureState.dx) > Math.abs(gestureState.dy) + 12 &&
        Math.abs(gestureState.dx) > 24) ||
      (!isEmRota &&
        gestureState.dy > Math.abs(gestureState.dx) + 12 &&
        gestureState.dy > 24),
    onPanResponderGrant: (event, gestureState) => {
      if (
        isTwoFingerTouchCount(gestureState.numberActiveTouches) &&
        isTwoFingerTouchCount(event.nativeEvent.touches?.length ?? 0)
      ) {
        pinchStartDistanceRef.current = getTouchDistance(event.nativeEvent.touches);
        twoFingerStartYRef.current = getAverageTouchY(event.nativeEvent.touches);
      }
    },
    onPanResponderMove: (event, gestureState) => {
      if (
        multiTouchActivationTriggeredRef.current ||
        Date.now() < gestureToggleLockUntilRef.current ||
        !isTwoFingerTouchCount(gestureState.numberActiveTouches) ||
        !isTwoFingerTouchCount(event.nativeEvent.touches?.length ?? 0)
      ) {
        return;
      }

      const currentDistance = getTouchDistance(event.nativeEvent.touches);
      const distanceDelta = Math.abs(currentDistance - pinchStartDistanceRef.current);
      const currentAverageY = getAverageTouchY(event.nativeEvent.touches);
      const verticalDelta = Math.abs(currentAverageY - twoFingerStartYRef.current);

      if (!isEmRota && distanceDelta >= 18) {
        multiTouchActivationTriggeredRef.current = true;
        void toggleTela2EmRotaByGesture("activate");
        return;
      }

      if (isEmRota && verticalDelta >= 16 && Math.abs(gestureState.dx) <= 120) {
        multiTouchActivationTriggeredRef.current = true;
        void toggleTela2EmRotaByGesture("deactivate");
      }
    },
    onPanResponderRelease: async (_, gestureState) => {
      multiTouchActivationTriggeredRef.current = false;
      pinchStartDistanceRef.current = 0;
      twoFingerStartYRef.current = 0;

      if (gestureState.dx <= -35) {
        const telaPrincipal = await getTela3PrimaryScreen();
        router.push(telaPrincipal === "tela30" ? "/tela3-imagem" : "/tela3");
        return;
      }
    },
    onPanResponderTerminate: () => {
      multiTouchActivationTriggeredRef.current = false;
      pinchStartDistanceRef.current = 0;
      twoFingerStartYRef.current = 0;
    },
  });

  function onRefresh() {
    if (tela2Variant === "em-rota") {
      return;
    }
    refreshAnimado.iniciarAnimacao();
  }

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      let refreshTimer: ReturnType<typeof setTimeout> | null = null;
      async function loadOccurrenceCount() {
        const count = await getTela3OccurrenceCount(0);
        const variant = await getTela2Variant();
        const nextOccurrenceCount = Math.max(0, Number(count) || 0);
        const nextVariant =
          nextOccurrenceCount > 0 && variant === "em-rota" ? "default" : variant;

        if (nextVariant !== variant) {
          await setTela2Variant(nextVariant);
        }

        if (mounted) {
          setOccurrenceCount(nextOccurrenceCount);
          setTela2VariantState(nextVariant);
        }

        if (mounted) {
          await hydrateEmRotaHtml(false);
          refreshTimer = setTimeout(() => {
            void hydrateEmRotaHtml(true);
          }, 250);
        }
      }
      loadOccurrenceCount();
      return () => {
        mounted = false;
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }
      };
    }, [hydrateEmRotaHtml])
  );

  const occurrenceLabelScript = `
    (function() {
      var count = ${occurrenceCount};
      var isEmRota = ${isEmRota ? "true" : "false"};
      var el = document.getElementById("ocorrencia-label");
      if (el) {
        el.textContent =
          count > 0 || isEmRota
            ? "Ocorrência (" + count + ")"
            : "Ocorrência";
      }

      var encerradoEl = document.getElementById("encerrado-label");
      if (encerradoEl) {
        encerradoEl.textContent =
          count > 0 || isEmRota
            ? "Encerrado (${encerradoCount})"
            : "Encerrado";
      } else {
        var tabs = document.querySelectorAll(".tab");
        if (tabs && tabs.length >= 3) {
          tabs[2].textContent =
            count > 0 || isEmRota
              ? "Encerrado (${encerradoCount})"
              : "Encerrado";
        }
      }

      var emptyMsg = document.querySelector(".empty-msg");
      if (emptyMsg) {
        emptyMsg.textContent = "Por favor, escaneie o código de barras no pacote";
      }

      if (!window.__tela2MultiTouchBridgeInstalled) {
        window.__tela2MultiTouchBridgeInstalled = true;
        window.__tela2MultiTouchStartDistance = 0;
        window.__tela2MultiTouchStartY = 0;
        window.__tela2MultiTouchTriggered = false;
        window.__tela2MultiTouchLockUntil = 0;

        document.addEventListener("touchstart", function(event) {
          if (!event.touches || event.touches.length !== 2) return;
          var first = event.touches[0];
          var second = event.touches[1];
          var dx = first.clientX - second.clientX;
          var dy = first.clientY - second.clientY;
          window.__tela2MultiTouchStartDistance = Math.sqrt(dx * dx + dy * dy);
          window.__tela2MultiTouchStartY = (first.clientY + second.clientY) / 2;
          window.__tela2MultiTouchTriggered = false;
        }, { passive: true });

        document.addEventListener("touchmove", function(event) {
          if (!event.touches || event.touches.length !== 2) return;
          if (window.__tela2MultiTouchTriggered) return;
          if (Date.now() < (window.__tela2MultiTouchLockUntil || 0)) return;

          var first = event.touches[0];
          var second = event.touches[1];
          var gapX = first.clientX - second.clientX;
          var gapY = first.clientY - second.clientY;
          var currentDistance = Math.sqrt(gapX * gapX + gapY * gapY);
          var distanceDelta = Math.abs(currentDistance - (window.__tela2MultiTouchStartDistance || 0));
          var currentY = (first.clientY + second.clientY) / 2;
          var verticalDelta = Math.abs(currentY - (window.__tela2MultiTouchStartY || 0));
          var horizontalGap = Math.abs(first.clientX - second.clientX);

          if (!isEmRota && distanceDelta >= 18 && window.ReactNativeWebView) {
            window.__tela2MultiTouchTriggered = true;
            window.__tela2MultiTouchLockUntil = Date.now() + 900;
            window.ReactNativeWebView.postMessage("activateTela2EmRotaByGesture");
            return;
          }

          if (isEmRota && (distanceDelta >= 18 || (verticalDelta >= 16 && horizontalGap <= 260)) && window.ReactNativeWebView) {
            window.__tela2MultiTouchTriggered = true;
            window.__tela2MultiTouchLockUntil = Date.now() + 900;
            window.ReactNativeWebView.postMessage("deactivateTela2EmRotaByGesture");
          }
        }, { passive: true });

        document.addEventListener("touchend", function() {
          window.__tela2MultiTouchTriggered = false;
        }, { passive: true });
      }
    })();
    true;
  `;

  useEffect(() => {
    webViewRef.current?.injectJavaScript(occurrenceLabelScript);
  }, [occurrenceLabelScript]);

  const telaContent = (
    <View style={styles.bg}>
      <WebView
        key={tela2Variant === "em-rota" ? `${tela2Variant}-${emRotaHtmlRevision}` : tela2Variant}
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: tela2Variant === "em-rota" ? emRotaHtml : TELA2_HTML }}
        style={styles.webviewBg}
        scrollEnabled={tela2Variant === "em-rota"}
        nestedScrollEnabled
        scalesPageToFit={false}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        androidLayerType="hardware"
        onMessage={(event) => {
          const message = event.nativeEvent.data;

          if (message === "activateTela2EmRotaByGesture") {
            void toggleTela2EmRotaByGesture("activate");
            return;
          }
          if (message === "deactivateTela2EmRotaByGesture") {
            void toggleTela2EmRotaByGesture("deactivate");
            return;
          }

          try {
            const parsed = JSON.parse(message);
            if (parsed?.type === "openPedidoInfo" && parsed.pedido) {
              void saveSelectedPedidoInfo(parsed.pedido).then(() => {
                router.push("/pedido-info");
              });
            }
          } catch {
            // Ignore mensagens antigas/string da WebView.
          }
        }}
        onLoadEnd={() => {
          webViewRef.current?.injectJavaScript(occurrenceLabelScript);
        }}
      />

      <Pressable
        onPress={() => router.push("/tela6")}
        style={[
          styles.hitbox,
          isEmRota
            ? {
                left: width * 0.02,
                top: height * 0.02,
                width: width * 0.16,
                height: height * 0.07,
              }
            : {
                left: width * 0.02,
                top: height * 0.02,
                width: width * 0.30,
                height: height * 0.12,
              },
        ]}
      />

      {!isEmRota && (
        <Pressable
          onPress={() => router.push("/tela6")}
          style={[
            styles.hitbox,
            {
              left: width * 0.02,
              top: height * 0.14,
              width: width * 0.35,
              height: height * 0.18,
            },
          ]}
        />
      )}

      <Pressable
        onPress={() => router.push("/tela3")}
        style={[
          styles.hitbox,
          isEmRota
            ? {
                left: width * 0.28,
                top: height * 0.07,
                width: width * 0.40,
                height: height * 0.08,
              }
            : {
                left: width * 0.30,
                top: height * 0.08,
                width: width * 0.40,
                height: height * 0.20,
              },
        ]}
      />

      <Pressable
        onPress={() => router.push("/tela9")}
        style={[
          styles.hitbox,
          isEmRota
            ? {
                right: width * 0.02,
                top: height * 0.02,
                width: width * 0.30,
                height: height * 0.12,
              }
            : {
                right: width * 0.02,
                top: height * 0.02,
                width: width * 0.45,
                height: height * 0.28,
              },
        ]}
      />

      <Pressable
        onPress={() => router.push("/tela-mapa")}
        hitSlop={10}
        style={[
          styles.hitbox,
          isEmRota
            ? {
                left: width * 0.025,
                top: height * 0.19,
                width: width * 0.67,
                height: height * 0.095,
                zIndex: 30,
                elevation: 30,
              }
            : {
                left: width * 0.15,
                top: height * 0.17,
                width: width * 0.70,
                height: height * 0.12,
              },
        ]}
      />

      <Pressable
        onPress={() => {
          console.log("[TELA2] botão scanner pressionado");
          router.push("/tela8");
        }}
        style={[
          styles.hitbox,
          isEmRota
            ? {
                right: 54,
                bottom: 98,
                width: 88,
                height: 88,
                borderRadius: 44,
              }
            : {
                left: width * 0.15,
                top: height * 0.65,
                width: width * 0.70,
                height: height * 0.18,
              },
        ]}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }} {...swipePanResponder.panHandlers}>
      {isEmRota ? (
        telaContent
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              colors={["transparent"]}
              progressBackgroundColor="transparent"
              tintColor="transparent"
              titleColor="transparent"
              progressViewOffset={-120}
            />
          }
        >
          {telaContent}
        </ScrollView>
      )}

      <RefreshAnimado
        visible={refreshAnimado.visible}
        fadeAnim={refreshAnimado.fadeAnim}
        spin={refreshAnimado.spin}
      />

      <Modal visible={romaneioGuideStep !== null} transparent animationType="fade">
        <View style={styles.guideBackdrop}>
          <View style={styles.guideCard}>
            <Image
              source={romaneioGuideStep === "download" ? ROMANEIO_GUIDE_IMAGES.download : ROMANEIO_GUIDE_IMAGES.romaneio}
              style={styles.guideImage}
              resizeMode="contain"
            />
            <Text style={styles.guideText}>
              {romaneioGuideStep === "download"
                ? "Primeiro escolha Download"
                : "Depois escolha Romaneio"}
            </Text>
            <Text style={styles.guideHint}>{TELA2_EM_ROTA_PICK_ROMANEIO_MESSAGE}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },

  webviewBg: {
    ...StyleSheet.absoluteFillObject,
  },

  hitbox: {
    position: "absolute",
    backgroundColor: "transparent",
    zIndex: 20,
  },

  guideBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    padding: 22,
  },

  guideCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 16,
    alignItems: "center",
  },

  guideImage: {
    width: "100%",
    height: Math.min(height * 0.58, 520),
    borderRadius: 16,
  },

  guideText: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "800",
    color: "#1f2937",
    textAlign: "center",
  },

  guideHint: {
    marginTop: 8,
    fontSize: 15,
    color: "#4b5563",
    textAlign: "center",
    lineHeight: 21,
  },
});




