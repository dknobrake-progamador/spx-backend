function splitLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseStructuredLine(line) {
  const separatorIndex = line.search(/[:=-]/);
  if (separatorIndex === -1) {
    return null;
  }

  const label = normalizeLabel(line.slice(0, separatorIndex));
  const value = line.slice(separatorIndex + 1).trim();
  if (!value) {
    return null;
  }

  return { label, value };
}

function isAddressLine(line) {
  return /^(rua|r\.|avenida|av\.|travessa|trav\.|alameda|al\.|estrada|estr\.|rodovia|rod\.|praca|pca\.|largo|beco|vila|condominio|cond\.)/i.test(
    line
  );
}

function looksLikePersonName(line) {
  const cleaned = String(line || "")
    .replace(/[|_]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 5) {
    return false;
  }

  if (extractBrCode(cleaned) || isAddressLine(cleaned)) {
    return false;
  }

  if (/\d/.test(cleaned) || /^(hub|tel|status|data)\b/i.test(cleaned)) {
    return false;
  }

  const words = cleaned.split(" ");
  if (words.length < 2 || words.length > 6) {
    return false;
  }

  return words.every((word) => /^[A-Z][a-z]+$/u.test(word));
}

function extractBrCode(text) {
  const normalizedCompact = String(text || "").replace(/\s/g, "");
  if (/^BR[A-Z0-9]{6,16}$/i.test(normalizedCompact)) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  const lineMatch = String(text || "").match(/\bBR[A-Z0-9 ]{6,20}\b/i);
  return lineMatch?.[0]?.replace(/\s+/g, " ").trim() ?? null;
}

function extractOccurrenceFromLines(lines) {
  const result = {
    codigo: null,
    endereco: null,
    pessoa: null,
  };

  let afterRecipientSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const structured = parseStructuredLine(line);
    const normalizedLine = normalizeLabel(line);

    if (!result.codigo) {
      if (structured && ["br", "codigo", "code"].includes(structured.label)) {
        result.codigo = extractBrCode(structured.value) ?? structured.value;
      } else {
        result.codigo = extractBrCode(line);
      }
    }

    if (!result.endereco) {
      if (
        structured &&
        ["endereco", "end", "address", "logradouro", "rua"].includes(structured.label)
      ) {
        result.endereco = structured.value;
      } else if (isAddressLine(line)) {
        let address = line;
        if (
          index + 1 < lines.length &&
          !looksLikePersonName(lines[index + 1]) &&
          !isAddressLine(lines[index + 1]) &&
          !/^BR/i.test(lines[index + 1]) &&
          !/destinat/i.test(lines[index + 1])
        ) {
          address += ` ${lines[index + 1]}`;
        }
        result.endereco = address;
      }
    }

    if (normalizedLine.includes("informacoes do recebedor")) {
      afterRecipientSection = true;
      continue;
    }

    if (!result.pessoa) {
      if (
        structured &&
        ["pessoa", "nome", "destinatario", "cliente", "name"].includes(structured.label)
      ) {
        result.pessoa = structured.value;
      } else if (/destinatario/i.test(normalizedLine)) {
        const next = lines[index + 1] || "";
        if (next && !/^BR/i.test(next) && !isAddressLine(next)) {
          result.pessoa = next;
        }

        const inline = line.replace(/destinatario[:\s]*/i, "").trim();
        if (inline.length > 2) {
          result.pessoa = inline;
        }
      } else if (
        afterRecipientSection &&
        line.length > 2 &&
        !/^tel/i.test(line) &&
        !/^hub/i.test(line) &&
        !/^br/i.test(line) &&
        !isAddressLine(line)
      ) {
        result.pessoa = line;
      }
    }
  }

  const fallbackLines = lines.filter((line) => !extractBrCode(line));
  if (!result.pessoa && !afterRecipientSection && fallbackLines.length > 0) {
    result.pessoa = fallbackLines[0];
  }
  if (!result.endereco && fallbackLines.length > 1) {
    result.endereco = fallbackLines[1];
  }

  return result;
}

function extractOccurrenceFromText(text) {
  return extractOccurrenceFromLines(splitLines(text));
}

function extractOccurrencesFromText(text) {
  const lines = splitLines(text);
  const chunks = [];
  let currentChunk = [];
  let currentChunkParsed = {
    codigo: null,
    endereco: null,
    pessoa: null,
  };

  for (const line of lines) {
    const normalizedLine = normalizeLabel(line);
    const hasBr = Boolean(extractBrCode(line));
    const startsRecipientSection = normalizedLine.includes("informacoes do recebedor");
    const startsAddress = isAddressLine(line);
    const currentHasData = Boolean(
      currentChunkParsed.codigo || currentChunkParsed.endereco || currentChunkParsed.pessoa
    );
    const shouldSplit =
      currentChunk.length > 0 &&
      currentHasData &&
      (hasBr ||
        (startsRecipientSection &&
          Boolean(currentChunkParsed.pessoa || currentChunkParsed.endereco)) ||
        (startsAddress && Boolean(currentChunkParsed.endereco || currentChunkParsed.pessoa)));

    if (shouldSplit) {
      chunks.push(currentChunk);
      currentChunk = [line];
      currentChunkParsed = extractOccurrenceFromLines(currentChunk);
      continue;
    }

    currentChunk.push(line);
    currentChunkParsed = extractOccurrenceFromLines(currentChunk);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const parsed = chunks
    .map((chunk) => {
      const item = extractOccurrenceFromLines(chunk);
      return {
        ...item,
        rawText: chunk.join("\n"),
      };
    })
    .filter((item) => item.codigo || item.endereco || item.pessoa);

  const unique = new Map();
  for (const item of parsed) {
    const key = `${item.codigo ?? ""}|${item.endereco ?? ""}|${item.pessoa ?? ""}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  return [...unique.values()];
}

module.exports = {
  extractOccurrenceFromText,
  extractOccurrencesFromText,
};
