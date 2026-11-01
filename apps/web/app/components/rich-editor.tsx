import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef, useState } from "react";

/** Same rule as the server: links only to web pages, mail or phone. */
const SAFE_LINK = /^(https?:\/\/|mailto:|tel:)/i;

function normalizeLink(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (SAFE_LINK.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  return `https://${url.replace(/^\/+/, "")}`;
}

const NOTHING_ACTIVE = {
  bold: false,
  italic: false,
  heading: false,
  bullet: false,
  ordered: false,
  link: false,
};

/**
 * The visual editor for announcement details. It writes Markdown into a
 * hidden field with the same name, so the form posts exactly what the
 * plain text field would. Loaded only after the page is interactive.
 */
export default function RichEditor({
  id,
  name,
  defaultValue,
  maxLength,
  label,
  describedBy,
}: {
  id: string;
  name: string;
  defaultValue: string;
  maxLength: number;
  label: string;
  describedBy?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [linking, setLinking] = useState<string | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        heading: { levels: [2] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url) => SAFE_LINK.test(url),
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer nofollow",
          },
        },
      }),
      Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
    ],
    content: defaultValue,
    contentType: "markdown",
    editorProps: {
      attributes: {
        id,
        class: "rich rich-input",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      },
    },
    onUpdate: ({ editor }) => setValue(editor.getMarkdown()),
  });

  const state =
    useEditorState({
      editor,
      selector: ({ editor: e }) =>
        e
          ? {
              bold: e.isActive("bold"),
              italic: e.isActive("italic"),
              heading: e.isActive("heading", { level: 2 }),
              bullet: e.isActive("bulletList"),
              ordered: e.isActive("orderedList"),
              link: e.isActive("link"),
            }
          : null,
    }) ?? NOTHING_ACTIVE;

  if (!editor)
    return (
      <textarea
        id={id}
        name={name}
        className="area"
        rows={5}
        defaultValue={defaultValue}
        maxLength={maxLength}
      />
    );

  const chain = () => editor.chain().focus();

  function openLink() {
    if (!editor) return;
    setLinking(editor.getAttributes("link").href ?? "");
    requestAnimationFrame(() => linkInput.current?.focus());
  }

  function applyLink() {
    if (!editor || linking === null) return;
    const href = normalizeLink(linking);
    setLinking(null);
    if (!href) {
      chain().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("link"))
      chain()
        .insertContent({
          type: "text",
          text: linking.trim(),
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    else chain().extendMarkRange("link").setLink({ href }).run();
  }

  const left = maxLength - value.length;
  const tools: {
    key: string;
    label: string;
    on: boolean;
    run: () => void;
    glyph: React.ReactNode;
  }[] = [
    {
      key: "bold",
      label: "Жирний",
      on: state.bold,
      run: () => chain().toggleBold().run(),
      glyph: <b>Ж</b>,
    },
    {
      key: "italic",
      label: "Курсив",
      on: state.italic,
      run: () => chain().toggleItalic().run(),
      glyph: <i>К</i>,
    },
    {
      key: "heading",
      label: "Підзаголовок",
      on: state.heading,
      run: () => chain().toggleHeading({ level: 2 }).run(),
      glyph: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 5v14M17 5v14M7 12h10" />
        </svg>
      ),
    },
    {
      key: "bullet",
      label: "Список",
      on: state.bullet,
      run: () => chain().toggleBulletList().run(),
      glyph: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="7" r="1.3" className="dot" />
          <circle cx="5" cy="12" r="1.3" className="dot" />
          <circle cx="5" cy="17" r="1.3" className="dot" />
          <path d="M9.5 7H20M9.5 12H20M9.5 17H20" />
        </svg>
      ),
    },
    {
      key: "ordered",
      label: "Нумерований список",
      on: state.ordered,
      run: () => chain().toggleOrderedList().run(),
      glyph: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.5 5.5 4.5V9.5M4 14.5c.4-.8 2.8-.9 2.6.6-.1.9-2.6 2.2-2.6 3.4h2.8M10 7h10M10 12h10M10 17h10" />
        </svg>
      ),
    },
    {
      key: "link",
      label: "Посилання",
      on: state.link || linking !== null,
      run: () => (linking === null ? openLink() : setLinking(null)),
      glyph: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
      ),
    },
  ];

  return (
    <div className="rich-field">
      <div className="rich-tools" role="toolbar" aria-label="Оформлення">
        {tools.map((t) => (
          <button
            key={t.key}
            type="button"
            className="rich-tool"
            aria-label={t.label}
            title={t.label}
            aria-pressed={t.on}
            // Keep the text selection in the editor while tapping a tool.
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.run}
          >
            {t.glyph}
          </button>
        ))}
      </div>
      {linking !== null && (
        <div className="rich-link">
          <input
            ref={linkInput}
            type="url"
            inputMode="url"
            aria-label="Адреса посилання"
            placeholder="https://…"
            value={linking}
            onChange={(e) => setLinking(e.target.value)}
            onKeyDown={(e) => {
              // Enter applies the link instead of sending the whole form.
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setLinking(null);
                editor.commands.focus();
              }
            }}
          />
          <button type="button" className="rich-link-ok" onClick={applyLink}>
            {linking.trim() ? "Готово" : "Прибрати"}
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={value} />
      {left < maxLength * 0.2 && (
        <small className={left < 0 ? "rich-count over" : "rich-count"}>
          {left < 0
            ? `Задовго на ${-left} символів`
            : `Лишилося ${left} символів`}
        </small>
      )}
    </div>
  );
}
