// Zimmerfotos liegen als bytea in der Datenbank - genau wie die Speisekarten.
// Begruendung: Es sind wenige, selten geaenderte Dateien. Dateien unter
// public/ waeren nach jedem Deploy auf Vercel verloren, und ein zusaetzlicher
// Speicherdienst waere fuer diese Menge nicht angemessen. Ausgeliefert werden
// die Bilder von /hotel/zimmerbild/<id>.

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export const MAX_IMAGES_PER_ROOM_TYPE = 20;

// Erlaubt sind nur Formate, die jeder Browser direkt anzeigt. Geprueft wird
// der Dateiinhalt, nicht der vom Browser gemeldete Typ.
const SIGNATURES: { contentType: string; test: (bytes: Uint8Array) => boolean }[] = [
  {
    contentType: "image/jpeg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    contentType: "image/png",
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    contentType: "image/webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

export const ALLOWED_IMAGE_LABEL = "JPEG, PNG oder WebP";

/** Erkennt das Bildformat am Dateiinhalt, oder null wenn es keines ist. */
export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.byteLength < 12) return null;

  return SIGNATURES.find((signature) => signature.test(bytes))?.contentType ?? null;
}

export type ImageRef = {
  id: number;
  url?: string | null;
  uploadedAt?: string | null;
  hasFile?: boolean;
};

// Die Datei gewinnt gegenueber einer externen Adresse. Der Zeitstempel im
// Query-String sorgt dafuer, dass ein ersetztes Bild sofort sichtbar wird,
// obwohl die Antwort lange gecacht werden darf.
export function imageSrc(image: ImageRef): string | null {
  if (image.hasFile) {
    const version = image.uploadedAt ? `?v=${encodeURIComponent(image.uploadedAt)}` : "";

    return `/hotel/zimmerbild/${image.id}${version}`;
  }

  return image.url ?? null;
}

export function formatImageSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
