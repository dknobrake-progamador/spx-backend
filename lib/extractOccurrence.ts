function normalizeSpaces(str = "") {
  return str.replace(/\s+/g, " ").trim();
}

export type OccurrenceFields = {
  status: string;
  statusDate: string;
};

export function extractOccurrence(ocrText: string): OccurrenceFields {
  const lines = ocrText.split("\n").map((line) => normalizeSpaces(line)).filter(Boolean);

  const dateRegex = /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}(?:\s+\d{2}:\d{2})?\b/;

  for (const line of lines) {
    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      const statusDate = dateMatch[0];
      const status = normalizeSpaces(
        line.replace(dateRegex, "").replace(/[-–|]/g, "").trim()
      );
      return { status, statusDate };
    }
  }

  return { status: "", statusDate: "" };
}
