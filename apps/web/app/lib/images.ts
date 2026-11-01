/**
 * Uploaded pictures are checked by their bytes, not by what the browser
 * claims, and lose metadata (EXIF with GPS, XMP, text) before they are
 * stored, so a photo never reveals where or when it was taken.
 */

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ascii = (b: Uint8Array, at: number, len: number) =>
  String.fromCharCode(...b.subarray(at, at + len));

/** The real format from the first bytes; null for anything else (SVG, HTML, …). */
export function detectImageType(b: Uint8Array): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (b.length >= 8 && PNG_SIGNATURE.every((v, i) => b[i] === v))
    return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP")
    return "image/webp";
  return null;
}

/**
 * JPEG: keeps the image data, JFIF (APP0), the colour profile (APP2) and
 * Adobe's colour flag (APP14); drops EXIF/XMP (APP1), the other APPn
 * segments and comments.
 */
function stripJpeg(b: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error("bad jpeg");
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    // Start of scan: the rest is compressed image data, copied as is.
    if (marker === 0xda) {
      parts.push(b.subarray(i));
      return concat(parts);
    }
    if (marker === 0xd9) break;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) throw new Error("bad jpeg");
    const drop =
      (marker >= 0xe1 &&
        marker <= 0xef &&
        marker !== 0xe2 &&
        marker !== 0xee) ||
      marker === 0xfe;
    if (!drop) parts.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  parts.push(Uint8Array.of(0xff, 0xd9));
  return concat(parts);
}

const PNG_DROP = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

/** PNG: drops EXIF, text and time chunks; everything else stays. */
function stripPng(b: Uint8Array): Uint8Array {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = view.getUint32(i);
    const end = i + 12 + len;
    if (end > b.length) throw new Error("bad png");
    const type = ascii(b, i + 4, 4);
    if (!PNG_DROP.has(type)) parts.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return concat(parts);
}

/** WebP: drops the EXIF and XMP chunks and clears their flags in VP8X. */
function stripWebp(b: Uint8Array): Uint8Array {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const parts: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const size = view.getUint32(i + 4, true);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > b.length) throw new Error("bad webp");
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = b.slice(i, Math.min(end, b.length));
      // VP8X flags byte: 0x08 = has EXIF, 0x04 = has XMP.
      if (type === "VP8X" && chunk.length > 8) chunk[8] &= ~(0x08 | 0x04);
      parts.push(chunk);
    }
    i = end;
  }
  const body = concat(parts);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 12));
  new DataView(head.buffer).setUint32(4, 4 + body.length, true);
  return concat([head, body]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The same picture without metadata; throws if the file is malformed. */
export function stripMetadata(b: Uint8Array, type: ImageType): Uint8Array {
  if (type === "image/jpeg") return stripJpeg(b);
  if (type === "image/png") return stripPng(b);
  return stripWebp(b);
}
