import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { TELA2_EM_ROTA_DATA } from "./tela2EmRotaData";
import type { Tela2EmRotaOrder, Tela2EmRotaPayload, Tela2EmRotaStopBlock } from "./tela2EmRotaTypes";
import {
  listRomaneioXlsxFromMediaStore,
  readMediaStoreXlsxBase64,
} from "./xlsxMediaStore";

const KEY_EM_ROTA_PAYLOAD = "@DEV_EM_ROTA_PAYLOAD";
const KEY_EM_ROTA_DOWNLOADS_URI = "@DEV_EM_ROTA_DOWNLOADS_URI";
const KEY_EM_ROTA_SELECTED_XLSX_URI = "@DEV_EM_ROTA_SELECTED_XLSX_URI";
export const TELA2_EM_ROTA_PICK_ROMANEIO_MESSAGE =
  "Escolha a pasta Download/Romaneio para importar os XLSX automaticamente.";
const PLACEHOLDER_AT_ID = "AT000000000000";
const MAX_VALID_XLSX_ROWS = 160;
const DIRECT_DOWNLOAD_URIS = [
  "file:///storage/emulated/0/Download/Romaneio",
  "file:///storage/emulated/0/Download/Romaneios",
  "file:///storage/emulated/0/Downloads/Romaneio",
  "file:///storage/emulated/0/Downloads/Romaneios",
  "file:///storage/emulated/0/download/romaneio",
  "file:///storage/emulated/0/downloads/romaneio",
  "file:///storage/emulated/0/Romaneio",
  "file:///storage/emulated/0/Romaneios",
  "file:///storage/emulated/0/romaneio",
  "file:///storage/emulated/0/romaneios",
  "file:///sdcard/Download/Romaneio",
  "file:///sdcard/Download/Romaneios",
  "file:///sdcard/Downloads/Romaneio",
  "file:///sdcard/Downloads/Romaneios",
  "file:///sdcard/download/romaneio",
  "file:///sdcard/downloads/romaneio",
  "file:///sdcard/Romaneio",
  "file:///sdcard/Romaneios",
  "file:///sdcard/romaneio",
  "file:///sdcard/romaneios",
];

const FIRST_NAMES = [
  "Aline",
  "Bruno",
  "Camila",
  "Daniel",
  "Eduarda",
  "Felipe",
  "Gabriela",
  "Henrique",
  "Isabela",
  "Joao",
  "Karina",
  "Lucas",
  "Mariana",
  "Nathalia",
  "Otavio",
  "Priscila",
  "Rafael",
  "Sabrina",
  "Thiago",
  "Vanessa",
  "Yasmin",
  "Bianca",
  "Gustavo",
  "Patricia",
  "Rodrigo",
  "Leandro",
  "Monica",
  "Renata",
];

const MIDDLE_NAMES = [
  "da",
  "de",
  "dos",
  "das",
];

const LAST_NAMES = [
  "Almeida",
  "Alves",
  "Araujo",
  "Assis",
  "Barbosa",
  "Batista",
  "Carvalho",
  "Castro",
  "Correia",
  "Costa",
  "Ferreira",
  "Freitas",
  "Gomes",
  "Lima",
  "Machado",
  "Martins",
  "Mendes",
  "Monteiro",
  "Moreira",
  "Moura",
  "Nogueira",
  "Oliveira",
  "Pereira",
  "Ribeiro",
  "Rocha",
  "Rodrigues",
  "Silva",
  "Souza",
  "Teixeira",
  "Vieira",
];

type XlsxCandidate = {
  uri: string;
  name: string;
  modifiedAt: number;
  source?: "direct" | "saf" | "mediastore";
  addedAt?: number;
  size?: number;
};

type RawRow = Record<string, unknown>;

let emRotaRefreshPromise: Promise<Tela2EmRotaPayload> | null = null;
let lastEmRotaPreloadAt = 0;
let emRotaXlsxMonitorTimer: ReturnType<typeof setInterval> | null = null;
let lastLoggedXlsxRankingSignature = "";
let lastLoggedPreloadSourceUri = "";

