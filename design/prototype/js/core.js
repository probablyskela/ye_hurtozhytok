/*
 * One phone = one copy of this runtime inside an iframe (or full screen when
 * app.html is opened on its own). It renders the real app's markup and
 * classes, so the compiled app.css styles it exactly like the live app.
 *
 * Screen modules register routes:
 *   App.route("/board/task/:id", (ctx) => html, { tab: "board" })
 * and handlers:
 *   App.act("name", (el, ctx, event) => {...})    // <button data-act="name">
 *   App.form("name", (data, ctx, form) => {...})  // <form data-form="name">
 * ctx = { me, EH, S, params, query, path, go(path), back(), can }
 */
(function () {
  const EH = (() => {
    try {
      if (window.top !== window && window.top.EH) return window.top.EH;
    } catch (e) {
      /* standalone */
    }
    return window.EH;
  })();
  const S = EH.state;
  const qs = new URLSearchParams(location.search);
  const meId = qs.get("who") || "olena";
  const me = () => EH.person(meId);

  const routes = [];
  const acts = {};
  const forms = {};
  let history = [];

  // ---------- small helpers screens use ----------
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const icon = (name, small) =>
    `<svg class="ico${small ? " sm" : ""}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const pad = (n) => String(n).padStart(2, "0");
  const time = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const day = (date) => EH.DAYS.find((d) => d.date === date);
  const dayLong = (date) => day(date)?.long || date;
  const dayShort = (date) => {
    const d = day(date);
    if (!d) return date;
    return d.label ? d.label.toLowerCase() : `${d.wd.toLowerCase()}, ${d.d}`;
  };
  const plural = (n, one, few, many) => {
    const a = n % 10,
      b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  };
  // the live app's countdown() from the shared demo clock:
  // «зараз», «через 5 хв», «через 4 год 20 хв», «через 1 день», «через 2 дні»
  const countdown = (date, m) => {
    const dayIdx = EH.DAYS.findIndex((d) => d.date === date);
    const mins = dayIdx * 1440 + m - EH.nowMin();
    if (mins <= 0) return "зараз";
    if (mins < 60) return `через ${mins} хв`;
    const h = Math.floor(mins / 60),
      r = mins % 60;
    if (h >= 24) {
      const d = Math.floor(h / 24);
      return `через ${d} ${plural(d, "день", "дні", "днів")}`;
    }
    return r ? `через ${h} год ${r} хв` : `через ${h} год`;
  };
  const until = countdown;

  // laundry rules (lib/booking.ts): 06:00–24:00, 5-minute steps, 5 minutes between bookings
  const LAUNDRY = { OPEN: 360, CLOSE: 1440, STEP: 5, BUF: 5, DEF_LEN: 120 };
  const ceil5 = (m) => Math.ceil(m / LAUNDRY.STEP) * LAUNDRY.STEP;
  const clashes = (s, e, slots) =>
    slots.some((b) => s < b.e + LAUNDRY.BUF && e + LAUNDRY.BUF > b.s);
  const slotsOn = (mId, date) =>
    S.bookings
      .filter(
        (b) => b.status === "active" && b.machine === mId && b.date === date,
      )
      .sort((a, b) => a.s - b.s);
  function freeStarts(slots, len, nowMin) {
    const from = Math.max(LAUNDRY.OPEN, nowMin == null ? 0 : ceil5(nowMin));
    const out = [];
    for (let s = from; s + len <= LAUNDRY.CLOSE; s += LAUNDRY.STEP)
      if (!clashes(s, s + len, slots)) out.push(s);
    return out;
  }
  // Nearest free time for a booking of `len`: the first start on each machine,
  // soonest first, today; if nothing is left today, tomorrow. [{ m, date, s }]
  function nearestFree(len = LAUNDRY.DEF_LEN) {
    const per = (date, nowMin) =>
      S.machines
        .map((m) => ({
          m,
          date,
          s: freeStarts(slotsOn(m.id, date), len, nowMin)[0],
        }))
        .filter((x) => x.s !== undefined)
        .sort((a, b) => a.s - b.s);
    const today = per(EH.TODAY, EH.nowMin());
    return today.length ? today : per(EH.DAYS[1].date, null);
  }

  // One title for a complaint on every screen: the task title once there is a
  // task, otherwise «Тема: місце» (or the topic alone).
  function complaintTitle(c) {
    const task = c.taskId && S.tasks.find((x) => x.id === c.taskId);
    if (task) return task.title;
    const t = EH.TOPICS.find((x) => x.id === c.topic);
    const label = t ? t.label : "Звернення";
    return c.place
      ? `${label}: ${c.place.charAt(0).toLowerCase()}${c.place.slice(1)}`
      : label;
  }

  function topbar({ back, title, right } = {}) {
    return `<div class="topbar">${back ? `<a class="icon-btn" href="#${esc(back)}" aria-label="Назад">${icon("back")}</a>` : brand()}${title ? `<h1 class="bar-title">${esc(title)}</h1>` : ""}${right ?? (back ? `<span style="width:44px"></span>` : avatar())}</div>`;
  }
  function brand() {
    return `<a class="brand" href="#/" aria-label="єГуртожиток, головна"><svg class="mark" aria-hidden="true"><use href="#logo-facade"/></svg><span class="wordmark">єГуртожиток</span></a>`;
  }
  function avatar() {
    const p = me();
    return `<a class="avatar" aria-label="Моє: ${esc(p.name)}" style="text-decoration:none" href="#/me">${esc(p.initials)}</a>`;
  }

  // status pill: complaints sent | review | work | resolved | rejected, tasks new | in_progress | done
  // (words from the store, so screens, notifications and system lines say the same)
  const CS = EH.COMPLAINT_STATUS,
    TS = EH.TASK_STATUS;
  const STATUS = {
    sent: ["", CS.sent],
    review: ["review", CS.review],
    work: ["work", CS.work],
    resolved: ["done", CS.resolved],
    rejected: ["no", CS.rejected],
    new: ["", TS.new],
    in_progress: ["work", TS.in_progress],
    done: ["done", TS.done],
  };
  function status(kind, label) {
    const [cls, text] = STATUS[kind] || ["", kind];
    return `<span class="st ${cls}">${cls === "done" ? icon("check") : ""}${esc(label || text)}</span>`;
  }
  // steps: [{label, small, state: "on" | "cur" | ""}]
  function track(steps, aria) {
    return `<ol class="track" aria-label="${esc(aria || "Хід")}">${steps.map((s) => `<li class="${s.state || ""}"${s.state === "cur" ? ' aria-current="step"' : ""}><span class="n"></span>${esc(s.label)}<small>${s.small ? esc(s.small) : "&nbsp;"}</small></li>`).join("")}</ol>`;
  }
  // a real-app segmented control with the sliding pill: items [{href, label, on, count}]
  function seg(items, aria, extra = "", cls = "") {
    return `<nav class="seg${cls ? ` ${cls}` : ""}" data-pill aria-label="${esc(aria)}" style="grid-auto-columns:1fr" ${extra}><span class="pill" aria-hidden="true"></span>${items.map((i) => `<a data-pill-item="true" href="#${esc(i.href)}"${i.on ? ' aria-current="true"' : ""}>${esc(i.label)}${i.count != null ? `<b class="seg-count">${i.count}</b>` : ""}</a>`).join("")}</nav>`;
  }
  // One count rule for roles on every screen (Головна, Моє, /admin/roles):
  // people holding a role of the group plus emails still waiting for the first sign-in.
  const roleCount = (group) => {
    const inGroup = (roles) => roles.some((r) => EH.ROLES[r]?.group === group);
    return (
      S.people.filter((p) => inGroup(p.roles)).length +
      (S.pendingRoles || []).filter((x) => inGroup(x.roles)).length
    );
  };
  const rolesSummary = () =>
    `студрада: ${roleCount("council")} · оперзагін: ${roleCount("squad")}`;
  const roleChips = (p) =>
    p.roles
      .map((r) => `<span class="role-chip">${esc(EH.ROLES[r].label)}</span>`)
      .join("");

  // ---------- routing ----------
  function route(pattern, render, opts = {}) {
    const keys = [];
    const re = new RegExp(
      "^" +
        pattern.replace(/:[a-z]+/g, (k) => {
          keys.push(k.slice(1));
          return "([^/]+)";
        }) +
        "/?$",
    );
    routes.push({ pattern, re, keys, render, opts });
  }
  // the full route with its query, so «back» returns to the same tab or filter
  const here = () => location.hash.replace(/^#/, "") || "/";
  function parse() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, q] = raw.split("?");
    return { path, query: Object.fromEntries(new URLSearchParams(q || "")) };
  }
  function go(path, { replace } = {}) {
    if (replace) location.replace("#" + path);
    else location.hash = path;
  }
  function back(fallback = "/") {
    if (history.length > 1) {
      history.pop();
      go(history.pop() || fallback);
    } else go(fallback);
  }

  // ---------- rendering ----------
  const root = document.getElementById("app");
  let current = null;

  function tabbar(active) {
    const badge = meBadge();
    const t = (id, href, ic, label, b) =>
      `<a class="tab" href="#${href}"${active === id ? ' aria-current="page"' : ""}><span class="tab-ico${b ? " has-badge" : ""}">${icon(ic)}</span>${label}${b ? '<span class="sr-only">, є нове</span>' : ""}</a>`;
    return `<nav class="tabbar four" aria-label="Розділи">${t("home", "/", "home", "Головна")}${t("laundry", "/laundry", "washer", "Пральня")}${t("board", "/board", "board", "Дошка")}${t("me", "/me", "user", "Моє", badge)}</nav>`;
  }
  function meBadge() {
    const p = me();
    const mineUnread = S.complaints.some(
      (c) => (c.author === p.id || c.anonOwner === p.id) && c.unread[p.id],
    );
    const inbox = S.complaints.some(
      (c) => c.unread[c.to] && EH.can.handleComplaint(p, c),
    );
    return mineUnread || inbox;
  }

  function render() {
    const { path, query } = parse();
    let match = null,
      params = {};
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) {
        match = r;
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        break;
      }
    }
    if (!match) {
      go("/", { replace: true });
      return;
    }
    const ctx = makeCtx(path, query, params);
    let out;
    try {
      out = match.render(ctx);
    } catch (e) {
      console.error(e);
      out = `<div class="glass empty"><b>Помилка в прототипі</b>${esc(e.message)}</div>`;
    }
    const html = typeof out === "string" ? out : out.html;
    const sheet = typeof out === "object" && out.sheet;
    const opts = match.opts;
    root.innerHTML = `<div class="field" aria-hidden="true"></div><main class="page${opts.wide ? " wide" : ""}${sheet ? " with-sheet" : ""}">${html}</main>${sheet ? sheet : opts.bare ? "" : tabbar(opts.tab)}`;
    current = { match, ctx };
    oneHeading(opts.title);
    mountPills();
    match.opts.mount?.(root, ctx);
    document.title = `${match.opts.title || "єГуртожиток"} · ${me().first}`;
  }

  // exactly one h1 per screen: the screen's own title, else the top bar's title,
  // else the big h2.title promoted, else a hidden one with the screen's name
  function retag(el, tag) {
    const n = document.createElement(tag);
    for (const a of el.attributes) n.setAttribute(a.name, a.value);
    n.append(...el.childNodes);
    el.replaceWith(n);
    return n;
  }
  function oneHeading(title) {
    const main = root.querySelector("main");
    const h1s = [...main.querySelectorAll("h1")];
    if (h1s.length > 1) {
      const keep =
        h1s.find((h) => !h.classList.contains("bar-title")) || h1s[0];
      h1s.forEach((h) => {
        if (h !== keep)
          retag(h, h.classList.contains("bar-title") ? "span" : "h2");
      });
    }
    if (main.querySelector("h1")) return;
    const big = main.querySelector("h2.title");
    if (big) {
      retag(big, "h1");
      return;
    }
    const h = document.createElement("h1");
    h.className = "sr-only";
    h.textContent = title || "єГуртожиток";
    main.prepend(h);
  }

  function makeCtx(path, query, params) {
    return {
      me: me(),
      EH,
      S,
      params,
      query,
      path,
      go,
      back,
      can: EH.can,
      esc,
      icon,
      time,
    };
  }

  // keep typing, scroll and focus when someone else changes the shared data
  const FIELDS = "input[name], textarea[name], select[name]";
  const fieldKey = (el) =>
    `${el.form?.dataset.form || el.form?.id || ""}|${el.name}${el.type === "radio" || el.type === "checkbox" ? `=${el.value}` : ""}`;
  function rerender() {
    const scroll = window.scrollY;
    const values = {};
    root.querySelectorAll(FIELDS).forEach((el) => {
      // hidden fields belong to the page as drawn, unless a screen keeps one as a draft (data-keep)
      if (el.type === "hidden" && !el.hasAttribute("data-keep")) return;
      values[fieldKey(el)] =
        el.type === "radio" || el.type === "checkbox" ? el.checked : el.value;
    });
    const a = document.activeElement;
    const focused =
      a && root.contains(a) && a.matches(FIELDS) && a.type !== "hidden"
        ? {
            key: fieldKey(a),
            sel:
              typeof a.selectionStart === "number"
                ? [a.selectionStart, a.selectionEnd]
                : null,
          }
        : null;
    render();
    root.querySelectorAll(FIELDS).forEach((el) => {
      const k = fieldKey(el);
      if (!(k in values)) return;
      if (el.type === "radio" || el.type === "checkbox") el.checked = values[k];
      else el.value = values[k];
    });
    if (focused) {
      const el = [...root.querySelectorAll(FIELDS)].find(
        (x) => fieldKey(x) === focused.key,
      );
      if (el) {
        el.focus({ preventScroll: true });
        if (focused.sel)
          try {
            el.setSelectionRange(...focused.sel);
          } catch (e) {
            /* not a text field */
          }
      }
    }
    window.scrollTo(0, scroll);
  }

  /**
   * components/pill-group.tsx: one pill slides to the chosen item of a
   * segmented control (.seg[data-pill]), the day list (.days) or the machine
   * list (.machine-pick). The page is drawn anew on every tap, so on the same
   * screen the pill starts where it stood and glides to the new item, and a
   * sideways list keeps its scroll with the chosen item in view.
   */
  let pillWas = {};
  let pillPath = null;
  function mountPills(scope = root) {
    const path = parse().path;
    if (path !== pillPath) {
      pillWas = {};
      pillPath = path;
    }
    scope
      .querySelectorAll(
        ".seg[data-pill], nav.days[data-lpill], nav.machine-pick[data-lpill]",
      )
      .forEach((nav, idx) => {
        const pill = nav.querySelector(":scope > .pill");
        const items = [...nav.querySelectorAll(":scope > [data-pill-item]")];
        const on =
          items.find((i) => i.getAttribute("aria-current") === "true") ||
          (nav.matches(".seg") ? items[0] : null);
        if (!pill || !on) return;
        const key = `${nav.getAttribute("aria-label") || ""}#${idx}`;
        const was = pillWas[key];
        if (was) nav.scrollLeft = was.scroll;
        if (nav.scrollWidth > nav.clientWidth) {
          if (on.offsetLeft + on.offsetWidth > nav.scrollLeft + nav.clientWidth)
            nav.scrollLeft =
              on.offsetLeft + on.offsetWidth - nav.clientWidth + 16;
          else if (on.offsetLeft < nav.scrollLeft)
            nav.scrollLeft = Math.max(0, on.offsetLeft - 16);
        }
        nav.classList.add("has-pill");
        items.forEach((i) => i.toggleAttribute("data-pill-on", i === on));
        const box = {
          w: on.offsetWidth,
          h: on.offsetHeight,
          x: on.offsetLeft,
          y: on.offsetTop,
        };
        const put = (b) => {
          pill.style.width = `${b.w}px`;
          pill.style.height = `${b.h}px`;
          pill.style.transform = `translate(${b.x}px, ${b.y}px)`;
        };
        const remember = () =>
          (pillWas[key] = { ...box, scroll: nav.scrollLeft });
        remember();
        nav.addEventListener("scroll", remember, { passive: true });
        if (!was || (was.x === box.x && was.w === box.w && was.y === box.y)) {
          put(box);
          requestAnimationFrame(() => pill.classList.add("pill-ready"));
          return;
        }
        put(was);
        requestAnimationFrame(() => {
          pill.classList.add("pill-ready");
          requestAnimationFrame(() => put(box));
        });
      });
  }

  // a wider or narrower screen (rotation, resized window) moves the tabs, so the
  // pills follow them at once; only the pills move, typed text stays untouched
  let pillTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(pillTimer);
    pillTimer = setTimeout(() => {
      root.querySelectorAll(".has-pill").forEach((nav) => {
        const pill = nav.querySelector(":scope > .pill");
        const on = nav.querySelector(":scope > [data-pill-on]");
        if (!pill || !on) return;
        pill.classList.remove("pill-ready");
        pill.style.width = `${on.offsetWidth}px`;
        pill.style.height = `${on.offsetHeight}px`;
        pill.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
        requestAnimationFrame(() => pill.classList.add("pill-ready"));
      });
    }, 60);
  });

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (el && acts[el.dataset.act]) {
      e.preventDefault();
      acts[el.dataset.act](el, current.ctx, e);
      return;
    }
    const note = e.target.closest("[data-note]");
    if (note) {
      const n = note.dataset;
      EH.actions.dismissNote(meId, Number(n.note));
      note.remove();
      if (n.href) go(n.href);
    }
  });
  document.addEventListener("submit", (e) => {
    const f = e.target.closest("form[data-form]");
    if (!f) return;
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    if (e.submitter?.name) data[e.submitter.name] = e.submitter.value;
    forms[f.dataset.form]?.(data, current.ctx, f);
  });
  window.addEventListener("hashchange", () => {
    history.push(here());
    render();
    window.scrollTo(0, 0);
  });

  // notes from other people's actions arrive as a banner at the top
  const tray = document.createElement("div");
  tray.className = "proto-notes";
  tray.setAttribute("aria-live", "polite");
  document.body.appendChild(tray);
  function showNote(n) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "proto-note";
    b.dataset.note = n.id;
    if (n.href) b.dataset.href = n.href;
    b.innerHTML = `<span class="proto-note-app"><svg class="mark" aria-hidden="true"><use href="#logo-facade"/></svg>єГуртожиток · ${esc(n.at)}</span><b>${esc(n.text)}</b>`;
    tray.prepend(b);
    setTimeout(() => b.classList.add("in"), 20);
    setTimeout(() => {
      b.classList.remove("in");
      setTimeout(() => b.remove(), 400);
    }, 6500);
  }

  EH.on((kind, detail) => {
    if (kind === "note" && detail.to === meId) showNote(detail.note);
    if (kind === "change") rerender();
  });

  window.App = {
    route,
    act: (n, fn) => (acts[n] = fn),
    form: (n, fn) => (forms[n] = fn),
    go,
    back,
    rerender,
    esc,
    icon,
    time,
    day,
    dayLong,
    dayShort,
    until,
    countdown,
    plural,
    topbar,
    brand,
    avatar,
    status,
    track,
    seg,
    roleChips,
    roleCount,
    rolesSummary,
    complaintTitle,
    mountPills,
    LAUNDRY,
    ceil5,
    clashes,
    slotsOn,
    freeStarts,
    nearestFree,
    me,
    meId,
    EH,
    S,
    start() {
      history = [here()];
      render();
    },
  };
})();
