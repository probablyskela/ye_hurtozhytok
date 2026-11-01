import MarkdownIt from "markdown-it";

/**
 * Announcement details are stored as Markdown, written in the visual editor
 * (or by hand without JavaScript). Only what the editor offers is turned
 * into markup: bold, italic, lists, links and subheadings. HTML typed by
 * people stays text, and links go only to web pages, mail or phone numbers.
 */
const md = new MarkdownIt("zero", {
  html: false,
  linkify: true,
  breaks: true,
}).enable([
  "heading",
  "list",
  "emphasis",
  "link",
  "autolink",
  "linkify",
  "newline",
  "escape",
  "entity",
]);

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:)/i;
md.validateLink = (url) => SAFE_LINK.test(url.trim());

// Every heading is a subheading: the page title is the only h1.
md.core.ruler.push("subheadings", (state) => {
  for (const t of state.tokens)
    if (t.type === "heading_open" || t.type === "heading_close") t.tag = "h2";
});

md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet("target", "_blank");
  tokens[idx].attrSet("rel", "noopener noreferrer nofollow");
  return self.renderToken(tokens, idx, options);
};

/** Safe HTML for the announcement page. */
export function renderMarkdown(text: string): string {
  return md.render(text);
}

const EXCERPT_MAX = 240;

/** Plain text for cards: no markup, blocks joined by spaces, cut short. */
export function markdownExcerpt(text: string): string {
  const words: string[] = [];
  for (const t of md.parse(text, {})) {
    if (t.type !== "inline") continue;
    for (const c of t.children ?? [])
      if (c.type === "text") words.push(c.content);
      else if (c.type === "softbreak" || c.type === "hardbreak")
        words.push(" ");
    // Each block ends with a space so paragraphs do not run together.
    words.push(" ");
  }
  const plain = words.join("").replace(/\s+/g, " ").trim();
  return plain.length > EXCERPT_MAX
    ? plain.slice(0, EXCERPT_MAX - 1).trimEnd() + "…"
    : plain;
}
