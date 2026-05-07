function normalizeSpaces(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

export type NameOcrResult = {
  recipientName: string;
};

export function extractName(ocrText: string): NameOcrResult {
  const lines = ocrText
    .split("\n")
    .map((line) => normalizeSpaces(line))
    .filter(Boolean);

  const dateRegex = /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}(?:\s+\d{2}:\d{2})?\b/;
  const yellowIndex = lines.findIndex((line) => dateRegex.test(line));

  const before = yellowIndex >= 0 ? lines.slice(0, yellowIndex) : lines;

  const candidates = before
    .filter((line) => !/\bBR[\w\d]+\b/i.test(line))
    .filter(
      (line) =>
        !/\b(?:Rua|R\.|Avenida|Av\.|Travessa|Tv\.|Alameda|Praça|Praca|Rodovia)\b/i.test(
          line
        )
    )
    .filter((line) => line.length >= 4);

  const raw = candidates[candidates.length - 1] || "";
  const recipientName = raw.replace(/_+$/, "").trim();

  return { recipientName };
}
