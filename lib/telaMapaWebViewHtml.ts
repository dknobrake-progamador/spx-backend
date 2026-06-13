export type MapMarkerData = {
  lat: number | null;
  lng: number | null;
  label: string;
  title: string;
  addressQuery: string;
};

const GOOGLE_MAPS_EMBED_KEY = "AIzaSyD7ir8vBArvS3kvYBsIBX9jIKSIZNloPRU";

function buildCurrentLocationSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="12" fill="#FFFFFF" fill-opacity="0.96"/>
      <circle cx="17" cy="17" r="8.5" fill="#6E7A86"/>
      <circle cx="17" cy="17" r="5.5" fill="#FFFFFF"/>
    </svg>
  `.trim();
}

function buildMarkerSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="13" fill="#F5B321" stroke="#FFFFFF" stroke-width="2"/>
      <text
        x="17"
        y="21"
        fill="#FFFFFF"
        font-family="Arial, sans-serif"
        font-size="12"
        font-weight="700"
        text-anchor="middle"
      >__LABEL__</text>
    </svg>
  `.trim();
}

function buildMissingStopSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      <path d="M17 31C13 26 8 21 8 15a9 9 0 1 1 18 0c0 6-5 11-9 16Z" fill="#F5B321" stroke="#FFFFFF" stroke-width="2"/>
      <circle cx="17" cy="15" r="4.2" fill="#FFFFFF"/>
    </svg>
  `.trim();
}

export function buildMapHtml(
  latitude: number,
  longitude: number,
  zoom: number,
  markers: MapMarkerData[],
  showCurrentLocationMarker: boolean
) {
  const markersJson = JSON.stringify(markers);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #eef2f6;
      }
      #map {
        border: 0;
        width: 100%;
        height: 100%;
      }
      .gm-style iframe + div { border: none !important; }
    </style>
    <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_EMBED_KEY}"></script>
    <script>
      function emitMapLog(eventName, payload) {
        var shouldForward =
          eventName === "osrm_error" ||
          eventName === "osrm_fallback" ||
          eventName === "osrm_final_fallback" ||
          eventName === "osrm_final_polyline";
        if (!shouldForward) {
          return;
        }

        var message = JSON.stringify(Object.assign({
          source: "TELA-MAPA-HTML",
          event: eventName,
        }, payload || {}));
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(message);
          }
        } catch (error) {}

        try {
          console.log(message);
        } catch (error) {}
      }

      function buildMarkerIcon(label) {
        if (!String(label || "").trim()) {
          var emptySvg = ${JSON.stringify(buildMissingStopSvg())};
          return {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(emptySvg),
            scaledSize: new google.maps.Size(34, 34),
            anchor: new google.maps.Point(17, 17),
          };
        }

        var svg = ${JSON.stringify(buildMarkerSvg())}.replace("__LABEL__", String(label || ""));
        return {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(34, 34),
          anchor: new google.maps.Point(17, 17),
        };
      }

      function buildCurrentLocationIcon() {
        var svg = ${JSON.stringify(buildCurrentLocationSvg())};
        return {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(28, 28),
          anchor: new google.maps.Point(14, 14),
        };
      }

      function initMap() {
        var center = { lat: ${latitude}, lng: ${longitude} };
        var markers = ${markersJson};
        var map = new google.maps.Map(document.getElementById("map"), {
          center: center,
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
          styles: [
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] }
          ]
        });

        var bounds = new google.maps.LatLngBounds();
        var hasBounds = false;
        var resolvedPath = [];
        function placeMarker(marker, index, position) {
          new google.maps.Marker({
            position: position,
            map: map,
            title: marker.title,
            icon: buildMarkerIcon(String(marker.label || "")),
            optimized: true,
            zIndex: 200 + index,
          });
          bounds.extend(position);
          hasBounds = true;
          resolvedPath.push(position);
        }

        function parseGeoJsonRoute(route) {
          var geometry = route && route.geometry && route.geometry.coordinates;
          if (!Array.isArray(geometry)) {
            return [];
          }

          return geometry
            .map(function(pair) {
              if (!Array.isArray(pair) || pair.length < 2) {
                return null;
              }

              var lng = Number(pair[0]);
              var lat = Number(pair[1]);
              if (!isFinite(lat) || !isFinite(lng)) {
                return null;
              }

              return { lat: lat, lng: lng };
            })
            .filter(Boolean);
        }

        function createTrechos(paradas) {
          var trechos = [];
          for (var i = 0; i < paradas.length - 1; i += 1) {
            trechos.push({
              origem: paradas[i],
              destino: paradas[i + 1],
            });
          }
          return trechos;
        }

        async function buscarRotaPorRua(origem, destino, index) {
          var url =
            "https://router.project-osrm.org/route/v1/driving/" +
            origem.lng + "," + origem.lat + ";" +
            destino.lng + "," + destino.lat +
            "?overview=full&geometries=geojson";

          emitMapLog("osrm_request", {
            index: index,
            origin: origem,
            destination: destino,
            url: url,
          });

          try {
            var response = await fetch(url);
            var text = await response.text();
            emitMapLog("osrm_response", {
              index: index,
              httpStatus: response.status,
              ok: response.ok,
              bodyPreview: text.slice(0, 500),
            });

            var json = null;
            try {
              json = JSON.parse(text);
            } catch (parseError) {
              emitMapLog("osrm_parse_error", {
                index: index,
                error: String(parseError || ""),
              });
            }

            emitMapLog("osrm_json", {
              index: index,
              apiStatus: json && json.code ? json.code : null,
              routes: json && json.routes ? json.routes.length : 0,
            });

            var route = json && json.routes && json.routes[0];
            var coords = parseGeoJsonRoute(route);
            if (coords.length > 0) {
              return coords;
            }

            emitMapLog("osrm_fallback", {
              index: index,
              reason: "no_geometry",
            });
          } catch (error) {
            emitMapLog("osrm_error", {
              index: index,
              error: String(error || ""),
            });
          }

          emitMapLog("osrm_fallback", {
            index: index,
            reason: "fallback_line",
          });
          return [origem, destino];
        }

        async function montarPolylinePorRuas(paradas) {
          var trechos = createTrechos(paradas);
          var linhaFinal = [];
          var resultados = await Promise.all(
            trechos.map(function(trecho, index) {
              return buscarRotaPorRua(trecho.origem, trecho.destino, index).then(function(pontosDoTrecho) {
                emitMapLog("osrm_segment", {
                  index: index,
                  points: pontosDoTrecho.length,
                  usedFallbackLine: pontosDoTrecho.length === 2,
                });
                return pontosDoTrecho;
              });
            })
          );

          for (var i = 0; i < resultados.length; i += 1) {
            var pontosDoTrecho = resultados[i];
            if (!pontosDoTrecho.length) {
              continue;
            }

            if (linhaFinal.length > 0) {
              linhaFinal.pop();
            }

            linhaFinal.push.apply(linhaFinal, pontosDoTrecho);
          }

          return linhaFinal;
        }

        for (var index = 0; index < markers.length; index += 1) {
          var marker = markers[index];
          if (typeof marker.lat !== "number" || typeof marker.lng !== "number") {
            continue;
          }
          if (
            marker.lat < -35 ||
            marker.lat > 10 ||
            marker.lng < -80 ||
            marker.lng > -20
          ) {
            continue;
          }
          placeMarker(marker, index, { lat: marker.lat, lng: marker.lng });
        }

        if (resolvedPath.length > 1) {
          montarPolylinePorRuas(resolvedPath).then(function(linhaFinal) {
            if (!linhaFinal || linhaFinal.length < 2) {
              emitMapLog("osrm_final_fallback", {
                reason: "linha_final_insuficiente",
                points: linhaFinal ? linhaFinal.length : 0,
              });
              linhaFinal = resolvedPath;
            }

            emitMapLog("osrm_final_polyline", {
              points: linhaFinal.length,
            });

            new google.maps.Polyline({
              path: linhaFinal,
              geodesic: false,
              strokeColor: "#F1B12A",
              strokeOpacity: 0.95,
              strokeWeight: 5,
              map: map,
              zIndex: 50,
            });
          });
        }

        if (${showCurrentLocationMarker ? "true" : "false"}) {
          new google.maps.Marker({
            position: center,
            map: map,
            icon: buildCurrentLocationIcon(),
            optimized: true,
            zIndex: 999,
          });
          if (!hasBounds) {
            bounds.extend(center);
            hasBounds = true;
          }
        }

        if (hasBounds) {
          map.fitBounds(bounds, { top: 52, right: 28, bottom: 28, left: 28 });
          google.maps.event.addListenerOnce(map, "idle", function() {
            if (map.getZoom() > 16) {
              map.setZoom(16);
            } else if (map.getZoom() < 14) {
              map.setZoom(14);
            }
          });
        } else {
          map.setCenter(center);
          map.setZoom(Math.max(${zoom}, 16));
        }
      }

      window.addEventListener("load", function() {
        initMap();
      });
    </script>
  </head>
  <body>
    <div id="map"></div>
  </body>
</html>`;
}
