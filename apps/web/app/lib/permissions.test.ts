import { describe, expect, it } from "vitest";

import {
  canBlock,
  canBook,
  canCancel,
  canManageRoles,
  canRelease,
  canRevokeRole,
  isCouncil,
} from "./permissions";

const resident = { id: 1, roles: [], room: "612" };
const other = { id: 2, roles: [], room: "608" };
const council = { id: 3, roles: ["council" as const], room: "601" };
const head = { id: 5, roles: ["council_head" as const], room: "603" };
const squad = { id: 6, roles: ["squad" as const], room: "404" };
const manager = {
  id: 7,
  roles: ["site_manager" as const],
  room: "509",
  email: "anton@lpnu.ua",
};

describe("permissions", () => {
  it("needs a room and no block to book", () => {
    expect(canBook(resident)).toBe(true);
    expect(canBook({ ...resident, room: null })).toBe(false);
    expect(canBook({ ...resident, blocked: true })).toBe(false);
  });
  it("counts members and the head as the council", () => {
    expect(isCouncil(council)).toBe(true);
    expect(isCouncil(head)).toBe(true);
    expect(isCouncil(squad)).toBe(false);
    expect(isCouncil(manager)).toBe(false);
  });
  it("lets people cancel their own bookings and the council any", () => {
    expect(canCancel(resident, { residentId: 1 })).toBe(true);
    expect(canCancel(other, { residentId: 1 })).toBe(false);
    expect(canCancel(council, { residentId: 1 })).toBe(true);
    expect(canCancel(head, { residentId: 1 })).toBe(true);
    expect(canCancel(squad, { residentId: 1 })).toBe(false);
  });
  it("lets only the owner free a machine early", () => {
    expect(canRelease(resident, { residentId: 1 })).toBe(true);
    expect(canRelease(council, { residentId: 1 })).toBe(false);
  });
  it("lets the council block residents but not each other", () => {
    expect(canBlock(council, other)).toBe(true);
    expect(canBlock(council, squad)).toBe(true);
    expect(canBlock(council, council)).toBe(false);
    expect(canBlock(council, head)).toBe(false);
    expect(canBlock(head, { id: 4, roles: ["council"] })).toBe(false);
    expect(canBlock(resident, other)).toBe(false);
    expect(canBlock(manager, other)).toBe(false);
  });
  it("leaves roles to the site manager", () => {
    expect(canManageRoles(manager)).toBe(true);
    expect(canManageRoles(head)).toBe(false);
    expect(canManageRoles(resident)).toBe(false);
  });
  it("never lets the site manager drop their own site-manager role", () => {
    expect(
      canRevokeRole(manager, { email: "x@lpnu.ua", role: "council" }),
    ).toBe(true);
    expect(
      canRevokeRole(manager, { email: "x@lpnu.ua", role: "site_manager" }),
    ).toBe(true);
    expect(
      canRevokeRole(manager, { email: "Anton@lpnu.ua", role: "site_manager" }),
    ).toBe(false);
    expect(
      canRevokeRole(manager, { email: "anton@lpnu.ua", role: "council" }),
    ).toBe(true);
    expect(
      canRevokeRole(
        { ...head, email: "h@lpnu.ua" },
        { email: "x@lpnu.ua", role: "council" },
      ),
    ).toBe(false);
  });
});
