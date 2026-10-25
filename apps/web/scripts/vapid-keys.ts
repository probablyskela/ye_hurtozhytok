/**
 * Prints a new Web Push (VAPID) key pair.
 * Public key → "VAPID_PUBLIC_KEY" in wrangler.jsonc vars;
 * private key → `npx wrangler secret put VAPID_PRIVATE_KEY` (never commit it).
 */
const toB64url = (b: ArrayBuffer | Uint8Array) =>
  Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString(
    "base64url",
  );

const pair = (await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
)) as CryptoKeyPair;
const publicRaw = await crypto.subtle.exportKey("raw", pair.publicKey);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

console.log(`VAPID_PUBLIC_KEY=${toB64url(publicRaw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);

export {};
