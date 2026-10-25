import { describe, expect, it } from "vitest";

import { fullName, parseName, shortName } from "./names";

describe("parseName", () => {
  it("splits the university's «Прізвище Імʼя По батькові»", () => {
    const p = parseName({ name: "Полупан Софія Андріївна" });
    expect(p).toEqual({
      lastName: "Полупан",
      firstName: "Софія",
      patronymic: "Андріївна",
    });
    expect(shortName(p)).toBe("Софія Полупан");
    expect(fullName(p)).toBe("Полупан Софія Андріївна");
    expect(parseName({ name: "Михальчук Антон Євгенійович" }).firstName).toBe(
      "Антон",
    );
  });
  it("uses Google's given and family names when the full name has no patronymic", () => {
    expect(
      parseName({
        name: "Софія Андріївна Полупан",
        givenName: "Софія Андріївна",
        familyName: "Полупан",
      }),
    ).toEqual({
      firstName: "Софія",
      lastName: "Полупан",
      patronymic: "Андріївна",
    });
  });
  it("reads «Імʼя Прізвище» and single names", () => {
    expect(parseName({ name: "Олена Гриценко" })).toEqual({
      firstName: "Олена",
      lastName: "Гриценко",
      patronymic: null,
    });
    expect(parseName({ name: "Олена" }).lastName).toBe("");
  });
  it("falls back to the email address", () => {
    expect(parseName({ email: "anton.mykhalchuk.shi.2024@lpnu.ua" })).toEqual({
      firstName: "Anton",
      lastName: "Mykhalchuk",
      patronymic: null,
    });
  });
});
