export function isSvgUri(uri: string | null | undefined) {
  if (!uri) return false;
  const value = String(uri).trim().toLowerCase();
  return value.startsWith("data:image/svg+xml") || value.endsWith(".svg");
}
