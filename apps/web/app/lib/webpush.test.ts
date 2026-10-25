import { describe, expect, it } from "vitest";

import { base64url, fromBase64url } from "./google";
import {
  encryptPayload,
  isSubscription,
  p256Jwk,
  vapidAuthorization,
} from "./webpush";

// RFC 8291, Appendix A.
const rfc = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

describe("web push encryption", () => {
  it("reproduces the RFC 8291 example", async () => {
    const out = await encryptPayload(
      {
        endpoint: "https://push.example.net/x",
        p256dh: rfc.uaPublic,
        auth: rfc.auth,
      },
      rfc.plaintext,
      {
        asPublic: fromBase64url(rfc.asPublic),
        asPrivate: fromBase64url(rfc.asPrivate),
        salt: fromBase64url(rfc.salt),
      },
    );
    expect(base64url(out)).toBe(rfc.body);
  });
});

describe("VAPID", () => {
  it("signs a token the public key verifies, for the push service origin", async () => {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const publicRaw = new Uint8Array(
      await crypto.subtle.exportKey("raw", pair.publicKey),
    );
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const keys = {
      publicKey: base64url(publicRaw),
      privateKey: jwk.d!,
      subject: "https://ehurtozhytok.pages.dev",
    };

    const header = await vapidAuthorization(
      "https://fcm.googleapis.com/fcm/send/abc",
      keys,
      1_000,
    );
    const [, token] = /^vapid t=([^,]+), k=/.exec(header)!;
    const [h, c, s] = token.split(".");
    expect(JSON.parse(new TextDecoder().decode(fromBase64url(c)))).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 1_000 + 12 * 3600,
      sub: "https://ehurtozhytok.pages.dev",
    });
    const verifyKey = await crypto.subtle.importKey(
      "jwk",
      p256Jwk(publicRaw),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verifyKey,
      fromBase64url(s),
      new TextEncoder().encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });
});

describe("isSubscription", () => {
  const sub = { p256dh: rfc.uaPublic, auth: rfc.auth };
  it("accepts the browsers' push services", () => {
    expect(
      isSubscription({
        ...sub,
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      }),
    ).toBe(true);
    expect(
      isSubscription({ ...sub, endpoint: "https://web.push.apple.com/QGx" }),
    ).toBe(true);
    expect(
      isSubscription({
        ...sub,
        endpoint: "https://updates.push.services.mozilla.com/wpush/v2/x",
      }),
    ).toBe(true);
  });
  it("refuses any other host, plain http and oversized keys", () => {
    expect(
      isSubscription({ ...sub, endpoint: "https://example.com/hook" }),
    ).toBe(false);
    expect(
      isSubscription({
        ...sub,
        endpoint: "https://fcm.googleapis.com.evil.com/x",
      }),
    ).toBe(false);
    expect(
      isSubscription({ ...sub, endpoint: "http://fcm.googleapis.com/x" }),
    ).toBe(false);
    expect(
      isSubscription({
        ...sub,
        auth: "x".repeat(100),
        endpoint: "https://fcm.googleapis.com/x",
      }),
    ).toBe(false);
  });
  it("refuses keys that could never encrypt a message", () => {
    const endpoint = "https://fcm.googleapis.com/x";
    expect(
      isSubscription({ ...sub, endpoint, p256dh: rfc.uaPublic.slice(0, 27) }),
    ).toBe(false);
    expect(isSubscription({ ...sub, endpoint, auth: "BTBZMqHH6r4T" })).toBe(
      false,
    );
    expect(isSubscription({ ...sub, endpoint, auth: "A" })).toBe(false);
  });
});
