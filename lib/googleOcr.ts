import { extractOccurrence } from "./extractOccurrence";
import { extractName } from "./nameOcr";

export type GoogleOcrFields = {
  trackingCode?: string;
  address?: string;
  recipientName?: string;
  status?: string;
  statusDate?: string;
  rawText?: string;
};

export type GoogleOcrResult = {
  text: string;
  fields?: GoogleOcrFields;
};

const GOOGLE_VISION_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;

export function hasGoogleOcrEndpoint() {
  return Boolean(GOOGLE_VISION_API_KEY);
}

function normalizeSpaces(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

function extractTrackingCode(text: string) {
  const match = text.match(/\bBR\d{6,}[A-Z]?\b/i);
  return match ? match[0].toUpperCase() : "";
}

function extractAddress(lines: string[]) {
  const joined = lines.join("\n");
  const patterns = [
    /((?:Rua|R\.|Avenida|Av\.|Travessa|Tv\.|Alameda|Praça|Praca|Rodovia)\s+.+)/i,
  ];

  for (const pattern of patterns) {
    const match = joined.match(pattern);
    if (match) {
      return normalizeSpaces(match[1]);
    }
  }

  return "";
}

function extractRecipientName(lines: string[], trackingCode: string, address: string) {
  const filtered = lines
    .map((line) => normalizeSpaces(line))
    .filter(Boolean)
    .filter((line) => line !== trackingCode)
    .filter((line) => line !== address)
    .filter(
      (line) =>
        !/\b(?:Rua|R\.|Avenida|Av\.|Travessa|Tv\.|Alameda|Praça|Praca|Rodovia)\b/i.test(
          line
        )
    )
    .filter((line) => !/\bBR\d{6,}[A-Z]?\b/i.test(line))
    .filter((line) => !/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line))
    .filter((line) => line.length >= 4);

  return filtered[0] || "";
}

function parseFields(rawText: string): GoogleOcrFields {
  const text = String(rawText || "").replace(/\r/g, "");
  const lines = text.split("\n").map((line) => normalizeSpaces(line)).filter(Boolean);
  const trackingCode = extractTrackingCode(text);
  const address = extractAddress(lines);
  const recipientName =
    extractName(text).recipientName || extractRecipientName(lines, trackingCode, address);
  const { status, statusDate } = extractOccurrence(text);

  return {
    trackingCode,
    address,
    recipientName,
    status,
    statusDate,
    rawText: text,
  };
}

export async function runGoogleOcr(params: {
  base64: string;
  mimeType: string;
}): Promise<GoogleOcrResult> {
  if (!GOOGLE_VISION_API_KEY) {
    throw new Error("Google Vision API key nao configurada.");
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
    {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: params.base64 },
          features: [{ type: "TEXT_DETECTION" }],
          imageContext: { languageHints: ["pt", "pt-BR"] },
        },
      ],
    }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Google Vision falhou (${response.status}).`);
  }

  const data = (await response.json()) as {
    responses?: Array<{
      error?: { message?: string };
      fullTextAnnotation?: { text?: string };
      textAnnotations?: Array<{ description?: string }>;
    }>;
  };

  const payload = data.responses?.[0];
  if (payload?.error?.message) {
    throw new Error(payload.error.message);
  }

  const text =
    payload?.fullTextAnnotation?.text || payload?.textAnnotations?.[0]?.description || "";
  const fields = parseFields(text);

  return {
    text: text || fields.rawText || "",
    fields,
  };
}
