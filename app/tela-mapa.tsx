import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { getTela2Variant } from "../lib/devStorage";
import {
  getCachedTela2EmRotaPayload,
  refreshTela2EmRotaPayloadFromDownloads,
} from "../lib/tela2EmRotaEngine";
import type { Tela2EmRotaPayload } from "../lib/tela2EmRotaTypes";
import { EM_ROTA_MAP_FALLBACK_MARKERS } from "../lib/telaMapaFallbackMarkers";
import {
  buildEmRotaMarkers,
  getPayloadAtLabel,
  hasResolvedCoordinates,
} from "../lib/telaMapaRouteAdapter";
import { buildMapHtml } from "../lib/telaMapaWebViewHtml";

const FALLBACK_LATITUDE = -22.9049;
const FALLBACK_LONGITUDE = -43.2003;
const GOOGLE_MAPS_DEFAULT_ZOOM = 17;
const TOP_WHITE_SPACE = Math.max(StatusBar.currentHeight ?? 0, 22);

type DeviceCoords = {
  latitude: number;
  longitude: number;
};

export default function TelaMapa() {
  const [coords, setCoords] = useState<DeviceCoords>({
    latitude: FALLBACK_LATITUDE,
    longitude: FALLBACK_LONGITUDE,
  });
  const [tela2Variant, setTela2VariantState] = useState<"default" | "em-rota">("default");
  const [emRotaPayload, setEmRotaPayload] = useState<Tela2EmRotaPayload | null>(null);
  const [mapReloadRevision, setMapReloadRevision] = useState(0);

  console.log("[TELA-MAPA] render", {
    tela2Variant,
    hasPayload: !!emRotaPayload,
    payloadAtId: emRotaPayload?.atId || null,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function carregarMapa() {
        console.log("[TELA-MAPA] carregarMapa START");
        const variant = await getTela2Variant();
        console.log("[TELA-MAPA] variant loaded", variant);
        if (!active) {
          console.log("[TELA-MAPA] carregMapa ABORT after variant load");
          return;
        }

        setTela2VariantState(variant);

        if (variant === "em-rota") {
          console.log("[TELA-MAPA] entering em-rota flow");
          const cachedPayload = await getCachedTela2EmRotaPayload();
          console.log("[TELA-MAPA] cachedPayload", {
            exists: !!cachedPayload,
            atId: cachedPayload?.atId || null,
            stops: cachedPayload?.stops?.length || 0,
          });
          if (!active) {
            console.log("[TELA-MAPA] abort after cached payload");
            return;
          }

          if (cachedPayload) {
            setEmRotaPayload(cachedPayload);
          }

          const refreshedPayload = await refreshTela2EmRotaPayloadFromDownloads().catch(() => null);
          console.log("[TELA-MAPA] refreshedPayload", {
            exists: !!refreshedPayload,
            atId: refreshedPayload?.atId || null,
            stops: refreshedPayload?.stops?.length || 0,
          });
          if (!active) {
            console.log("[TELA-MAPA] abort after refreshed payload");
            return;
          }

          setEmRotaPayload(refreshedPayload || cachedPayload);
          console.log("[TELA-MAPA] carregMapa END em-rota");
          return;
        }

        console.log("[TELA-MAPA] entering default flow");
        setEmRotaPayload(null);

        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          console.log("[TELA-MAPA] location permission", status);
          if (status !== "granted" || !active) {
            console.log("[TELA-MAPA] location permission denied or inactive");
            setCoords({
              latitude: FALLBACK_LATITUDE,
              longitude: FALLBACK_LONGITUDE,
            });
            return;
          }

          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 300000,
            requiredAccuracy: 250,
          });

          if (lastKnown && active) {
            console.log("[TELA-MAPA] lastKnown position", {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            });
            setCoords({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            });
          }

          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          if (!active) {
            console.log("[TELA-MAPA] abort after current position");
            return;
          }

          console.log("[TELA-MAPA] current position", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        } catch {
          console.log("[TELA-MAPA] location flow failed, using fallback");
          setCoords((current) => current || {
            latitude: FALLBACK_LATITUDE,
            longitude: FALLBACK_LONGITUDE,
          });
        }
        console.log("[TELA-MAPA] carregMapa END default");
      }

      void carregarMapa();

      return () => {
        console.log("[TELA-MAPA] focus cleanup");
        active = false;
      };
    }, [])
  );

  const emRotaMarkers = useMemo(() => buildEmRotaMarkers(emRotaPayload), [emRotaPayload]);
  const isEmRota = tela2Variant === "em-rota";
  const atLabel = useMemo(() => getPayloadAtLabel(emRotaPayload), [emRotaPayload]);
  const fallbackResolvedMarkers = useMemo(
    () => EM_ROTA_MAP_FALLBACK_MARKERS.filter(hasResolvedCoordinates),
    []
  );
  const resolvedEmRotaMarkers = useMemo(
    () => emRotaMarkers.filter(hasResolvedCoordinates),
    [emRotaMarkers]
  );
  const finalEmRotaMarkers = useMemo(
    () => (resolvedEmRotaMarkers.length > 0 ? resolvedEmRotaMarkers : fallbackResolvedMarkers),
    [fallbackResolvedMarkers, resolvedEmRotaMarkers]
  );

  console.log("[TELA-MAPA] markers", {
    isEmRota,
    emRotaMarkers: emRotaMarkers.length,
    resolvedEmRotaMarkers: resolvedEmRotaMarkers.length,
    fallbackResolvedMarkers: fallbackResolvedMarkers.length,
    finalEmRotaMarkers: finalEmRotaMarkers.length,
    atLabel,
  });

  const mapCenter = useMemo<{ latitude: number; longitude: number }>(() => {
    if (isEmRota && finalEmRotaMarkers.length > 0) {
      const totals = finalEmRotaMarkers.reduce(
        (acc, marker) => ({
          latitude: acc.latitude + marker.lat,
          longitude: acc.longitude + marker.lng,
        }),
        { latitude: 0, longitude: 0 }
      );

      return {
        latitude: totals.latitude / finalEmRotaMarkers.length,
        longitude: totals.longitude / finalEmRotaMarkers.length,
      };
    }

    return coords;
  }, [coords, finalEmRotaMarkers, isEmRota]);

  console.log("[TELA-MAPA] mapCenter", mapCenter);

  const shouldRenderMap = true;

  const mapWebViewKey = useMemo(() => {
    if (!isEmRota) {
      return `default-${mapCenter.latitude.toFixed(5)}-${mapCenter.longitude.toFixed(5)}`;
    }

    const firstMarker = finalEmRotaMarkers[0];
    const lastMarker = finalEmRotaMarkers[finalEmRotaMarkers.length - 1];
    return [
      "em-rota",
      atLabel || "sem-at",
      finalEmRotaMarkers.length,
      firstMarker?.label || "none",
      lastMarker?.label || "none",
      mapCenter.latitude.toFixed(5),
      mapCenter.longitude.toFixed(5),
      mapReloadRevision,
    ].join("-");
  }, [
    atLabel,
    finalEmRotaMarkers,
    isEmRota,
    mapCenter.latitude,
    mapCenter.longitude,
    mapReloadRevision,
  ]);

  console.log("[TELA-MAPA] mapWebViewKey", mapWebViewKey);

  const mapHtml = useMemo(
    () =>
      buildMapHtml(
        mapCenter.latitude,
        mapCenter.longitude,
        isEmRota ? 15 : GOOGLE_MAPS_DEFAULT_ZOOM,
        isEmRota ? finalEmRotaMarkers : [],
        !isEmRota
      ),
    [finalEmRotaMarkers, isEmRota, mapCenter.latitude, mapCenter.longitude]
  );

  console.log("[TELA-MAPA] mapHtml length", mapHtml.length);

  return (
    <View style={styles.container}>
      <View style={styles.topWhiteSpace} />

      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={26} color="#273344" />
        </Pressable>
        <Text style={styles.title}>Mostrar no mapa</Text>
        <Pressable
          onPress={() =>
            Alert.alert(
              "Info",
              isEmRota
                ? "Mapa das paradas da rota atual."
                : "Mapa centralizado na localizacao atual."
            )
          }
          style={styles.iconButton}
        >
          <Ionicons name="information-circle-outline" size={27} color="#6d7785" />
        </Pressable>
      </View>

      <View style={styles.mapArea}>
        {shouldRenderMap ? (
          <WebView
            key={mapWebViewKey}
            source={{ html: mapHtml, baseUrl: "https://maps.googleapis.com" }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            scalesPageToFit={false}
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            mixedContentMode="always"
            allowUniversalAccessFromFileURLs
            originWhitelist={["*"]}
            onLoadStart={() => console.log("[TELA-MAPA] WebView onLoadStart")}
            onLoadEnd={() => console.log("[TELA-MAPA] WebView onLoadEnd")}
            onMessage={(event) => {
              const raw = event.nativeEvent.data;
              try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.source === "TELA-MAPA-HTML") {
                  console.log("[TELA-MAPA-HTML]", parsed);
                  return;
                }
              } catch {
                // ignore raw non-JSON messages
              }
              console.log("[TELA-MAPA-HTML]", raw);
            }}
            onError={(event) =>
              console.log("[TELA-MAPA] WebView onError", {
                nativeEvent: JSON.stringify(event.nativeEvent),
              })
            }
          />
        ) : (
          <View style={styles.webview} />
        )}

        {isEmRota ? (
          <View style={styles.atPill}>
            <Text numberOfLines={1} style={styles.atLabel}>
              {atLabel}
            </Text>
            <Ionicons name="checkmark" size={22} color="#E7B22C" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  topWhiteSpace: {
    height: TOP_WHITE_SPACE,
    backgroundColor: "#ffffff",
  },

  topbar: {
    height: 64,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eceef3",
  },

  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: 19,
    fontWeight: "500",
    color: "#1f2937",
  },

  mapArea: {
    flex: 1,
    backgroundColor: "#eef2f6",
  },

  webview: {
    flex: 1,
    backgroundColor: "#eef2f6",
  },

  atPill: {
    position: "absolute",
    top: 12,
    left: 18,
    minHeight: 44,
    maxWidth: "68%",
    paddingHorizontal: 14,
    borderRadius: 26,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#E8C35B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 70,
    elevation: 70,
  },

  atLabel: {
    marginRight: 8,
    fontSize: 17,
    fontWeight: "600",
    color: "#D7AF2A",
  },
});
