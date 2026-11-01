/**
 * Where to go after signing in: only a page of this app, never another
 * site (no "//host", "/\host" or "https://…"), and never the sign-in pages.
 */
export function safeNext(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 300) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\"))
    return null;
  // Control characters and backslashes can turn a path into another host.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, "https://app.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://app.invalid") return null;
  if (/^\/(login|logout|auth|welcome)(\/|$)/.test(url.pathname)) return null;
  const path = url.pathname + url.search;
  return path === "/" ? null : path;
}

/** The page a request was for, as a user sees it (no React Router data suffix). */
export function pagePath(request: Request): string {
  const url = new URL(request.url);
  let path = url.pathname.replace(/\.data$/, "");
  if (path === "/_root") path = "/";
  url.searchParams.delete("_routes");
  url.searchParams.delete("index");
  const search = url.searchParams.toString();
  return search ? `${path}?${search}` : path;
}

/** "/login" with the way back, when there is one. */
export function loginUrl(next: string | null, base = "/login"): string {
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}
