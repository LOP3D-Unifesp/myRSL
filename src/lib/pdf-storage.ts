import { supabase } from "@/integrations/supabase/client";

const PDF_BUCKET = "research-pdfs";
const STORAGE_PATH_REGEX = /\/storage\/v1\/object\/(?:public|sign)\/research-pdfs\/([^?]+)/i;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function getStoragePathFromPdfRef(pdfRef: string | null | undefined): string | null {
  if (!pdfRef) return null;
  if (!isHttpUrl(pdfRef)) return pdfRef;
  const match = pdfRef.match(STORAGE_PATH_REGEX);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1]);
}

export async function getPdfAccessUrl(pdfRef: string | null | undefined, expiresInSeconds = 3600): Promise<string | null> {
  if (!pdfRef) return null;
  const storagePath = getStoragePathFromPdfRef(pdfRef);
  if (!storagePath) return pdfRef;
  const { data, error } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
