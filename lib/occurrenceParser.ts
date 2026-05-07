export type ParsedOccurrence = {
  codigo: string | null;
  endereco: string | null;
  pessoa: string | null;
};

function splitLines(texto: string) {
  return texto
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseStructuredLine(line: string) {
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

function isAddressLine(line: string) {
  return /^(rua|av\.?|avenida|travessa|trav\.?|alameda|al\.?|estrada|estr\.?|rodovia|rod\.?|pra[cç]a|p[cç]a\.?|largo|beco|vila|condominio|cond\.?)/i.test(
    line
  );
}

function looksLikePersonName(line: string) {
  const cleaned = line
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

  return words.every((word) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+$/u.test(word));
}

export function extractBrCode(text: string) {
  const normalizedCompact = text.replace(/\s/g, "");
  if (/^BR[A-Z0-9]{6,16}$/i.test(normalizedCompact)) {
    return text.replace(/\s+/g, " ").trim();
  }

  const lineMatch = text.match(/\bBR[A-Z0-9 ]{6,20}\b/i);
  return lineMatch?.[0]?.replace(/\s+/g, " ").trim() ?? null;
}

function extractOccurrenceFromLines(linhas: string[]): ParsedOccurrence {
  const res: ParsedOccurrence = {
    codigo: null,
    endereco: null,
    pessoa: null,
  };

  let aposRecebedor = false;

  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i];
    const structured = parseStructuredLine(linha);
    const normalizedLine = normalizeLabel(linha);

    if (!res.codigo) {
      if (structured && ["br", "codigo", "code"].includes(structured.label)) {
        res.codigo = extractBrCode(structured.value) ?? structured.value;
      } else {
        res.codigo = extractBrCode(linha);
      }
    }

    if (!res.endereco) {
      if (
        structured &&
        ["endereco", "end", "address", "logradouro", "rua"].includes(structured.label)
      ) {
        res.endereco = structured.value;
      } else if (isAddressLine(linha)) {
        let endereco = linha;
        if (
          i + 1 < linhas.length &&
          !looksLikePersonName(linhas[i + 1]) &&
          !isAddressLine(linhas[i + 1]) &&
          !/^BR/i.test(linhas[i + 1]) &&
          !/destinat/i.test(linhas[i + 1])
        ) {
          endereco += ` ${linhas[i + 1]}`;
        }
        res.endereco = endereco;
      }
    }

    if (normalizedLine.includes("informacoes do recebedor")) {
      aposRecebedor = true;
      continue;
    }

    if (!res.pessoa) {
      if (
        structured &&
        ["pessoa", "nome", "destinatario", "cliente", "name"].includes(structured.label)
      ) {
        res.pessoa = structured.value;
      } else if (/destinat[aá]rio/i.test(linha)) {
        const proxima = linhas[i + 1] || "";
        if (proxima && !/^BR/i.test(proxima) && !isAddressLine(proxima)) {
          res.pessoa = proxima;
        }

        const inline = linha.replace(/destinat[aá]rio[:\s]*/i, "").trim();
        if (inline.length > 2) {
          res.pessoa = inline;
        }
      } else if (
        aposRecebedor &&
        linha.length > 2 &&
        !/^tel/i.test(linha) &&
        !/^hub/i.test(linha) &&
        !/^br/i.test(linha) &&
        !isAddressLine(linha)
      ) {
        res.pessoa = linha;
      }
    }
  }

  const fallbackLines = linhas.filter((line) => !extractBrCode(line));
  if (!res.pessoa && !aposRecebedor && fallbackLines.length > 0) {
    res.pessoa = fallbackLines[0];
  }
  if (!res.endereco && fallbackLines.length > 1) {
    res.endereco = fallbackLines[1];
  }

  return res;
}

export function extractOccurrenceFromText(texto: string): ParsedOccurrence {
  return extractOccurrenceFromLines(splitLines(texto));
}

export function extractOccurrencesFromText(texto: string): ParsedOccurrence[] {
  const linhas = splitLines(texto);
  const chunks: string[][] = [];
  let currentChunk: string[] = [];
  let currentChunkParsed: ParsedOccurrence = {
    codigo: null,
    endereco: null,
    pessoa: null,
  };

  for (const linha of linhas) {
    const normalizedLine = normalizeLabel(linha);
    const hasBr = Boolean(extractBrCode(linha));
    const startsRecipientSection = normalizedLine.includes("informacoes do recebedor");
    const startsAddress = isAddressLine(linha);
    const currentHasData = Boolean(
      currentChunkParsed.codigo || currentChunkParsed.endereco || currentChunkParsed.pessoa
    );
    const shouldSplit =
      currentChunk.length > 0 &&
      currentHasData &&
      (
        hasBr ||
        (startsRecipientSection && Boolean(currentChunkParsed.pessoa || currentChunkParsed.endereco)) ||
        (startsAddress && Boolean(currentChunkParsed.endereco || currentChunkParsed.pessoa))
      );

    if (shouldSplit) {
      chunks.push(currentChunk);
      currentChunk = [linha];
      currentChunkParsed = extractOccurrenceFromLines(currentChunk);
      continue;
    }

    currentChunk.push(linha);
    currentChunkParsed = extractOccurrenceFromLines(currentChunk);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const parsed = chunks
    .map((chunk) => extractOccurrenceFromLines(chunk))
    .filter((item) => item.codigo || item.endereco || item.pessoa);

  const unique = new Map<string, ParsedOccurrence>();
  for (const item of parsed) {
    const key = `${item.codigo ?? ""}|${item.endereco ?? ""}|${item.pessoa ?? ""}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  return [...unique.values()];
}
