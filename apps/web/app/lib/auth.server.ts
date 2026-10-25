import { eq } from "drizzle-orm";
import { createCookieSessionStorage, redirect } from "react-router";

import { activity, getDb } from "./db";
import { residents, type Resident } from "./db/schema";
import {
  GOOGLE_JWKS_URL,
  GOOGLE_TOKEN_URL,
  authUrl,
  checkClaims,
  fromBase64url,
  nameFromClaims,
  pkceChallenge,
  randomToken,
  type GoogleClaims,
} from "./google";

type SessionData = { residentId: number; version: number };
type LoginData = { state: string; nonce: string; verifier: string };

const YEAR_SECONDS = 60 * 60 * 24 * 365;

function secure(request: Request) {
  return new URL(request.url).protocol === "https:";
}

function sessionStorage(env: Env, request: Request) {
  return createCookieSessionStorage<SessionData>({
    cookie: {
      name: "eh_session",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: YEAR_SECONDS,
      secure: secure(request),
      secrets: [env.SESSION_SECRET],
    },
  });
}

/** Short-lived cookie that carries state, nonce and the PKCE verifier through Google. */
function loginStorage(env: Env, request: Request) {
  return createCookieSessionStorage<LoginData>({
    cookie: {
      name: "eh_login",
      httpOnly: true,
      sameSite: "lax",
      path: "/auth",
      maxAge: 10 * 60,
      secure: secure(request),
      secrets: [env.SESSION_SECRET],
    },
  });
}

export function googleEnabled(env: Env): boolean {
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
}

/** Development sign-in works only on localhost with DEV_LOGIN=1 and no Google client. */
export function devLoginEnabled(env: Env, request: Request): boolean {
  const host = new URL(request.url).hostname;
  return (
    env.DEV_LOGIN === "1" &&
    !googleEnabled(env) &&
    (host === "localhost" || host === "127.0.0.1")
  );
}

export async function getCurrentResident(
  request: Request,
  env: Env,
): Promise<Resident | null> {
  const storage = sessionStorage(env, request);
  const session = await storage.getSession(request.headers.get("Cookie"));
  const residentId = session.get("residentId");
  if (!residentId) return null;
  const resident = await getDb(env)
    .select()
    .from(residents)
    .where(eq(residents.id, residentId))
    .get();
  if (!resident || resident.sessionVersion !== session.get("version"))
    return null;
  return resident;
}

/** Signed in; blocked people still see their profile but cannot book. */
export async function requireResident(
  request: Request,
  env: Env,
): Promise<Resident> {
  const resident = await getCurrentResident(request, env);
  if (!resident) throw redirect("/login");
  return resident;
}

/** Signed in and the room is filled in; otherwise the first-run profile. */
export async function requireProfile(
  request: Request,
  env: Env,
): Promise<Resident> {
  const resident = await requireResident(request, env);
  if (!resident.room) throw redirect("/welcome");
  return resident;
}

async function startSession(request: Request, env: Env, resident: Resident) {
  const storage = sessionStorage(env, request);
  const session = await storage.getSession();
  session.set("residentId", resident.id);
  session.set("version", resident.sessionVersion);
  return storage.commitSession(session);
}

/** Finds the person by Google `sub` or creates them; keeps name and email fresh. */
async function upsertResident(
  env: Env,
  data: { sub: string; email: string; name: string },
): Promise<Resident> {
  const db = getDb(env);
  const now = Date.now();
  const existing = await db
    .select()
    .from(residents)
    .where(eq(residents.googleSub, data.sub))
    .get();
  if (existing) {
    await db
      .update(residents)
      .set({ email: data.email, name: data.name, updatedAt: now })
      .where(eq(residents.id, existing.id));
    return { ...existing, email: data.email, name: data.name };
  }
  const created = await db
    .insert(residents)
    .values({
      googleSub: data.sub,
      email: data.email,
      name: data.name,
      createdAt: now,
      updatedAt: now,
    })
    // Two first sign-ins at once: the second one just takes the row.
    .onConflictDoUpdate({
      target: residents.googleSub,
      set: { email: data.email, name: data.name, updatedAt: now },
    })
    .returning()
    .get();
  if (created.createdAt !== now) return created;
  await activity(db, {
    actorId: created.id,
    action: "resident.joined",
    entity: "resident",
    entityId: created.id,
  });
  return created;
}

function redirectUri(request: Request, env: Env) {
  const base =
    env.APP_URL && !devLoginEnabled(env, request)
      ? env.APP_URL
      : new URL(request.url).origin;
  return `${base}/auth/callback`;
}

