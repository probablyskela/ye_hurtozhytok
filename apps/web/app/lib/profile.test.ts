import { describe, expect, it } from "vitest";

import { initials, normalizeRoom, normalizeTelegram } from "./profile";

describe("profile fields", () => {
  it("accepts three-digit rooms only", () => {
    expect(normalizeRoom(" 612 ")).toBe("612");
    expect(normalizeRoom("61")).toBeNull();
    expect(normalizeRoom("6a2")).toBeNull();
  });
  it("cleans Telegram usernames", () => {
    expect(normalizeTelegram("@olena_hr")).toBe("olena_hr");
    expect(normalizeTelegram("https://t.me/olena_hr")).toBe("olena_hr");
    expect(normalizeTelegram("")).toBe("");
    expect(normalizeTelegram("abc")).toBeNull();
    expect(normalizeTelegram("олена")).toBeNull();
  });
  it("takes two initials", () => {
    expect(initials("Олена Гриценко")).toBe("ОГ");
    expect(initials("Anton")).toBe("A");
  });
});
