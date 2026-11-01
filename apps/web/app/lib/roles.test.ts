import { describe, expect, it } from "vitest";

import { ROLE_LABELS, ROLES, isRole, normalizeEmail, sortRoles } from "./roles";

describe("roles", () => {
  it("knows every role and names it", () => {
    for (const role of ROLES) expect(ROLE_LABELS[role]).toBeTruthy();
    expect(isRole("council")).toBe(true);
    expect(isRole("resident")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
  it("accepts only Polytechnic addresses, lower-cased", () => {
    expect(normalizeEmail("  Olena.Hrytsenko@LPNU.ua ")).toBe(
      "olena.hrytsenko@lpnu.ua",
    );
    expect(normalizeEmail("someone@gmail.com")).toBeNull();
    expect(normalizeEmail("a'b@lpnu.ua")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
  it("sorts roles in a stable order without repeats", () => {
    expect(sortRoles(["site_manager", "council", "council"])).toEqual([
      "council",
      "site_manager",
    ]);
  });
});
