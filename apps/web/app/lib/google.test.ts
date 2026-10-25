import { describe, expect, it } from "vitest";

import {
  authUrl,
  checkClaims,
  fromBase64url,
  base64url,
  isUniversityEmail,
  nameFromClaims,
  pkceChallenge,
} from "./google";

const good = {
  iss: "https://accounts.google.com",
  aud: "client-1",
  sub: "123",
  exp: 2_000_000_000,
  nonce: "n1",
  hd: "lpnu.ua",
  email: "olena.hrytsenko.shi.2024@lpnu.ua",
  email_verified: true,
  name: "Олена Гриценко",
};
const expected = { clientId: "client-1", nonce: "n1", nowSec: 1_900_000_000 };

describe("checkClaims", () => {
  it("accepts a verified Polytechnic account", () => {
    expect(checkClaims(good, expected)).toBeNull();
  });
  it("rejects accounts outside lpnu.ua even with a matching email suffix", () => {
    expect(checkClaims({ ...good, hd: undefined }, expected)).toBe("domain");
    expect(
      checkClaims({ ...good, hd: "gmail.com", email: "x@gmail.com" }, expected),
    ).toBe("domain");
  });
  it("rejects unverified email, wrong audience, nonce, issuer and expiry", () => {
    expect(checkClaims({ ...good, email_verified: false }, expected)).toBe(
      "email",
    );
    expect(checkClaims({ ...good, aud: "other" }, expected)).toBe("audience");
    expect(checkClaims({ ...good, nonce: "x" }, expected)).toBe("nonce");
    expect(
      checkClaims({ ...good, iss: "https://evil.example" }, expected),
    ).toBe("issuer");
    expect(checkClaims({ ...good, exp: 1_000 }, expected)).toBe("expired");
    expect(checkClaims({ ...good, sub: "" }, expected)).toBe("subject");
  });
});

describe("helpers", () => {
  it("recognises university addresses", () => {
    expect(isUniversityEmail("a.b.shi.2024@lpnu.ua")).toBe(true);
    expect(isUniversityEmail("a@lpnu.ua.evil.com")).toBe(false);
  });
  it("derives a name from the address when the token has none", () => {
    expect(
      nameFromClaims({
        ...good,
        name: undefined,
        given_name: undefined,
        family_name: undefined,
        email: "anton.mykhalchuk.shi.2024@lpnu.ua",
      }).lastName,
    ).toBe("Mykhalchuk");
  });
  it("asks Google for the lpnu.ua domain with PKCE", () => {
    const url = new URL(
      authUrl({
        clientId: "c",
        redirectUri: "https://x/auth/callback",
        state: "s",
        nonce: "n",
        codeChallenge: "cc",
      }),
    );
    expect(url.searchParams.get("hd")).toBe("lpnu.ua");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });
  it("computes the RFC 7636 PKCE example", async () => {
    expect(
      await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("round-trips base64url", () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 1]);
    expect(Array.from(fromBase64url(base64url(bytes)))).toEqual(
      Array.from(bytes),
    );
  });
});
