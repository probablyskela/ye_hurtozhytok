import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router";

import { mediaUrl } from "~/components/announcement";

type Image = { id: number; key: string };

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** "#photo-3" → 2; anything else → null. */
function photoFromHash(hash: string, count: number): number | null {
  const m = /^#photo-(\d+)$/.exec(hash);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= count ? n - 1 : null;
}

/**
 * Pictures of an announcement, and a full-screen viewer inside the app
 * instead of a new window (which strands people in an installed PWA).
 * A picture is "#photo-N", so Android's back closes the viewer and nothing
 * is fetched. Without JavaScript the same viewer opens through :target.
 */
export function Gallery({ images }: { images: Image[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [live, setLive] = useState(false);
  // The server never sees the hash: decide only once the page is live.
  const open = live ? photoFromHash(location.hash, images.length) : null;
  const [current, setCurrent] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLAnchorElement>(null);
  useEffect(() => setLive(true), []);

  function close() {
    // Opened here: step back, so «Назад» does not reopen it later.
    if ((location.state as { photo?: boolean } | null)?.photo) navigate(-1);
    else
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, preventScrollReset: true },
      );
  }

  function go(to: number) {
    const el = track.current;
    if (!el) return;
    const i = Math.max(0, Math.min(images.length - 1, to));
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  // Show the chosen picture at once, keep the page still underneath.
  useIsoLayoutEffect(() => {
    if (open === null) return;
    const el = track.current;
    if (el) el.scrollLeft = open * el.clientWidth;
    setCurrent(open);
    const root = document.documentElement;
    root.classList.add("viewer-open");
    closeBtn.current?.focus({ preventScroll: true });
    return () => root.classList.remove("viewer-open");
  }, [open]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(current + 1);
      else if (e.key === "ArrowLeft") go(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (images.length === 0) return null;
  const many = images.length > 1;

  // Above everything once live (the page is its own layer under the menu);
  // in place without JavaScript, where :target opens it.
  const viewer = (
    <div
      className={`viewer${live ? " live" : ""}${open !== null ? " open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Картинка ${current + 1} з ${images.length}`}
      hidden={live && open === null}
    >
      <div className="viewer-bar">
        {many && (
          <span className="viewer-count" aria-hidden="true">
            {current + 1} / {images.length}
          </span>
        )}
        <Link
          ref={closeBtn}
          className="viewer-close"
          to="#gallery"
          replace
          preventScrollReset
          aria-label="Закрити"
          onClick={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Link>
      </div>
      <div
        className="viewer-track"
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setCurrent(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {images.map((img, i) => (
          <figure
            key={img.id}
            id={`photo-${i + 1}`}
            className="viewer-slide"
            // A tap beside the picture closes it, like on the phone's photos.
            onClick={(e) => e.target === e.currentTarget && close()}
          >
            <img
              src={mediaUrl(img.key)}
              alt={`Картинка ${i + 1} з ${images.length}`}
              loading="lazy"
              decoding="async"
            />
          </figure>
        ))}
      </div>
      {many && live && (
        <div className="viewer-nav">
          <button
            type="button"
            aria-label="Попередня"
            disabled={current === 0}
            onClick={() => go(current - 1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14.5 5.5 8 12l6.5 6.5" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Наступна"
            disabled={current === images.length - 1}
            onClick={() => go(current + 1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9.5 5.5 16 12l-6.5 6.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        className="gallery"
        id="gallery"
        role="group"
        aria-label={`Картинки: ${images.length}`}
      >
        {images.map((img, i) => (
          <Link
            key={img.id}
            to={`#photo-${i + 1}`}
            state={{ photo: true }}
            preventScrollReset
            aria-label={`Відкрити картинку ${i + 1} з ${images.length}`}
          >
            <img
              src={mediaUrl(img.key)}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </Link>
        ))}
      </div>

      {live ? createPortal(viewer, document.body) : viewer}
    </>
  );
}