function getFallbackPayload(): Tela2EmRotaPayload {
  const stops: Tela2EmRotaStopBlock[] = TELA2_EM_ROTA_DATA.map((block) => ({
    stop: String(block.stop),
    count: block.count,
    orders: block.orders.map((order) => ({
      num: String(order.num),
      sequenceValue: Number.isFinite(order.num) ? Number(order.num) : null,
      stopValue: Number.isFinite(block.stop) ? Number(block.stop) : null,
      code: order.code,
      atId: "AT202605305G4W1",
      address: order.address,
      recipient: order.recipient,
      phone: "",
      hub: "",
      district: order.district,
      city: order.city,
      zipcode: order.zipcode,
      latitude: "",
      longitude: "",
      tags: [...order.tags],
    })),
  }));

  const totalOrders = stops.reduce((sum, stop) => sum + stop.count, 0);

  return {
    atId: "AT202605305G4W1",
    totalOrders,
    rowsCount: totalOrders,
    sourceFileName: null,
    sourceFileUri: null,
    sourceModifiedAt: null,
    sourceAddedAt: null,
    sourceSize: null,
    stops,
  };
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sanitizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

export function extractAtIdFromText(value: unknown) {
  const compact = sanitizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  const match = compact.match(/AT\d[0-9A-Z]{5,}/);
  const atId = match?.[0] || "";

  if (!atId || /^AT0+$/i.test(atId) || atId === PLACEHOLDER_AT_ID) {
    return "";
  }

  return atId;
}

function parseOptionalNumber(value: string) {
  if (!value || value === "-") return null;
  const digitsOnly = value.replace(/[^\d-]/g, "");
  if (!digitsOnly) return null;
  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCoordinateValue(value: string | null | undefined) {
  const sanitized = String(value ?? "").trim();
  if (!sanitized) {
    return null;
  }

  const normalized = sanitized.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRowField(row: RawRow, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeKey);
  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.includes(normalizeKey(key))) {
      return sanitizeText(value);
    }
  }
  return "";
}

function buildStopNumber(row: RawRow, index: number) {
  const explicitValue = getRowField(row, STOP_FIELD_ALIASES);
  const parsed = Number.parseInt(String(explicitValue || "").replace(/\D+/g, ""), 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return index + 1;
}

const AT_FIELD_ALIASES = [
  "AT",
  "AT ID",
  "AT Code",
  "AT Number",
  "AT No",
  "AT No.",
  "A.T.",
  "Codigo AT",
  "Codigo da AT",
  "Código AT",
  "Código da AT",
  "Numero AT",
  "Numero da AT",
  "Número AT",
  "Número da AT",
  "N AT",
  "Nº AT",
  "N° AT",
  "ID AT",
  "ID da AT",
  "Assign Task ID",
  "Assigned Task ID",
  "Assignment Task ID",
  "Task ID",
  "Tarefa ID",
  "ID da tarefa",
  "Route ID",
  "Route Code",
  "Rota ID",
  "Codigo da rota",
  "Código da rota",
  "Trip ID",
  "Viagem ID",
  "Manifest ID",
  "Manifesto ID",
];

const STOP_FIELD_ALIASES = [
  "Stop",
  "Parada",
  "Sequencia",
  "Sequência",
  "Ordem",
  "Numero",
  "Número",
  "N",
];

const NAME_FIELD_ALIASES = [
  "Nome",
  "Name",
  "Cliente",
  "Destinatario",
  "Destinatário",
];

const ADDRESS_FIELD_ALIASES = [
  "Destination Address",
  "Address",
  "Endereco",
  "Endereço",
  "Logradouro",
  "Rua",
];

const LAT_FIELD_ALIASES = [
  "Latitude",
  "Lat",
  "Y",
];

const LNG_FIELD_ALIASES = [
  "Longitude",
  "Lng",
  "Lon",
  "Long",
  "X",
];

function getRowAtId(row: RawRow) {
  const aliasValue = getRowField(row, AT_FIELD_ALIASES);
  const aliasAtId = extractAtIdFromText(aliasValue);
  if (aliasAtId) {
    return aliasAtId;
  }

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key);
    const keyLooksLikeAt =
      /\bat\b/.test(normalizedKey) ||
      /\bassign/.test(normalizedKey) ||
      /\btask\b/.test(normalizedKey) ||
      /\btarefa\b/.test(normalizedKey) ||
      /\broute\b/.test(normalizedKey) ||
      /\brota\b/.test(normalizedKey) ||
      /\btrip\b/.test(normalizedKey) ||
      /\bviagem\b/.test(normalizedKey) ||
      /\bmanifest/.test(normalizedKey);

    if (!keyLooksLikeAt) {
      continue;
    }

    const keyAtId = extractAtIdFromText(value);
    if (keyAtId) {
      return keyAtId;
    }
  }

  for (const value of Object.values(row)) {
    const valueAtId = extractAtIdFromText(value);
    if (valueAtId) {
      return valueAtId;
    }
  }

  return "";
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildFakeRecipient(seedBase: string) {
  const hash = hashString(seedBase || "sem-destinatario");
  const first = FIRST_NAMES[hash % FIRST_NAMES.length];
  const middle = MIDDLE_NAMES[Math.floor(hash / 7) % MIDDLE_NAMES.length];
  const lastA = LAST_NAMES[Math.floor(hash / 17) % LAST_NAMES.length];
  const lastB = LAST_NAMES[Math.floor(hash / 31) % LAST_NAMES.length];
  const lastC = LAST_NAMES[Math.floor(hash / 53) % LAST_NAMES.length];
  return `${first} ${middle} ${lastA} ${lastB} ${lastC}_`;
}

