import { describe, expect, it } from "vitest";

import { readDate, readTime } from "./date-fields";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("date and time pickers", () => {
  it("reads a date and nothing as nothing", () => {
    expect(readDate(form({ d: "2026-11-04" }), "d").value).toBe("2026-11-04");
    expect(readDate(form({ d: "" }), "d")).toEqual({ value: null });
    expect(readDate(form({}), "d")).toEqual({ value: null });
  });
  it("refuses dates that do not exist", () => {
    expect(readDate(form({ d: "2027-02-31" }), "d").error).toBeTruthy();
    expect(readDate(form({ d: "4.11.2026" }), "d").error).toBeTruthy();
  });
  it("reads time as minutes on the 5-minute grid", () => {
    expect(readTime(form({ t: "575" }), "t").value).toBe(575);
    expect(readTime(form({ t: "" }), "t")).toEqual({ value: null });
    expect(readTime(form({ t: "1440" }), "t").error).toBeTruthy();
    expect(readTime(form({ t: "577" }), "t").error).toBeTruthy();
  });
});
