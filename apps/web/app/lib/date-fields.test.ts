import { describe, expect, it } from "vitest";

import { readDate, readTime } from "./date-fields";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("date and time selects", () => {
  it("reads a full date and nothing as nothing", () => {
    expect(
      readDate(form({ d_d: "4", d_m: "11", d_y: "2026" }), "d").value,
    ).toBe("2026-11-04");
    expect(readDate(form({}), "d")).toEqual({ value: null });
  });
  it("asks for the whole date", () => {
    expect(readDate(form({ d_d: "4" }), "d").error).toBeTruthy();
  });
  it("reads time as minutes from midnight", () => {
    expect(readTime(form({ t_h: "9", t_min: "35" }), "t").value).toBe(575);
    expect(readTime(form({ t_h: "24", t_min: "0" }), "t").error).toBeTruthy();
    expect(readTime(form({ t_h: "9" }), "t").error).toBeTruthy();
  });
});