function buildTags(district: string, city: string, zipcode: string) {
  const tags: string[] = [];
  if (district || city) {
    tags.push([district, city].filter(Boolean).join(" - "));
  }
  if (zipcode) {
    tags.push(`CEP ${zipcode}`);
  }
  return tags;
}

function isFilledRow(row: RawRow) {
  return Object.values(row).some((value) => sanitizeText(value) !== "");
}

function extractRowsFromBase64(base64: string) {
  const workbook = XLSX.read(base64, { type: "base64" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [] as RawRow[];
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: "",
    raw: false,
  });
  return rows.filter(isFilledRow);
}

function joinFileUri(baseUri: string, childName: string) {
  if (childName.startsWith("file://") || childName.startsWith("content://")) {
    return childName;
  }

  if (childName.startsWith("/")) {
    return `file://${childName}`;
  }

  const normalizedBase = baseUri.replace(/\/+$/, "");
  const normalizedChild = childName.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedChild}`;
}

function getSafEntryName(uri: string) {
  return decodeURIComponent(uri.split("%2F").pop() || uri.split("/").pop() || "arquivo.xlsx");
}

function buildExternalStorageTreeUri(treePath: string) {
  return `content://com.android.externalstorage.documents/tree/${encodeURIComponent(treePath)}`;
}