/** Sends the browser to Google's account picker, preselecting lpnu.ua accounts. */
export async function startGoogleLogin(request: Request, env: Env) {
  if (!googleEnabled(env)) throw redirect("/login");
  const storage = loginStorage(env, request);
  const session = await storage.getSession();
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  session.set("state", state);
  session.set("nonce", nonce);
  session.set("verifier", verifier);
  const url = authUrl({
    clientId: env.GOOGLE_CLIENT_ID!,
    redirectUri: redirectUri(request, env),
    state,
    nonce,
    codeChallenge: await pkceChallenge(verifier),
  });
  return redirect(url, {
    headers: { "Set-Cookie": await storage.commitSession(session) },
  });
}

export type CallbackResult =
  | { ok: true; headers: Headers; needsProfile: boolean }
  | { ok: false; error: string };

const LOGIN_ERRORS = {
  generic: "Не вдалося увійти. Спробуйте ще раз.",
  domain:
    "Підходять лише акаунти Політехніки (@lpnu.ua). Увійдіть корпоративною поштою.",
};

export async function finishGoogleLogin(
  request: Request,
  env: Env,
): Promise<CallbackResult> {
  if (!googleEnabled(env)) return { ok: false, error: LOGIN_ERRORS.generic };
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storage = loginStorage(env, request);
  const login = await storage.getSession(request.headers.get("Cookie"));
  if (!code || !state || state !== login.get("state"))
    return { ok: false, error: LOGIN_ERRORS.generic };

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(request, env),
      grant_type: "authorization_code",
      code_verifier: login.get("verifier") ?? "",
    }),
  });
  if (!tokenRes.ok) {
    console.error("google token exchange failed", tokenRes.status);
    return { ok: false, error: LOGIN_ERRORS.generic };
  }
  const { id_token: idToken } = ((await tokenRes.json().catch(() => null)) ??
    {}) as { id_token?: unknown };
  const claims =
    typeof idToken === "string"
      ? await verifyIdToken(idToken).catch((error) => {
          console.error("id_token check failed", error);
          return null;
        })
      : null;
  if (!claims) return { ok: false, error: LOGIN_ERRORS.generic };

  const problem = checkClaims(claims, {
    clientId: env.GOOGLE_CLIENT_ID!,
    nonce: login.get("nonce") ?? "",
    nowSec: Math.floor(Date.now() / 1000),
  });
  if (problem === "domain" || problem === "email")
    return { ok: false, error: LOGIN_ERRORS.domain };
  if (problem) return { ok: false, error: LOGIN_ERRORS.generic };

  const resident = await upsertResident(env, {
    sub: claims.sub,
    email: claims.email!.toLowerCase(),
    name: nameFromClaims(claims),
  });
  const headers = new Headers();
  headers.append("Set-Cookie", await startSession(request, env, resident));
  headers.append("Set-Cookie", await storage.destroySession(login));
  return { ok: true, headers, needsProfile: !resident.room };
}

export async function devLogin(
  request: Request,
  env: Env,
  data: { email: string; name: string },
): Promise<Headers> {
  const resident = await upsertResident(env, {
    sub: `dev:${data.email.toLowerCase()}`,
    email: data.email.toLowerCase(),
    name: data.name,
  });
  return new Headers({
    "Set-Cookie": await startSession(request, env, resident),
  });
}

export async function logout(request: Request, env: Env) {
  const storage = sessionStorage(env, request);
  const session = await storage.getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
      // Shared phones: drop cached pages of the person who just left.
      "Clear-Site-Data": '"cache"',
    },
  });
}

// --- id_token signature check against Google's published keys ---

type Jwk = JsonWebKey & { kid: string };
let jwksCache: { keys: Jwk[]; until: number } | null = null;

async function googleKeys(force = false): Promise<Jwk[]> {
  if (!force && jwksCache && jwksCache.until > Date.now())
    return jwksCache.keys;
  const res = await fetch(GOOGLE_JWKS_URL);
  const body = res.ok
    ? ((await res.json().catch(() => null)) as { keys?: unknown } | null)
    : null;
  // Never cache a failed fetch: the next sign-in simply tries again.
  if (!Array.isArray(body?.keys)) {
    console.error("google keys fetch failed", res.status);
    return jwksCache?.keys ?? [];
  }
  const keys = body.keys as Jwk[];
  const maxAge = Number(
    /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600,
  );
  jwksCache = { keys, until: Date.now() + maxAge * 1000 };
  return keys;
}

/** JSON from one base64url part of a JWT, or null if it is not JSON. */
function jwtPart<T>(part: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64url(part))) as T;
  } catch {
    return null;
  }
}

async function verifyIdToken(token: string): Promise<GoogleClaims | null> {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const header = jwtPart<{ kid?: string; alg?: string }>(h);
  if (!header) return null;
  if (header.alg !== "RS256" || !header.kid) return null;
  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    fromBase64url(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!valid) return null;
  return jwtPart<GoogleClaims>(p);
}
