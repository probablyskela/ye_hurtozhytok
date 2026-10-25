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

describe("vocative", () => {
  it("declines common Ukrainian first names", async () => {
    const { vocative } = await import("./profile");
    expect(vocative("Олена")).toBe("Олено");
    expect(vocative("Ірина")).toBe("Ірино");
    expect(vocative("Софія")).toBe("Софіє");
    expect(vocative("Остап")).toBe("Остапе");
    expect(vocative("Андрій")).toBe("Андрію");
    expect(vocative("Дмитро")).toBe("Дмитре");
    expect(vocative("Марко")).toBe("Марку");
    expect(vocative("Василь")).toBe("Василю");
    expect(vocative("Микола")).toBe("Миколо");
  });
  it("keeps Latin names and gives up when unsure", async () => {
    const { vocative } = await import("./profile");
    expect(vocative("Anton")).toBe("Anton");
    expect(vocative("Олег")).toBeNull();
    expect(vocative("Оля")).toBeNull();
  });
});
