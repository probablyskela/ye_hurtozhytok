/**
 * Web Push without libraries: VAPID (RFC 8292) and aes128gcm payload
 * encryption (RFC 8291 over RFC 8188), using only WebCrypto so it runs in a
 * Worker and in tests.
 */
import { base64url, fromBase64url, type Bytes } from "./google";

const encoder = new TextEncoder();
const enc = {
  encode: (s: string): Bytes => new Uint8Array(encoder.encode(s)) as Bytes,
};

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(
    new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)),
  );
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(
  ikm: Bytes,
  salt: Bytes,
  info: Bytes,
  bytes: number,
): Promise<Bytes> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/** JWK for a P-256 key from the raw 65-byte public point and, optionally, the private scalar. */
export function p256Jwk(
  publicRaw: Uint8Array,
  privateD?: Uint8Array,
): JsonWebKey {
  return {
    kty: "EC",
    crv: "P-256",
    x: base64url(publicRaw.slice(1, 33)),
    y: base64url(publicRaw.slice(33, 65)),
    ...(privateD ? { d: base64url(privateD) } : {}),
    ext: true,
  };
}

export type Subscription = { endpoint: string; p256dh: string; auth: string };

/**
 * Encrypts a payload for one subscription. `ephemeral` and `salt` exist only so
 * tests can reproduce the RFC 8291 example.
 */
export async function encryptPayload(
  sub: Subscription,
  payload: string,
  fixed?: { asPublic: Bytes; asPrivate: Bytes; salt: Bytes },
): Promise<Bytes> {
  const uaPublic = fromBase64url(sub.p256dh);
  const authSecret = fromBase64url(sub.auth);

  let asPublic: Bytes;
  let asPrivateKey: CryptoKey;
  if (fixed) {
    asPublic = fixed.asPublic;
    asPrivateKey = await crypto.subtle.importKey(
      "jwk",
      p256Jwk(fixed.asPublic, fixed.asPrivate),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
  } else {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    )) as CryptoKeyPair;
    asPublic = new Uint8Array(
      await crypto.subtle.exportKey("raw", pair.publicKey),
    );
    asPrivateKey = pair.privateKey;
  }
  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: uaKey },
      asPrivateKey,
      256,
    ),
  );

  const ikm = await hkdf(
    shared,
    authSecret,
    concat(enc.encode("WebPush: info\0"), uaPublic, asPublic),
    32,
  );
  const salt: Bytes =
    fixed?.salt ?? crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const cek = await hkdf(
    ikm,
    salt,
    enc.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    ikm,
    salt,
    enc.encode("Content-Encoding: nonce\0"),
    12,
  );

  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, [
    "encrypt",
  ]);
  const padded = concat(enc.encode(payload), new Uint8Array([2]));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, padded),
  );

  const header = new Uint8Array(new ArrayBuffer(16 + 4 + 1 + asPublic.length));
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

/** Signed VAPID JWT for the push service that owns `endpoint`. */
export async function vapidAuthorization(
  endpoint: string,
  keys: { publicKey: string; privateKey: string; subject: string },
  nowSec = Math.floor(Date.now() / 1000),
): Promise<string> {
  const header = base64url(
    enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const claims = base64url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: nowSec + 12 * 3600,
        sub: keys.subject,
      }),
    ),
  );
  const signingKey = await crypto.subtle.importKey(
    "jwk",
    p256Jwk(fromBase64url(keys.publicKey), fromBase64url(keys.privateKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    enc.encode(`${header}.${claims}`),
  );
  return `vapid t=${header}.${claims}.${base64url(signature)}, k=${keys.publicKey}`;
}

export type PushResult = "sent" | "gone" | "failed";

export async function sendPush(
  sub: Subscription,
  message: { title: string; body: string; url: string },
  keys: { publicKey: string; privateKey: string; subject: string },
): Promise<PushResult> {
  const body = await encryptPayload(sub, JSON.stringify(message));
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, keys),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "900",
      Urgency: "high",
    },
    body,
  });
  if (res.status === 404 || res.status === 410) return "gone";
  if (!res.ok) {
    console.error("push failed", res.status, await res.text().catch(() => ""));
    return "failed";
  }
  return "sent";
}
