/** Google OpenID Connect pieces that need no network: URLs and claim checks. */
import { parseName, type PersonName } from "./names";

export const ALLOWED_DOMAIN = "lpnu.ua";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export type GoogleClaims = {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat?: number;
  nonce?: string;
  hd?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

export type ClaimError =
  "issuer" | "audience" | "subject" | "expired" | "nonce" | "domain" | "email";

/**
 * The `hd` parameter in the sign-in URL only preselects accounts on Google's
 * screen; the server must still check the domain in the signed token.
 */
export function checkClaims(
  claims: GoogleClaims,
  expected: { clientId: string; nonce: string; nowSec: number },
): ClaimError | null {
  if (!ISSUERS.includes(claims.iss)) return "issuer";
  if (claims.aud !== expected.clientId) return "audience";
  if (typeof claims.sub !== "string" || !claims.sub) return "subject";
  if (typeof claims.exp !== "number" || claims.exp < expected.nowSec - 60)
    return "expired";
  if (claims.nonce !== expected.nonce) return "nonce";
  if (claims.hd !== ALLOWED_DOMAIN) return "domain";
  const email = (claims.email ?? "").toLowerCase();
  const verified =
    claims.email_verified === true || claims.email_verified === "true";
  if (!verified || !email.endsWith(`@${ALLOWED_DOMAIN}`)) return "email";
  return null;
}

export function isUniversityEmail(email: string): boolean {
  return /^[a-z0-9._%+-]+@lpnu\.ua$/i.test(email.trim());
}

/** "anton.mykhalchuk.shi.2024@lpnu.ua" → "Anton Mykhalchuk" when the token has no name. */
export function nameFromClaims(claims: GoogleClaims): PersonName {
  return parseName({
    name: claims.name,
    givenName: claims.given_name,
    familyName: claims.family_name,
    email: claims.email,
  });
}

export function authUrl(p: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    hd: ALLOWED_DOMAIN,
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type Bytes = Uint8Array<ArrayBuffer>;

export function fromBase64url(s: string): Bytes {
  const b64 =
    s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(digest);
}
