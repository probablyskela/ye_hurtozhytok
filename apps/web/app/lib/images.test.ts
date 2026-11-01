import { describe, expect, it } from "vitest";

import { detectImageType, stripMetadata } from "./images";

const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(
    parts.flatMap((p) =>
      typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p,
    ),
  );
const has = (b: Uint8Array, text: string) =>
  String.fromCharCode(...b).includes(text);

// A JPEG: SOI, APP0 (JFIF), APP1 (EXIF with "GPS"), COM, SOS + data, EOI.
const segment = (marker: number, payload: string) => [
  0xff,
  marker,
  ...[(payload.length + 2) >> 8, (payload.length + 2) & 0xff],
  ...[...payload].map((c) => c.charCodeAt(0)),
];
const jpeg = bytes(
  [0xff, 0xd8],
  segment(0xe0, "JFIF\0"),
  segment(0xe1, "Exif\0\0GPS-49.84,24.03"),
  segment(0xfe, "comment"),
  [0xff, 0xda, 0x00, 0x02, 1, 2, 3, 4, 0xff, 0xd9],
);

const chunk = (type: string, data: string) => {
  const len = data.length;
  return bytes(
    [len >>> 24, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff],
    type,
    data,
    [0, 0, 0, 0],
  );
};
const png = (() => {
  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk("IHDR", "0123456789abc"),
    chunk("eXIf", "GPS-49.84"),
    chunk("tEXt", "Author\0Petro"),
    chunk("IDAT", "pixels"),
    chunk("IEND", ""),
  ];
  return Uint8Array.from(parts.flatMap((p) => [...p]));
})();

const le32 = (n: number) => [
  n & 0xff,
  (n >> 8) & 0xff,
  (n >> 16) & 0xff,
  n >>> 24,
];
const webpChunk = (type: string, data: number[]) => [
  ...bytes(type),
  ...le32(data.length),
  ...data,
  ...(data.length % 2 ? [0] : []),
];
const webp = (() => {
  const body = [
    ...webpChunk("VP8X", [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ...webpChunk("VP8 ", [1, 2, 3, 4]),
    ...webpChunk("EXIF", [...bytes("GPS-49.84")]),
    ...webpChunk("XMP ", [...bytes("<x/>")]),
  ];
  return Uint8Array.from([
    ...bytes("RIFF"),
    ...le32(4 + body.length),
    ...bytes("WEBP"),
    ...body,
  ]);
})();

describe("image type by bytes", () => {
  it("knows JPEG, PNG and WebP", () => {
    expect(detectImageType(jpeg)).toBe("image/jpeg");
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(webp)).toBe("image/webp");
  });
  it("refuses anything else, whatever the browser called it", () => {
    expect(detectImageType(bytes("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageType(bytes("<!doctype html><script>"))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("metadata is removed", () => {
  it("drops EXIF and comments from a JPEG, keeps the image", () => {
    const out = stripMetadata(jpeg, "image/jpeg");
    expect(has(out, "GPS")).toBe(false);
    expect(has(out, "comment")).toBe(false);
    expect(has(out, "JFIF")).toBe(true);
    expect([...out.slice(-6)]).toEqual([1, 2, 3, 4, 0xff, 0xd9]);
    expect(detectImageType(out)).toBe("image/jpeg");
  });
  it("drops EXIF and text chunks from a PNG", () => {
    const out = stripMetadata(png, "image/png");
    expect(has(out, "GPS")).toBe(false);
    expect(has(out, "Petro")).toBe(false);
    expect(has(out, "IDAT")).toBe(true);
    expect(has(out, "IEND")).toBe(true);
  });
  it("drops EXIF and XMP from a WebP and fixes its header", () => {
    const out = stripMetadata(webp, "image/webp");
    expect(has(out, "GPS")).toBe(false);
    expect(has(out, "<x/>")).toBe(false);
    expect(has(out, "VP8 ")).toBe(true);
    // RIFF size covers the rest of the file; VP8X no longer claims EXIF/XMP.
    const size = new DataView(out.buffer).getUint32(4, true);
    expect(size).toBe(out.length - 8);
    expect(out[20] & 0x0c).toBe(0);
  });
  it("refuses a broken file", () => {
    expect(() =>
      stripMetadata(
        Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff),
        "image/jpeg",
      ),
    ).toThrow();
  });
});
