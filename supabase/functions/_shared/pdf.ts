const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((value, idx) => bytes[idx] === value);
}

export function sanitizePdfFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const fallback = "article.pdf";
  const normalized = (trimmed || fallback).replace(/[^a-zA-Z0-9._-]/g, "_");
  const collapsed = normalized.replace(/_+/g, "_");
  const withExtension = collapsed.toLowerCase().endsWith(".pdf") ? collapsed : `${collapsed}.pdf`;
  return withExtension.slice(0, 256);
}
