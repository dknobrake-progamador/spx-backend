import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const FALLBACK_LATITUDE = -22.9049;
const FALLBACK_LONGITUDE = -43.2003;
const GOOGLE_MAPS_DEFAULT_ZOOM = 17;
const GOOGLE_MAPS_EMBED_KEY = "AIzaSyD7ir8vBArvS3kvYBsIBX9jIKSIZNloPRU";

function buildMapHtml(latitude: number, longitude: number, zoom: number) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=yes"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #ffffff;
      }
      #map {
        border: 0;
        width: 100%;
        height: 100%;
      }
    </style>
    <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_EMBED_KEY}"></script>
    <script>
      function initMap() {
        const center = { lat: ${latitude}, lng: ${longitude} };
        const map = new google.maps.Map(document.getElementById("map"), {
          center,
          zoom: ${zoom},
          mapTypeId: "roadmap",
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          rotateControl: false,
          scaleControl: false,
          clickableIcons: false,
          keyboardShortcuts: false,
          gestureHandling: "greedy",
        });

        new google.maps.Marker({
          position: center,
          map,
        });
      }

      window.addEventListener("load", initMap);
    </script>
  </head>
  <body>
    <div id="map"></div>
  </body>
</html>`;
}

export default function TelaMapa() {
  const [coords, setCoords] = useState({
    latitude: FALLBACK_LATITUDE,
    longitude: FALLBACK_LONGITUDE,
  });
  const [locationStatus, setLocationStatus] = useState("Buscando localizacao atual...");

  useEffect(() => {
    let active = true;

    async function carregarLocalizacao() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          if (active) {
            setLocationStatus("Permissao negada. Mostrando mapa padrao.");
          }
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!active) {
          return;
        }

        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus("");
      } catch {
        if (active) {
          setLocationStatus("Nao foi possivel obter a localizacao atual.");
        }
      }
    }

    carregarLocalizacao();

    return () => {
      active = false;
    };
  }, []);

  const mapHtml = useMemo(
    () => buildMapHtml(coords.latitude, coords.longitude, GOOGLE_MAPS_DEFAULT_ZOOM),
    [coords.latitude, coords.longitude]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.title}>Mostrar no mapa</Text>
        <Pressable
          onPress={() => Alert.alert("Info", "Mapa interativo exibido com Google Maps.")}
          style={styles.iconButton}
        >
          <Ionicons name="information-circle-outline" size={24} color="#000" />
        </Pressable>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{locationStatus}</Text>
      </View>

      <WebView
        source={{ html: mapHtml, baseUrl: "https://www.google.com" }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  topbar: {
    height: 80,
    backgroundColor: "#f2f2f2",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },

  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
  },

  statusBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fafafa",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },

  statusText: {
    fontSize: 13,
    color: "#555",
  },

  webview: {
    flex: 1,
  },
});
