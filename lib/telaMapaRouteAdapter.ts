import {
  extractAtIdFromText,
  TELA2_EM_ROTA_FALLBACK_PAYLOAD,
} from "./tela2EmRotaEngine";
import type { Tela2EmRotaPayload } from "./tela2EmRotaTypes";
import { EM_ROTA_MAP_FALLBACK_MARKERS } from "./telaMapaFallbackMarkers";
import type { MapMarkerData } from "./telaMapaWebViewHtml";

const EM_ROTA_FALLBACK_AT_ID = extractAtIdFromText(TELA2_EM_ROTA_FALLBACK_PAYLOAD.atId);

export function hasResolvedCoordinates(
  marker: MapMarkerData
): marker is MapMarkerData & { lat: number; lng: number } {
  return typeof marker.lat === "number" && typeof marker.lng === "number";
}

function parseCoordinate(value: string | null | undefined) {
  const sanitized = String(value ?? "").trim();
  if (!sanitized) {
    return null;
  }

  const normalized = sanitized.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBrazilCoordinatePair(lat: number | null, lng: number | null) {
  if (lat === null || lng === null) {
    return { lat: null, lng: null };
  }

  const looksLikeBrazil =
    lat >= -35 && lat <= 10 &&
    lng >= -80 && lng <= -20;

  const swappedLooksLikeBrazil =
    lng >= -35 && lng <= 10 &&
    lat >= -80 && lat <= -20;

  if (!looksLikeBrazil && swappedLooksLikeBrazil) {
    return { lat: lng, lng: lat };
  }

  return { lat, lng };
}

function resolveStopLabel(stop: string, orders: { stopValue: number | null }[], fallbackNumber: number) {
  const directStopValue = orders.find((order) => order.stopValue !== null)?.stopValue;
  if (typeof directStopValue === "number" && Number.isFinite(directStopValue)) {
    return String(directStopValue);
  }

  const digits = String(stop || "").match(/\d+/)?.[0];
  if (digits) {
    return String(Number.parseInt(digits, 10));
  }

  return String(fallbackNumber);
}

export function buildEmRotaMarkers(payload: Tela2EmRotaPayload | null) {
  if (!payload) {
    console.log("[TELA-MAPA-ROUTE] payload null, usando fallback", {
      fallbackMarkers: EM_ROTA_MAP_FALLBACK_MARKERS.length,
    });
    return EM_ROTA_MAP_FALLBACK_MARKERS;
  }

  const markers: MapMarkerData[] = [];
  let runningNumber = 1;

  console.log("[TELA-MAPA-ROUTE] payload recebido", {
    atId: payload.atId || null,
    stops: payload.stops?.length || 0,
    sourceFileName: payload.sourceFileName || null,
    sourceFileUri: payload.sourceFileUri || null,
  });

  for (const stop of payload.stops) {
    console.log("[TELA-MAPA-ROUTE] processando stop", {
      stop: stop.stop,
      orders: stop.orders?.length || 0,
      mode: stop.stop === "Sem parada" ? "sem-parada" : "parada",
    });
    if (stop.stop === "Sem parada") {
      for (const order of stop.orders) {
        const normalizedCoords = normalizeBrazilCoordinatePair(
          parseCoordinate(order.latitude),
          parseCoordinate(order.longitude)
        );

        console.log("[TELA-MAPA-ROUTE] order sem parada", {
          address: order.address || null,
          latitude: order.latitude || null,
          longitude: order.longitude || null,
          normalizedLat: normalizedCoords.lat,
          normalizedLng: normalizedCoords.lng,
          runningNumber,
        });

        markers.push({
          lat: normalizedCoords.lat,
          lng: normalizedCoords.lng,
          label: String(runningNumber),
          title: order.address,
          addressQuery: [order.address, order.district, order.city, "RJ", "Brasil"]
            .filter(Boolean)
            .join(", "),
        });
        runningNumber += 1;
      }
      continue;
    }

    const referenceOrder =
      stop.orders.find((order) => {
        const normalizedCoords = normalizeBrazilCoordinatePair(
          parseCoordinate(order.latitude),
          parseCoordinate(order.longitude)
        );
        return normalizedCoords.lat !== null && normalizedCoords.lng !== null;
      }) || stop.orders[0];

    const normalizedCoords = normalizeBrazilCoordinatePair(
      parseCoordinate(referenceOrder?.latitude),
      parseCoordinate(referenceOrder?.longitude)
    );
    const address = referenceOrder?.address || `Parada ${stop.stop}`;
    const district = referenceOrder?.district || "";
    const city = referenceOrder?.city || "Niteroi";

    console.log("[TELA-MAPA-ROUTE] parada resumida", {
      stop: stop.stop,
      referenceAddress: address,
      latitude: referenceOrder?.latitude || null,
      longitude: referenceOrder?.longitude || null,
      normalizedLat: normalizedCoords.lat,
      normalizedLng: normalizedCoords.lng,
      runningNumber,
    });

    markers.push({
      lat: normalizedCoords.lat,
      lng: normalizedCoords.lng,
      label: resolveStopLabel(stop.stop, stop.orders, runningNumber),
      title: address,
      addressQuery: [
        address,
        district,
        city,
        "RJ",
        "Brasil",
      ]
        .filter(Boolean)
        .join(", "),
    });
    runningNumber += 1;
  }

  console.log("[TELA-MAPA-ROUTE] markers montados", {
    total: markers.length,
    fallbackUsed: markers.length === 0,
  });

  return markers.length > 0 ? markers : EM_ROTA_MAP_FALLBACK_MARKERS;
}

export function getPayloadAtLabel(payload: Tela2EmRotaPayload | null) {
  if (!payload) {
    return EM_ROTA_FALLBACK_AT_ID;
  }

  const payloadAtId = extractAtIdFromText(payload.atId);
  if (payloadAtId) {
    return payloadAtId;
  }

  for (const stop of payload.stops) {
    const orderAtId = stop.orders.map((order) => extractAtIdFromText(order.atId)).find(Boolean);
    if (orderAtId) {
      return orderAtId;
    }
  }

  return (
    extractAtIdFromText(payload.sourceFileName) ||
    extractAtIdFromText(payload.sourceFileUri) ||
    EM_ROTA_FALLBACK_AT_ID
  );
}
