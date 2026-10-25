import { describe, expect, it } from "vitest";

import { canBlock, canBook, canCancel, canRelease } from "./permissions";

const resident = { id: 1, role: "resident" as const, room: "612" };
const other = { id: 2, role: "resident" as const, room: "608" };
const council = { id: 3, role: "council" as const, room: "601" };

describe("permissions", () => {
  it("needs a room and no block to book", () => {
    expect(canBook(resident)).toBe(true);
    expect(canBook({ ...resident, room: null })).toBe(false);
    expect(canBook({ ...resident, blocked: true })).toBe(false);
  });
  it("lets people cancel their own bookings and the council any", () => {
    expect(canCancel(resident, { residentId: 1 })).toBe(true);
    expect(canCancel(other, { residentId: 1 })).toBe(false);
    expect(canCancel(council, { residentId: 1 })).toBe(true);
  });
  it("lets only the owner free a machine early", () => {
    expect(canRelease(resident, { residentId: 1 })).toBe(true);
    expect(canRelease(council, { residentId: 1 })).toBe(false);
  });
  it("lets the council block residents but not each other", () => {
    expect(canBlock(council, other)).toBe(true);
    expect(canBlock(council, council)).toBe(false);
    expect(canBlock(council, { id: 4, role: "council" })).toBe(false);
    expect(canBlock(resident, other)).toBe(false);
  });
});
