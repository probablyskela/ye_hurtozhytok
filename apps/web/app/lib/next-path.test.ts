import { describe, expect, it } from "vitest";

import { loginUrl, pagePath, safeNext } from "./next-path";

describe("way back after signing in", () => {
  it("keeps pages of the app", () => {
    expect(safeNext("/announcements/12")).toBe("/announcements/12");
    expect(safeNext("/machines/4?day=2026-11-03")).toBe(
      "/machines/4?day=2026-11-03",
    );
  });

  it("never leads to another site", () => {
    for (const bad of [
      "https://evil.example/",
      "//evil.example/x",
      "/\\evil.example",
      "/\t/evil.example",
      "javascript:alert(1)",
      "evil.example",
      "",
      null,
      42,
    ])
      expect(safeNext(bad)).toBeNull();
  });

  it("skips the sign-in pages and the home page", () => {
    expect(safeNext("/login?next=/x")).toBeNull();
    expect(safeNext("/auth/callback")).toBeNull();
    expect(safeNext("/welcome")).toBeNull();
    expect(safeNext("/")).toBeNull();
  });

  it("reads the page from a data request", () => {
    expect(
      pagePath(
        new Request(
          "https://x.dev/announcements/7.data?_routes=routes%2Fannouncement",
        ),
      ),
    ).toBe("/announcements/7");
    expect(pagePath(new Request("https://x.dev/_root.data"))).toBe("/");
  });

  it("builds the sign-in link", () => {
    expect(loginUrl("/announcements/7")).toBe(
      "/login?next=%2Fannouncements%2F7",
    );
    expect(loginUrl(null)).toBe("/login");
  });
});
