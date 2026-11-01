import { describe, expect, it } from "vitest";

import { markdownExcerpt, renderMarkdown } from "./markdown.server";

describe("announcement details", () => {
  it("shows what the editor offers", () => {
    const html = renderMarkdown(
      "## Збори\n\nПриходьте в **четвер**, *о 19:00*:\n\n- пропуск\n- ручка\n\n1. перше\n2. друге",
    );
    expect(html).toContain("<h2>Збори</h2>");
    expect(html).toContain("<strong>четвер</strong>");
    expect(html).toContain("<em>о 19:00</em>");
    expect(html).toContain("<ul>\n<li>пропуск</li>");
    expect(html).toContain("<ol>\n<li>перше</li>");
  });

  it("keeps plain text as it was typed, line by line", () => {
    expect(renderMarkdown("Перший рядок\nДругий")).toBe(
      "<p>Перший рядок<br>\nДругий</p>\n",
    );
  });

  it("makes every heading a subheading", () => {
    expect(renderMarkdown("# Велике")).toBe("<h2>Велике</h2>\n");
  });

  it("opens links in a new tab, written or bare", () => {
    expect(renderMarkdown("[форма](https://forms.gle/x)")).toContain(
      '<a href="https://forms.gle/x" target="_blank" rel="noopener noreferrer nofollow">форма</a>',
    );
    expect(renderMarkdown("Деталі: https://lpnu.ua/news")).toContain(
      '<a href="https://lpnu.ua/news" target="_blank"',
    );
  });

  it("never lets HTML or scripts through", () => {
    const html = renderMarkdown(
      "<img src=x onerror=alert(1)> <script>alert(1)</script> [x](javascript:alert(1)) [y](data:text/html,hi) [z](//evil.example)",
    );
    expect(html).not.toMatch(
      /<img|<script|href="javascript|href="data|href="\/\//,
    );
    expect(html).toContain("&lt;script&gt;");
  });

  it("leaves out what the editor does not offer", () => {
    const html = renderMarkdown(
      "> цитата\n\n```\nкод\n```\n\n![картинка](https://x.y/a.png)\n\n---\n\n| a |\n|---|",
    );
    expect(html).not.toMatch(/<blockquote|<pre|<code|<img|<hr|<table/);
  });
});

describe("card excerpt", () => {
  it("is plain text without markup", () => {
    expect(
      markdownExcerpt(
        "## Збори\n\nУ **четвер**\nо 19:00\n\n- [форма](https://x.y)",
      ),
    ).toBe("Збори У четвер о 19:00 форма");
  });

  it("is cut short with an ellipsis", () => {
    const out = markdownExcerpt("слово ".repeat(100));
    expect(out.length).toBeLessThanOrEqual(240);
    expect(out.endsWith("…")).toBe(true);
  });
});
