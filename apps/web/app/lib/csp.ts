import { createContext } from "react";

/** The per-request nonce that lets the page's own inline scripts run. */
export const NonceContext = createContext<string | undefined>(undefined);

export function newNonce(): string {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
  );
}

/**
 * Content Security Policy for HTML pages: scripts only from this site or with
 * the nonce, nothing embeds the app, forms go only here and to Google sign-in
 * (the login form redirects there, and form-action covers redirects).
 */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Sent with every response; pictures add their own stricter policy. */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