function getSafTreePath(uri: string) {
  const match = uri.match(/\/tree\/([^/]+)/);
  if (!match?.[1]) {
    return "";
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function isAllowedXlsxSafTree(uri: string) {
  const treePath = getSafTreePath(uri).toLowerCase();
  return treePath === "primary:download/romaneio" || treePath === "primary:downloads/romaneio";
}

function getSafDirectoryCandidates(savedUri: string) {
  const candidates = new Set<string>([savedUri]);
  const treePath = getSafTreePath(savedUri);

  if (treePath.toLowerCase() === "primary:download") {
    candidates.add(buildExternalStorageTreeUri("primary:Download/Romaneio"));
  }

  return Array.from(candidates);
}

function getTodayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return year * 10000 + month * 100 + day;
}

function getCandidateNameDateValue(candidate: XlsxCandidate) {
  const decodedName = decodeURIComponent(candidate.name || "");
  const match = decodedName.match(/(?:^|[^\d])(\d{1,2})[-_.](\d{1,2})[-_.](20\d{2})(?:[^\d]|$)/);
  if (!match) {
    return 0;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const isValidDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isValidDate ? year * 10000 + month * 100 + day : 0;
}

function getCanonicalXlsxName(name: string) {
  return decodeURIComponent(name || "")
    .trim()
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isRomaneioCandidate(candidate: XlsxCandidate) {
  const uri = decodeURIComponent(candidate.uri || "").toLowerCase();
  const name = decodeURIComponent(candidate.name || "").toLowerCase();
  return uri.includes("/romaneio/") || uri.includes(":download/romaneio/") || name.includes("romaneio");
}

function getCandidateDateScore(candidate: XlsxCandidate) {
  const nameDate = getCandidateNameDateValue(candidate);
  const today = getTodayDateValue();

  if (nameDate > 0 && nameDate <= today) {
    return 40000000 + nameDate;
  }

  if (nameDate > today) {
    return 20000000 - Math.min(nameDate - today, 999999);
  }

  if (candidate.modifiedAt > 0) {
    return 10000000 + Math.min(Math.floor(candidate.modifiedAt / 1000), 9999999);
  }

  return 0;
}

function getCandidateIdentity(candidate: XlsxCandidate) {
  return [
    getCanonicalXlsxName(candidate.name),
    getCandidateNameDateValue(candidate),
    candidate.modifiedAt,
    candidate.addedAt || 0,
    candidate.size || 0,
  ].join("|");
}

function getPayloadSourceIdentity(payload: Tela2EmRotaPayload) {
  const sourceName = String(payload.sourceFileName || "");
  return [
    getCanonicalXlsxName(sourceName),
    getCandidateNameDateValue({
      uri: String(payload.sourceFileUri || ""),
      name: sourceName,
      modifiedAt: Number(payload.sourceModifiedAt || 0),
    }),
    Number(payload.sourceModifiedAt || 0),
    Number(payload.sourceAddedAt || 0),
    Number(payload.sourceSize || 0),
  ].join("|");
}

async function collectXlsxCandidatesFromDirectory(
  dirUri: string,
  depth = 0,
  maxDepth = 2
) {
  if (depth > maxDepth) {
    return [] as XlsxCandidate[];
  }

  const entries = await FileSystem.readDirectoryAsync(dirUri);
  const candidates: XlsxCandidate[] = [];

  for (const entry of entries) {
    const name = entry.split("/").pop() || entry;
    const uri = joinFileUri(dirUri, entry);

    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        continue;
      }

      if (info.isDirectory) {
        const nested = await collectXlsxCandidatesFromDirectory(uri, depth + 1, maxDepth);
        candidates.push(...nested);
        continue;
      }

      if (!name.toLowerCase().endsWith(".xlsx")) {
        continue;
      }

          candidates.push({
            uri,
            name,
            modifiedAt: typeof info.modificationTime === "number" ? info.modificationTime : 0,
            source: "direct",
          });
    } catch {
      // Ignore unreadable files/subdirectories and continue scanning.
    }
  }

  return candidates;
}

function mapRowsToPayload(rows: RawRow[], candidate: XlsxCandidate): Tela2EmRotaPayload {
  const fileAtId = extractAtIdFromText(candidate.name) || extractAtIdFromText(candidate.uri);
  const parsedRows = rows.map((row, index) => {
    const atId = getRowAtId(row) || fileAtId || PLACEHOLDER_AT_ID;
    const sequenceRaw = getRowField(row, ["Sequence", "Order", "Ordem", "Sequencia", "Numero", "Número", "N"]);
    const code = getRowField(row, ["SPX TN", "Codigo BR", "BR", "Codigo"]);
    const name = getRowField(row, NAME_FIELD_ALIASES);
    const address = getRowField(row, ADDRESS_FIELD_ALIASES);
    const district = getRowField(row, ["Bairro", "District"]);
    const city = getRowField(row, ["City", "Cidade"]);
    const zipcode = getRowField(row, ["Zipcode/Postal code", "Zipcode", "Postal code", "CEP"]);
    const phone = getRowField(row, ["Telefone", "Phone", "Celular", "Contato", "Receiver Phone", "Recipient Phone"]);
    const hub = getRowField(row, ["Hub", "Hub atribuido", "Hub atribuÃ­do", "Assigned Hub", "LM Hub"]);
    const latitude = getRowField(row, LAT_FIELD_ALIASES);
    const longitude = getRowField(row, LNG_FIELD_ALIASES);
    const sequenceValue = parseOptionalNumber(sequenceRaw);
    const stopValue = buildStopNumber(row, index);
    const seedBase = `${code}|${address}|${district}|${city}|${index}`;
    const recipient = name || buildFakeRecipient(seedBase);

    return {
      index,
      atId,
      sequenceValue,
      stopValue,
      code: code || `SEM CODIGO ${index + 1}`,
      address: address || name || "Endereco nao informado",
      district,
      city,
      zipcode,
      latitude,
      longitude,
      recipient,
      phone,
      hub,
    };
  });

  const sortedRows = [...parsedRows].sort((left, right) => {
    const leftMissingBoth = left.sequenceValue === null && left.stopValue === null;
    const rightMissingBoth = right.sequenceValue === null && right.stopValue === null;
    if (leftMissingBoth !== rightMissingBoth) {
      return leftMissingBoth ? -1 : 1;
    }

    const leftStop = left.stopValue ?? Number.MAX_SAFE_INTEGER;
    const rightStop = right.stopValue ?? Number.MAX_SAFE_INTEGER;
    if (leftStop !== rightStop) {
      return leftStop - rightStop;
    }

    const leftSequence = left.sequenceValue ?? Number.MAX_SAFE_INTEGER;
    const rightSequence = right.sequenceValue ?? Number.MAX_SAFE_INTEGER;
    if (leftSequence !== rightSequence) {
      return leftSequence - rightSequence;
    }

    return left.index - right.index;
  });

  const grouped = new Map<string, Tela2EmRotaOrder[]>();

  for (const row of sortedRows) {
    const groupKey = row.stopValue === null ? "Sem parada" : String(row.stopValue);
    const currentGroup = grouped.get(groupKey) || [];
    currentGroup.push({
      num:
        row.sequenceValue !== null
          ? String(row.sequenceValue)
          : row.stopValue !== null
            ? String(row.stopValue)
            : "-",
      sequenceValue: row.sequenceValue,
      stopValue: row.stopValue,
      code: row.code,
      atId: row.atId,
      address: row.address,
      recipient: row.recipient,
      phone: row.phone,
      hub: row.hub,
      district: row.district,
      city: row.city,
      zipcode: row.zipcode,
      latitude: row.latitude,
      longitude: row.longitude,
      tags: buildTags(row.district, row.city, row.zipcode),
    });
    grouped.set(groupKey, currentGroup);
  }

  const stops: Tela2EmRotaStopBlock[] = Array.from(grouped.entries()).map(([stop, orders]) => ({
    stop,
    count: orders.length,
    orders,
  }));

  const atId =
    sortedRows.find((row) => extractAtIdFromText(row.atId))?.atId ||
    fileAtId ||
    PLACEHOLDER_AT_ID;

  return {
    atId,
    totalOrders: sortedRows.length,
    rowsCount: sortedRows.length,
    sourceFileName: candidate.name,
    sourceFileUri: candidate.uri,
    sourceModifiedAt: candidate.modifiedAt,
    sourceAddedAt: candidate.addedAt || null,
    sourceSize: candidate.size || null,
    stops,
  };
}

async function listDirectDownloadCandidates() {
  const candidates: XlsxCandidate[] = [];

  for (const dirUri of DIRECT_DOWNLOAD_URIS) {
    try {
      const nestedCandidates = await collectXlsxCandidatesFromDirectory(dirUri);
      candidates.push(...nestedCandidates);
    } catch {
      // Ignore inaccessible directories and keep searching.
    }
  }

  return candidates;
}

async function listSafDownloadCandidates() {
  const safUri = await AsyncStorage.getItem(KEY_EM_ROTA_DOWNLOADS_URI);
  if (!safUri) {
    return [] as XlsxCandidate[];
  }

  const candidates: XlsxCandidate[] = [];

  for (const directoryUri of getSafDirectoryCandidates(safUri)) {
    try {
      const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri);

      for (const uri of entries) {
        const name = getSafEntryName(uri);

        if (name.toLowerCase().endsWith(".xlsx")) {
          let modifiedAt = 0;
          try {
            const info = await FileSystem.getInfoAsync(uri);
            modifiedAt = info.exists && typeof info.modificationTime === "number" ? info.modificationTime : 0;
          } catch {
            // SAF pode negar metadata; nesse caso o desempate fica pelo nome.
          }

          candidates.push({
            uri,
            name,
            modifiedAt,
            source: "saf",
          });
          continue;
        }

        try {
          const nestedEntries = await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
          candidates.push(
            ...(await Promise.all(
              nestedEntries
                .filter((nestedUri) => nestedUri.toLowerCase().endsWith(".xlsx"))
                .map(async (nestedUri) => {
                  let modifiedAt = 0;
                  try {
                    const info = await FileSystem.getInfoAsync(nestedUri);
                    modifiedAt = info.exists && typeof info.modificationTime === "number" ? info.modificationTime : 0;
                  } catch {
                    // SAF pode negar metadata; nesse caso o desempate fica pelo nome.
                  }

                  return {
                    uri: nestedUri,
                    name: getSafEntryName(nestedUri),
                    modifiedAt,
                    source: "saf" as const,
                  };
                })
            ))
          );
        } catch {
          // Entrada nao e pasta SAF acessivel.
        }
      }
    } catch (error) {
      console.log("[TELA2-EM-ROTA] SAF indisponivel", {
        directoryUri,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return candidates;
}

async function listMediaStoreDownloadCandidates() {
  const files = await listRomaneioXlsxFromMediaStore();
  return files
    .filter((file) => file.name?.toLowerCase().endsWith(".xlsx"))
    .filter((file) => decodeURIComponent(`${file.path || ""}/${file.name || ""}`).toLowerCase().includes("romaneio"))
    .map((file) => ({
      uri: file.uri,
      name: file.name,
      modifiedAt: Number(file.modifiedAt || file.addedAt || 0),
      addedAt: Number(file.addedAt || 0),
      size: Number(file.size || 0),
      source: "mediastore" as const,
    }));
}

async function readXlsxCandidateBase64(candidate: Pick<XlsxCandidate, "uri" | "source">) {
  if (candidate.source === "mediastore" || candidate.uri.startsWith("content://media/")) {
    const nativeBase64 = await readMediaStoreXlsxBase64(candidate.uri);
    if (nativeBase64) {
      return nativeBase64;
    }

    console.log("[TELA2-EM-ROTA] MediaStore sem leitura, tentando FileSystem", {
      uri: candidate.uri,
    });
  }

  return FileSystem.readAsStringAsync(candidate.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function getSortedCandidates() {
  const candidates = [
    ...(await listMediaStoreDownloadCandidates()),
    ...(await listDirectDownloadCandidates()),
    ...(await listSafDownloadCandidates()),
  ];
  const seen = new Set<string>();
  const sorted = candidates
    .filter(isRomaneioCandidate)
    .filter((candidate) => {
      if (seen.has(candidate.uri)) return false;
      seen.add(candidate.uri);
      return true;
    })
    .sort((left, right) => {
      const rightScore = getCandidateDateScore(right);
      const leftScore = getCandidateDateScore(left);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      if (right.modifiedAt !== left.modifiedAt) {
        return right.modifiedAt - left.modifiedAt;
      }
      if ((right.addedAt || 0) !== (left.addedAt || 0)) {
        return (right.addedAt || 0) - (left.addedAt || 0);
      }
      return right.name.localeCompare(left.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

  const rankingSignature = sorted.slice(0, 8).map(getCandidateIdentity).join("||");
  if (rankingSignature !== lastLoggedXlsxRankingSignature) {
    lastLoggedXlsxRankingSignature = rankingSignature;
    console.log("[TELA2-EM-ROTA] ranking XLSX celular", sorted.slice(0, 8).map((candidate, index) => ({
      index,
      name: candidate.name,
      modifiedAt: candidate.modifiedAt,
      addedAt: candidate.addedAt || 0,
      size: candidate.size || 0,
      nameDate: getCandidateNameDateValue(candidate),
      today: getTodayDateValue(),
      dateScore: getCandidateDateScore(candidate),
      uri: candidate.uri,
      source: candidate.source,
    })));
  }

  return sorted;
}

export async function getCachedTela2EmRotaPayload() {
  const raw = await AsyncStorage.getItem(KEY_EM_ROTA_PAYLOAD);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Tela2EmRotaPayload;

    // Invalida cache antigo sem coordenadas (sourceFileName null = veio do fallback hardcoded)
    const hasCoordinates = parsed.stops.some((stop) =>
      stop.orders.some((order) => {
        const lat = parseFloat(String(order.latitude || ""));
        const lng = parseFloat(String(order.longitude || ""));
        return isFinite(lat) && lat !== 0 && isFinite(lng) && lng !== 0;
      })
    );

    if (!hasCoordinates && parsed.sourceFileName === null) {
      await AsyncStorage.removeItem(KEY_EM_ROTA_PAYLOAD);
      return null;
    }

    return parsed;
  } catch {
    await AsyncStorage.removeItem(KEY_EM_ROTA_PAYLOAD);
    return null;
  }
}

export async function getTela2EmRotaPayload() {
  return (await getCachedTela2EmRotaPayload()) || getFallbackPayload();
}

export async function getTela2EmRotaTotalCount() {
  const payload = await getTela2EmRotaPayload();
  return payload.totalOrders;
}

export async function setTela2EmRotaDownloadsUri(uri: string | null) {
  if (!uri) {
    await AsyncStorage.removeItem(KEY_EM_ROTA_DOWNLOADS_URI);
    return;
  }
  await AsyncStorage.setItem(KEY_EM_ROTA_DOWNLOADS_URI, uri);
}

export async function hasTela2EmRotaRomaneioPermission() {
  const savedUri = await AsyncStorage.getItem(KEY_EM_ROTA_DOWNLOADS_URI);
  if (!savedUri || !isAllowedXlsxSafTree(savedUri)) {
    return false;
  }

  try {
    await FileSystem.StorageAccessFramework.readDirectoryAsync(savedUri);
    return true;
  } catch {
    return false;
  }
}

export async function ensureTela2EmRotaDownloadsPermission() {
  const savedUri = await AsyncStorage.getItem(KEY_EM_ROTA_DOWNLOADS_URI);

  if (savedUri) {
    if (!isAllowedXlsxSafTree(savedUri)) {
      console.log("[TELA2-EM-ROTA] permissao XLSX fora de Romaneio, solicitando novamente", {
        savedUri,
        treePath: getSafTreePath(savedUri),
      });
      await AsyncStorage.removeItem(KEY_EM_ROTA_DOWNLOADS_URI);
    } else {
      try {
        await FileSystem.StorageAccessFramework.readDirectoryAsync(savedUri);
        return savedUri;
      } catch (error) {
        console.log("[TELA2-EM-ROTA] permissao XLSX salva falhou, solicitando de novo", error);
        await AsyncStorage.removeItem(KEY_EM_ROTA_DOWNLOADS_URI);
      }
    }
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Permissao necessaria para acessar a pasta XLSX.");
    }

    if (!isAllowedXlsxSafTree(permission.directoryUri)) {
      await AsyncStorage.removeItem(KEY_EM_ROTA_DOWNLOADS_URI);
      console.log("[TELA2-EM-ROTA] pasta XLSX rejeitada, precisa ser Romaneio", {
        attempt,
        selectedUri: permission.directoryUri,
        treePath: getSafTreePath(permission.directoryUri),
      });
      continue;
    }

    await AsyncStorage.setItem(KEY_EM_ROTA_DOWNLOADS_URI, permission.directoryUri);
    console.log("[TELA2-EM-ROTA] pasta XLSX autorizada", permission.directoryUri);
    return permission.directoryUri;
  }

  throw new Error(TELA2_EM_ROTA_PICK_ROMANEIO_MESSAGE);
}

export async function setTela2EmRotaSelectedXlsxUri(uri: string | null) {
  if (!uri) {
    await AsyncStorage.removeItem(KEY_EM_ROTA_SELECTED_XLSX_URI);
    return;
  }
  await AsyncStorage.setItem(KEY_EM_ROTA_SELECTED_XLSX_URI, uri);
}

export async function importTela2EmRotaPayloadFromXlsxUri(uri: string, name?: string) {
  const base64 = await readXlsxCandidateBase64({ uri, source: uri.startsWith("content://media/") ? "mediastore" : undefined });

  const rows = extractRowsFromBase64(base64);
  if (rows.length === 0 || rows.length > MAX_VALID_XLSX_ROWS) {
    throw new Error("Nenhum marcador valido encontrado no XLSX importado.");
  }

  const payload = mapRowsToPayload(rows, {
    uri,
    name: name || decodeURIComponent(uri.split("%2F").pop() || uri.split("/").pop() || "arquivo.xlsx"),
    modifiedAt: Date.now(),
  });

  await AsyncStorage.setItem(KEY_EM_ROTA_SELECTED_XLSX_URI, uri);
  await AsyncStorage.setItem(KEY_EM_ROTA_PAYLOAD, JSON.stringify(payload));

  return payload;
}

async function refreshTela2EmRotaPayloadFromDownloadsUnsafe() {
  const candidates = await getSortedCandidates();
  const cached = await getCachedTela2EmRotaPayload();
  const newestCandidate = candidates[0];
  const newestIdentity = newestCandidate ? getCandidateIdentity(newestCandidate) : "";
  const cachedIdentity = cached ? getPayloadSourceIdentity(cached) : "";

  console.log("[TELA2-EM-ROTA] decisao XLSX", {
    candidatesCount: candidates.length,
    newestName: newestCandidate?.name || null,
    newestDate: newestCandidate ? getCandidateNameDateValue(newestCandidate) : null,
    newestModifiedAt: newestCandidate?.modifiedAt || 0,
    newestAddedAt: newestCandidate?.addedAt || 0,
    newestSize: newestCandidate?.size || 0,
    newestSource: newestCandidate?.source || null,
    newestUri: newestCandidate?.uri || null,
    cachedName: cached?.sourceFileName || null,
    cachedModifiedAt: cached?.sourceModifiedAt || 0,
    cachedAddedAt: cached?.sourceAddedAt || 0,
    cachedSize: cached?.sourceSize || 0,
    sameAsCache: !!cached && cachedIdentity === newestIdentity,
  });

  if (
    cached &&
    newestCandidate &&
    cachedIdentity === newestIdentity
  ) {
    return cached;
  }

  for (const [index, candidate] of candidates.entries()) {
    try {
      console.log("[TELA2-EM-ROTA] tentando importar XLSX", {
        index,
        name: candidate.name,
        nameDate: getCandidateNameDateValue(candidate),
        dateScore: getCandidateDateScore(candidate),
        modifiedAt: candidate.modifiedAt,
        addedAt: candidate.addedAt || 0,
        size: candidate.size || 0,
        uri: candidate.uri,
        source: candidate.source,
      });
      const base64 = await readXlsxCandidateBase64(candidate);
      const rows = extractRowsFromBase64(base64);
      if (rows.length === 0 || rows.length > MAX_VALID_XLSX_ROWS) {
        console.log("[TELA2-EM-ROTA] XLSX ignorado por quantidade de linhas", {
          name: candidate.name,
          rows: rows.length,
          max: MAX_VALID_XLSX_ROWS,
        });
        continue;
      }

      const payload = mapRowsToPayload(rows, candidate);
      await AsyncStorage.setItem(KEY_EM_ROTA_PAYLOAD, JSON.stringify(payload));
      console.log("[TELA2-EM-ROTA] XLSX importado", {
        sourceFileName: payload.sourceFileName,
        rowsCount: payload.rowsCount,
        atId: payload.atId,
        sourceModifiedAt: payload.sourceModifiedAt,
        sourceAddedAt: payload.sourceAddedAt || 0,
        sourceSize: payload.sourceSize || 0,
      });
      return payload;
    } catch (error) {
      console.log("[TELA2-EM-ROTA] XLSX falhou, tentando proximo", {
        name: candidate.name,
        error: error instanceof Error ? error.message : String(error),
      });
      // Ignore unreadable or malformed XLSX files and keep searching.
    }
  }

  if (cached) {
    return cached;
  }

  const fallback = getFallbackPayload();
  await AsyncStorage.setItem(KEY_EM_ROTA_PAYLOAD, JSON.stringify(fallback));
  return fallback;
}

export async function refreshTela2EmRotaPayloadFromDownloads() {
  if (emRotaRefreshPromise) {
    return emRotaRefreshPromise;
  }

  emRotaRefreshPromise = refreshTela2EmRotaPayloadFromDownloadsUnsafe().finally(() => {
    emRotaRefreshPromise = null;
  });

  return emRotaRefreshPromise;
}

export function preloadTela2EmRotaPayloadFromPhone(reason = "background") {
  const now = Date.now();
  if (emRotaRefreshPromise || now - lastEmRotaPreloadAt < 1800) {
    return;
  }

  lastEmRotaPreloadAt = now;
  void refreshTela2EmRotaPayloadFromDownloads()
    .then((payload) => {
      const sourceUri = String(payload.sourceFileUri || "");
      if (sourceUri && sourceUri !== lastLoggedPreloadSourceUri) {
        lastLoggedPreloadSourceUri = sourceUri;
        console.log("[TELA2-EM-ROTA] preload XLSX celular OK", {
          reason,
          sourceFileName: payload.sourceFileName,
          rowsCount: payload.rowsCount,
        });
      }
    })
    .catch((error) => {
      console.log("[TELA2-EM-ROTA] preload XLSX celular falhou", {
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

export function startTela2EmRotaXlsxMonitor(reason = "app_open") {
  if (emRotaXlsxMonitorTimer) {
    return;
  }

  console.log("[TELA2-EM-ROTA] monitor XLSX celular iniciado", { reason });

  const tick = () => {
    preloadTela2EmRotaPayloadFromPhone("monitor_2s");
  };

  void ensureTela2EmRotaDownloadsPermission()
    .then(() => tick())
    .catch((error) => {
      console.log("[TELA2-EM-ROTA] permissao XLSX pendente", {
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      tick();
    });
  emRotaXlsxMonitorTimer = setInterval(tick, 2000);
}

export function stopTela2EmRotaXlsxMonitor() {
  if (!emRotaXlsxMonitorTimer) {
    return;
  }

  clearInterval(emRotaXlsxMonitorTimer);
  emRotaXlsxMonitorTimer = null;
  console.log("[TELA2-EM-ROTA] monitor XLSX celular parado");
}

export const TELA2_EM_ROTA_FALLBACK_PAYLOAD = getFallbackPayload();
