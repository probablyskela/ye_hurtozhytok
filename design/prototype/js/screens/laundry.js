/*
 * Пральня: the live app's laundry screens inside the new four-tab app.
 * Markup and words follow apps/web/app/routes/{home,book,machine,booking,bookings}.tsx
 * and the booking rules in apps/web/app/lib/booking.ts.
 */
(function () {
  const EH = App.EH;
  const S = App.S;
  const esc = App.esc;
  const icon = App.icon;
  const fmt = App.time;

  // ---------- booking rules (lib/booking.ts) ----------
  const OPEN = 360, CLOSE = 1440, STEP = 5, BUF = 5;
  const MIN_LEN = 30, MAX_LEN = 150, DEF_LEN = 120, MAX_ACTIVE = 3;
  const NO_SHOW = 15, GRACE = 10;
  const QUICK = [30, 60, 90, 120, 150];

  const ERRORS = {
    duration: "Тривалість: від 30 хвилин до 2,5 години, кратно 5 хвилинам.",
    date: "Оберіть день зі списку.",
    grid: "Початок має бути кратним 5 хвилинам.",
    hours: "Пралки працюють з 06:00 до 24:00. Оберіть інший час.",
    past: "Цей час уже минув. Оберіть інший.",
    taken: "Цей час щойно зайняли. Оберіть інший початок.",
    limit: `У вас уже ${MAX_ACTIVE} записи. Скасуйте один або дочекайтеся, поки він закінчиться.`,
    cancel: "Не вдалося скасувати: запис уже почався, закінчився або скасований. Під час прання можна звільнити пралку раніше.",
  };

  const durationLabel = (m) => {
    if (m < 60) return `${m} хв`;
    const h = Math.floor(m / 60), r = m % 60;
    if (r === 30) return `${h},5 год`;
    return r ? `${h} год ${r} хв` : `${h} год`;
  };
  const durationWords = (m) => {
    if (m < 60) return `${m} хвилин`;
    const h = Math.floor(m / 60), r = m % 60;
    if (r === 30) return `${h},5 години`;
    const hours = h === 1 ? "1 година" : `${h} години`;
    return r ? `${hours} ${r} хвилин` : hours;
  };
  const isDuration = (v) => Number.isInteger(v) && v % STEP === 0 && v >= MIN_LEN && v <= MAX_LEN;
  const parseDuration = (v) => (isDuration(Number(v)) ? Number(v) : DEF_LEN);
  const ceil5 = (m) => Math.ceil(m / STEP) * STEP;
  const longestFit = (m) => (m < MIN_LEN ? null : Math.min(MAX_LEN, Math.floor(m / STEP) * STEP));
  const clashes = (s, e, slots) => slots.some((b) => s < b.e + BUF && e + BUF > b.s);
  function freeStarts(slots, len, nowMin) {
    const from = Math.max(OPEN, nowMin == null ? 0 : ceil5(nowMin));
    const out = [];
    for (let s = from; s + len <= CLOSE; s += STEP) if (!clashes(s, s + len, slots)) out.push(s);
    return out;
  }
  function freeWindows(slots, nowMin) {
    const sorted = [...slots].sort((a, b) => a.s - b.s);
    const out = [];
    let cur = Math.max(OPEN, nowMin == null ? 0 : ceil5(nowMin));
    for (const b of sorted) {
      const end = b.s - BUF;
      if (end - cur >= MIN_LEN) out.push({ s: cur, e: end });
      cur = Math.max(cur, b.e + BUF);
    }
    if (CLOSE - cur >= MIN_LEN) out.push({ s: cur, e: CLOSE });
    return out;
  }
  const longestFree = (slots, nowMin) => longestFit(Math.max(0, ...freeWindows(slots, nowMin).map((w) => w.e - w.s)));
  function machineNow(slots, nowMin) {
    if (nowMin < OPEN || nowMin >= CLOSE) return { kind: "closed" };
    const sorted = [...slots].sort((a, b) => a.s - b.s);
    const cur = sorted.find((b) => b.s <= nowMin && nowMin < b.e);
    if (cur) return { kind: "busy", until: cur.e };
    const next = sorted.find((b) => b.s > nowMin);
    return { kind: "free", until: next ? next.s : null };
  }
  function fitting(slots, want, nowMin) {
    const starts = freeStarts(slots, want, nowMin);
    if (starts.length) return { len: want, starts };
    const longest = longestFree(slots, nowMin);
    return longest == null ? { len: want, starts } : { len: longest, starts: freeStarts(slots, longest, nowMin) };
  }

  // ---------- demo days and clock ----------
  const now = () => EH.nowMin();
  const dayIdx = (date) => EH.DAYS.findIndex((d) => d.date === date);
  const nowFor = (date) => (date === EH.TODAY ? now() : null);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  /** "Сьогодні, субота" / "Понеділок, 2 листопада" */
  const dayHeading = (date) => cap(App.dayLong(date));
  /** "Сьогодні" / "Завтра" / "Пн, 2 листопада" */
  function dayName(date) {
    const i = dayIdx(date), d = EH.DAYS[i];
    if (!d) return date;
    if (i === 0) return "Сьогодні";
    if (i === 1) return "Завтра";
    return `${d.wd}, ${d.long.split(", ")[1]}`;
  }
  /** "через 4 год 20 хв", "через 5 хв", "зараз" */
  function countdown(date, m) {
    const mins = dayIdx(date) * 1440 + m - now();
    if (mins <= 0) return "зараз";
    if (mins < 60) return `через ${mins} хв`;
    const h = Math.floor(mins / 60), r = mins % 60;
    if (h >= 24) { const d = Math.floor(h / 24); return `через ${d} ${d === 1 ? "день" : d < 5 ? "дні" : "днів"}`; }
    return r ? `через ${h} год ${r} хв` : `через ${h} год`;
  }

  // ---------- store reads ----------
  const machine = (id) => S.machines.find((m) => m.id === id);
  const slotsOn = (mId, date) => S.bookings.filter((b) => b.status === "active" && b.machine === mId && b.date === date).sort((a, b) => a.s - b.s);
  const ended = (b) => dayIdx(b.date) < 0 || (b.date === EH.TODAY && b.e <= now());
  const running = (b) => !ended(b) && b.date === EH.TODAY && b.s <= now();
  const upcoming = (pid) =>
    S.bookings.filter((b) => b.person === pid && b.status === "active" && !ended(b))
      .sort((a, b) => dayIdx(a.date) - dayIdx(b.date) || a.s - b.s);
  const isCouncil = (p) => EH.has(p, "council"); // lib/permissions.ts: the council may cancel anyone's booking
  const roomLabel = (room) => (!room ? "кімната —" : /^\d+[а-яіїєґa-z]?$/i.test(room) ? `кімната ${room}` : room);
  const q = (path, params) => `${path}?${Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
  const credit = `<p class="credit">Зроблено командою Софії Полупан — кандидатки на посаду голови студради.</p>`;

  /** Server-side checks of the booking action, then the insert. */
  function tryBook(me, mId, date, start, len) {
    if (upcoming(me.id).length >= MAX_ACTIVE) return { error: "limit" };
    if (dayIdx(date) < 0 || !machine(mId)) return { error: "date" };
    if (!isDuration(len)) return { error: "duration" };
    if (!Number.isInteger(start) || start % STEP) return { error: "grid" };
    if (start < OPEN || start + len > CLOSE) return { error: "hours" };
    if (date === EH.TODAY && start < now() - GRACE) return { error: "past" };
    if (clashes(start, start + len, slotsOn(mId, date))) return { error: "taken" };
    return { booking: EH.actions.book(me.id, mId, date, start, len) };
  }

  // ---------- shared pieces ----------
  const pct = (m) => `${(((m - OPEN) / (CLOSE - OPEN)) * 100).toFixed(3)}%`;
  const wid = (a, z) => `${(((z - a) / (CLOSE - OPEN)) * 100).toFixed(3)}%`;
  const scale = (cls = "") => `<div class="strip-scale${cls ? " " + cls : ""}" aria-hidden="true"><span>06</span><span>12</span><span>18</span><span>24</span></div>`;
  /** components/ui.tsx DayStrip */
  function dayStrip(label, slots, meId, nowMin, { pick, mini } = {}) {
    const aria = slots.length ? `${label}: зайнято ${slots.map((b) => `${fmt(b.s)}–${fmt(b.e)}`).join(", ")}` : `${label}: увесь день вільно`;
    let track = "";
    for (const b of slots) {
      if (b.s - BUF >= OPEN) track += `<span class="seg-buf" style="left:${pct(b.s - BUF)};width:${wid(b.s - BUF, b.s)}"></span>`;
      if (b.e + BUF <= CLOSE) track += `<span class="seg-buf" style="left:${pct(b.e)};width:${wid(b.e, b.e + BUF)}"></span>`;
    }
    for (const b of slots) track += `<span class="${b.person === meId ? "seg-mine" : "seg-busy"}" style="left:${pct(b.s)};width:${wid(b.s, b.e)}"></span>`;
    if (nowMin != null && nowMin > OPEN) track += `<span class="seg-past" style="width:${wid(OPEN, Math.min(nowMin, CLOSE))}"></span>`;
    if (pick) track += `<span class="seg-pick" data-pick-seg style="left:${pct(pick.s)};width:${wid(pick.s, pick.e)}"></span>`;
    const nowLine = nowMin != null && nowMin >= OPEN && nowMin < CLOSE ? `<span class="strip-now" style="left:${pct(nowMin)}"></span>` : "";
    return `<div class="strip" role="img" aria-label="${esc(aria)}"><div class="strip-track">${track}</div>${nowLine}${mini ? "" : scale()}</div>`;
  }
  /** components/ui.tsx Ticket */
  function ticket({ to, heading, s, e, machineName, footLeft, footRight = "", status, big, celebrate }) {
    const body = `<svg class="porthole" aria-hidden="true"><use href="#porthole"/></svg>${celebrate ? `<span class="splash" aria-hidden="true"><i></i><i></i><i></i></span>` : ""}${status ? `<div class="ticket-top"><span class="ticket-tag"><span class="dot"></span>${esc(status)}</span></div>` : ""}<div class="ticket-when"${status ? "" : ' style="margin-top:0"'}>${esc(heading)}</div><div class="ticket-time">${fmt(s)}<span class="dash">–</span>${fmt(e)}</div><div class="ticket-machine">${esc(machineName)}</div><div class="ticket-foot"><span>${footLeft}</span>${footRight}</div>`;
    const cls = `ticket${big ? " big" : " compact"}${celebrate ? " celebrate" : ""}`;
    return to ? `<a class="${cls}" style="display:block;text-decoration:none" href="#${esc(to)}">${body}</a>` : `<div class="${cls}">${body}</div>`;
  }
  function daysNav(current, hrefFor) {
    return `<nav class="days" aria-label="День" data-keep-scroll>${EH.DAYS.map((d, i) => `<a class="day" href="#${esc(hrefFor(d.date))}"${d.date === current ? ' aria-current="true"' : ""} aria-label="${esc(dayName(d.date))}"><small>${i === 0 ? "Сьогодні" : i === 1 ? "Завтра" : d.wd}</small><b>${d.d}</b></a>`).join("")}</nav>`;
  }
  const note = (kind, text) => `<p class="${kind}-note" role="${kind === "ok" ? "status" : "alert"}">${esc(text)}</p>`;

  // Links that only change a choice keep the scroll position, like preventScrollReset.
  let keepY = null;
  document.addEventListener("click", (e) => { if (e.target.closest("[data-keep-scroll] a, a[data-keep-scroll]")) keepY = window.scrollY; }, true);
  function restoreScroll() {
    if (keepY == null) return;
    const y = keepY; keepY = null;
    setTimeout(() => window.scrollTo(0, y), 0);
  }

  // Per-phone, per-session state (the live app keeps these in the browser too).
  const reminders = new Set();
  let confirming = null; // booking id waiting for «Так, скасувати»

  // ================= /laundry =================
  function stateText(st) {
    if (st.kind === "closed") return { text: "зачинено до 06:00", free: false };
    if (st.kind === "busy") return { text: `зайнята до ${fmt(st.until)}`, free: false };
    return { text: st.until == null ? "вільна до кінця дня" : `вільна до ${fmt(st.until)}`, free: true };
  }

  App.route("/laundry", (ctx) => {
    const me = ctx.me;
    const len = parseDuration(ctx.query.len);
    const nowMin = now();
    const mine = upcoming(me.id);
    const next = mine[0];
    const more = Math.max(0, mine.length - 1);
    const canBookNow = mine.length < MAX_ACTIVE;

    const firstPer = (date, nm) => S.machines
      .map((m) => ({ m, date, s: freeStarts(slotsOn(m.id, date), len, nm)[0] }))
      .filter((x) => x.s !== undefined).sort((a, b) => a.s - b.s);
    let options = firstPer(EH.TODAY, nowMin);
    if (!options.length) options = firstPer(EH.DAYS[1].date, null);
    const best = options[0];
    const others = options.slice(1);
    const when = best ? dayName(best.date).toLowerCase() : "";

    let notes = "";
    if (ctx.query.cancelled) notes += note("ok", ctx.query.freed ? "Запис скасовано. Групу гуртожитку повідомили, що пралка звільнилась." : "Запис скасовано.");
    if (ctx.query.released) notes += note("ok", "Пралку звільнено. Решта часу тепер вільна для інших.");

    const ticketArea = next
      ? ticket({
          to: `/laundry/booking/${next.id}`, heading: dayHeading(next.date), s: next.s, e: next.e, machineName: machine(next.machine).name,
          footLeft: running(next) ? "<b>Зараз ваш час</b>" : `Почнеться <b>${esc(countdown(next.date, next.s))}</b>`,
          footRight: `<span class="ticket-cta">Деталі</span>`,
        })
      : `<div class="glass empty"><b>Записів поки немає</b>Оберіть пралку й час — це два натискання.</div>`;
    const moreLink = more > 0 ? `<p style="margin:8px 4px 0;font-size:13.5px"><a class="link" href="#/laundry/bookings" style="min-height:0">Ще ${more} ${more === 1 ? "запис" : "записи"}</a></p>` : "";

    const rows = S.machines.map((m) => {
      const slots = slotsOn(m.id, EH.TODAY);
      const st = stateText(machineNow(slots, nowMin));
      return `<a class="now-row" href="#/laundry/machine/${esc(m.id)}"><span class="port ${st.free ? "free" : "busy"}" aria-hidden="true"></span><span class="now-name"><b>${esc(m.short)}</b><small${st.free ? ' class="ok"' : ""}>${esc(st.text)}</small></span>${dayStrip(m.short, slots, me.id, nowMin, { mini: true })}</a>`;
    }).join("");

    const lenSeg = App.seg(QUICK.map((d) => ({ href: `/laundry?len=${d}`, label: durationLabel(d), on: d === len })), "Тривалість", "data-keep-scroll");

    let nearest;
    if (best) {
      const bookHref = (o) => q("/laundry/book", { len, d: o.date, m: o.m.id, s: o.s });
      nearest = `<div class="glass nearest">
        <div class="nearest-top"><span class="state free">Вільно</span><span class="nearest-when">${esc(when)}, ${esc(countdown(best.date, best.s))}</span></div>
        <div class="nearest-time">${fmt(best.s)}<span class="dash">–</span>${fmt(best.s + len)}</div>
        <div class="nearest-where">${esc(best.m.name)}</div>
        <form class="nearest-actions" data-form="laundry-quick">
          <input type="hidden" name="machine" value="${esc(best.m.id)}"><input type="hidden" name="date" value="${esc(best.date)}">
          <input type="hidden" name="start" value="${best.s}"><input type="hidden" name="len" value="${len}">
          <button class="btn btn-primary" type="submit"${canBookNow ? "" : " disabled"}>Записатися</button>
          <a class="btn btn-soft" href="#${esc(bookHref(best))}">Інший час</a>
        </form>
        ${others.length === 0 ? `<p class="nearest-others">Інші пралки на ${esc(durationLabel(len))} ${esc(when)} зайняті.</p>` : `<p class="nearest-others">Також: ${others.map((o, i) => `<span>${i > 0 ? " · " : ""}<a href="#${esc(bookHref(o))}">${esc(o.m.short)} о ${fmt(o.s)}</a></span>`).join("")}</p>`}
        ${canBookNow ? "" : `<p class="nearest-others">Усі ${MAX_ACTIVE} записи вже зайняті.</p>`}
      </div>`;
    } else {
      nearest = `<p class="empty-note">На ${esc(durationLabel(len))} вільного часу немає ні сьогодні, ні завтра. Спробуйте коротший запис або інший день.</p>`;
    }

    return `${App.topbar()}
      <h2 class="title" style="margin-bottom:16px">Пральня</h2>
      ${notes}
      <div class="home-grid">
        <section class="area-ticket">${ticketArea}${moreLink}</section>
        <section class="area-machines">
          <div class="section-h" style="margin-top:20px"><h3>Пралки зараз</h3></div>
          <div class="glass now-panel">${rows}${scale("now-scale")}</div>
        </section>
        <section class="area-nearest">
          <div class="section-h"><h3>Найближчий вільний час</h3></div>
          ${lenSeg}
          ${nearest}
        </section>
      </div>
      ${credit}`;
  }, { tab: "laundry", wide: true, title: "Пральня", mount: restoreScroll });

  App.form("laundry-quick", (data, ctx) => {
    const len = Number(data.len), start = Number(data.start);
    const r = tryBook(ctx.me, data.machine, data.date, start, len);
    // If the time is taken meanwhile, the error opens on the booking page with this same length, day and machine.
    if (r.error) ctx.go(q("/laundry/book", { len, d: data.date, m: data.machine, err: r.error }));
    else ctx.go(`/laundry/booking/${r.booking.id}?new=1`);
  });

  // ================= /laundry/book =================
  App.route("/laundry/book", (ctx) => {
    const me = ctx.me;
    const date = dayIdx(ctx.query.d) >= 0 ? ctx.query.d : EH.TODAY;
    const nowMin = nowFor(date);
    const wanted = parseDuration(ctx.query.len);
    const list = S.machines.map((m) => {
      const slots = slotsOn(m.id, date);
      return { ...m, slots, ...fitting(slots, wanted, nowMin) };
    });
    const requested = list.find((x) => x.id === ctx.query.m);
    const earliest = list.filter((x) => x.starts.length).sort((a, b) => Number(b.len === wanted) - Number(a.len === wanted) || a.starts[0] - b.starts[0])[0];
    const m = requested || earliest || list[0];
    const len = m.len;
    const s = Number(ctx.query.s);
    // Today: the nearest free start. Later days: from 10:00, so nobody books 06:00 by accident.
    const preferred = nowMin == null ? (m.starts.find((x) => x >= 600) ?? m.starts[0]) : m.starts[0];
    const start = m.starts.includes(s) ? s : preferred ?? null;
    const active = upcoming(me.id).length;
    const left = MAX_ACTIVE - active;
    const link = (p) => q("/laundry/book", { len: wanted, d: date, m: m.id, ...p });

    const picker = `<nav class="machine-pick" aria-label="Пралка" data-keep-scroll>${list.map((x) => `<a href="#${esc(link({ m: x.id }))}"${x.id === m.id ? ' aria-current="true"' : ""}><b>${esc(x.short)}</b><small${x.starts.length ? ' class="ok"' : ""}>${!x.starts.length ? "немає місця" : x.len < wanted ? `до ${esc(durationLabel(x.len))}` : `з ${fmt(x.starts[0])}`}</small></a>`).join("")}</nav>`;

    let card;
    if (!m.starts.length) {
      card = `<div class="empty-note" style="margin-top:0">${icon("info", true)}<span>${date === EH.TODAY ? "Сьогодні" : "Цього дня"} на цій пралці немає навіть ${durationLabel(MIN_LEN)}. Оберіть іншу пралку чи день.</span></div>`;
    } else {
      // Starts every half hour plus the first start of each free stretch, grouped by part of day.
      const shown = m.starts.filter((x, i) => x % 30 === 0 || i === 0 || m.starts[i - 1] !== x - STEP || x === start);
      const parts = [["Ранок", OPEN, 720], ["День", 720, 1080], ["Вечір", 1080, CLOSE]];
      const chips = parts.map(([label, a, z]) => {
        const xs = shown.filter((x) => x >= a && x < z);
        if (!xs.length) return "";
        return `<div class="lp-part"><small>${label}</small><div class="chips">${xs.map((x) => `<label class="chip"><input type="radio" name="start" value="${x}"${x === start ? " checked" : ""}><span>${fmt(x)}</span></label>`).join("")}</div></div>`;
      }).join("");
      const shortened = len < wanted;
      card = `<div class="scrubber is-free">
          <div class="scrub-readout"><span class="scrub-time" data-pick-time>${fmt(start)}<span class="dash">–</span>${fmt(start + len)}</span><span class="scrub-status">Вільно</span></div>
          <div class="lp-strip">${dayStrip(m.short, m.slots, me.id, nowMin, { pick: { s: start, e: start + len }, mini: true })}${scale()}</div>
          <div class="lp-label">Тривалість</div>
          ${App.seg(QUICK.map((d) => ({ href: link({ len: d, s: start }), label: durationLabel(d), on: d === wanted })), "Тривалість", "data-keep-scroll")}
          ${shortened ? `<p class="scrub-hint is-note">Цього дня найдовше вільне вікно — ${esc(durationLabel(len))}</p>` : ""}
          <div class="lp-label">Початок</div>
          <fieldset class="lp-starts" aria-label="Початок">${chips}</fieldset>
        </div>`;
    }

    const quota = `<div class="quota"><span class="quota-dots" aria-hidden="true">${[0, 1, 2].map((i) => `<i${i < active ? ' class="on"' : ""}></i>`).join("")}</span>${left > 0 ? `Ще можна мати ${left} ${left === 1 ? "запис" : "записи"} із ${MAX_ACTIVE}` : `Усі ${MAX_ACTIVE} записи зайняті`}</div>`;

    const html = `<form id="lbook" data-form="laundry-book">
      ${App.topbar({ back: "/laundry" })}
      <h2 class="title">Записатися</h2>
      <p class="lede">Оберіть день і пралку, тривалість і початок.</p>
      ${ctx.query.err && ERRORS[ctx.query.err] ? note("error", ERRORS[ctx.query.err]) : ""}
      <div class="section-h" style="margin-top:0"><h3>Коли</h3></div>
      ${daysNav(date, (d) => link({ d }))}
      <div class="section-h"><h3>Пралка</h3></div>
      ${picker}
      <div class="glass pick-card">${card}</div>
      ${quota}
      <input type="hidden" name="machine" value="${esc(m.id)}"><input type="hidden" name="date" value="${esc(date)}"><input type="hidden" name="len" value="${len}">
    </form>`;

    const disabled = left <= 0 || !m.starts.length || start == null;
    const sheetText = left <= 0
      ? `<small>Усі ${MAX_ACTIVE} записи зайняті</small><b>Скасуйте один, щоб записатися</b>`
      : start == null
        ? `<small>${esc(durationLabel(len))}</small><b>Оберіть час</b>`
        : `<small>${esc(m.name)} · ${esc(dayName(date).toLowerCase())}</small><b class="sheet-time" data-sheet-time>${fmt(start)}–${fmt(start + len)}</b>`;
    const sheet = `<div class="sheet"><div class="sheet-text">${sheetText}</div><button class="btn btn-primary" type="submit" form="lbook"${disabled ? " disabled" : ""}>Записатися</button></div>`;
    return { html, sheet };
  }, {
    tab: "laundry", title: "Записатися",
    mount(root) {
      restoreScroll();
      const form = root.querySelector("#lbook");
      if (!form) return;
      const len = Number(form.elements.len.value);
      const sync = () => {
        const r = form.querySelector('input[name="start"]:checked');
        if (!r) return;
        const s = Number(r.value);
        const t = root.querySelector("[data-pick-time]");
        if (t) t.innerHTML = `${fmt(s)}<span class="dash">–</span>${fmt(s + len)}`;
        const st = root.querySelector("[data-sheet-time]");
        if (st) st.textContent = `${fmt(s)}–${fmt(s + len)}`;
        const seg = root.querySelector("[data-pick-seg]");
        if (seg) { seg.style.left = pct(s); seg.style.width = wid(s, s + len); }
        // the duration links keep the chosen start
        root.querySelectorAll('.lp-strip ~ .seg a').forEach((a) => { a.href = a.getAttribute("href").replace(/([?&]s=)\d+/, `$1${s}`); });
      };
      form.addEventListener("change", sync);
      setTimeout(sync, 0); // after a re-render restores the person's chosen start
    },
  });

  App.form("laundry-book", (data, ctx) => {
    const len = Number(data.len), start = Number(data.start);
    if (!data.start) return;
    const r = tryBook(ctx.me, data.machine, data.date, start, len);
    if (r.error) ctx.go(q("/laundry/book", { len, d: data.date, m: data.machine, err: r.error }), { replace: true });
    else ctx.go(`/laundry/booking/${r.booking.id}?new=1`);
  });

  // ================= /laundry/machine/:id =================
  const PX = 2;
  let armed = null; // a council member's «Скасувати» waiting for the second tap

  App.route("/laundry/machine/:id", (ctx) => {
    const me = ctx.me;
    const m = machine(ctx.params.id);
    if (!m) return `${App.topbar({ back: "/laundry" })}<div class="glass empty"><b>Такої пралки немає</b>Поверніться до пральні й оберіть іншу.</div>`;
    const date = dayIdx(ctx.query.d) >= 0 ? ctx.query.d : EH.TODAY;
    const isToday = date === EH.TODAY;
    const nowMin = nowFor(date);
    const slots = slotsOn(m.id, date);
    const council = isCouncil(me);
    const fromMin = isToday ? Math.max(OPEN, Math.min(Math.floor(nowMin / 60) * 60, CLOSE - 60)) : OPEN;
    const y = (x) => (x - fromMin) * PX;
    const visible = slots.filter((b) => b.e > fromMin);

    let pill = { text: dayName(date), cls: "neutral" };
    if (isToday) {
      const st = machineNow(slots, nowMin);
      if (st.kind === "busy") pill = { text: `Зайнята до ${fmt(st.until)}`, cls: "busy" };
      else if (st.kind === "free") pill = { text: st.until == null ? "Вільна до кінця дня" : `Вільна до ${fmt(st.until)}`, cls: "free" };
      else pill = { text: "Зачинено до 06:00", cls: "busy" };
    }

    let grid = "";
    for (let h = Math.ceil(fromMin / 60); h <= 24; h++) grid += `<div class="tl-hour" style="top:${y(h * 60)}px"><span>${String(h).padStart(2, "0")}:00</span></div>`;
    for (const b of visible) {
      if (b.s - BUF >= fromMin) grid += `<div class="tl-buf" style="top:${y(b.s - BUF)}px;height:${BUF * PX}px"></div>`;
      if (b.e + BUF <= CLOSE) grid += `<div class="tl-buf" style="top:${y(b.e)}px;height:${BUF * PX}px"></div>`;
    }
    for (const b of visible) {
      const top = y(Math.max(fromMin, b.s)) + 2;
      const height = (b.e - Math.max(fromMin, b.s)) * PX - 4;
      const time = `<span class="tl-time">${fmt(b.s)}<small>${fmt(b.e)}</small></span>`;
      if (b.person === me.id) {
        grid += `<a class="tl-block tl-mine" href="#/laundry/booking/${b.id}" style="top:${top}px;height:${height}px">${time}<span class="tl-body"><b>Ваш запис</b><span>${esc(durationLabel(b.e - b.s))}</span></span>${icon("chev", true)}</a>`;
      } else {
        const p = EH.person(b.person);
        const tg = p.tg ? ` · <a href="https://t.me/${esc(p.tg)}" target="_blank" rel="noreferrer">@${esc(p.tg)}</a>` : "";
        const cancel = council
          ? `<button class="pill-btn danger" type="button" data-act="laundry-council-cancel" data-id="${b.id}" aria-label="Скасувати запис: ${esc(p.name)}, ${fmt(b.s)}">${armed === b.id ? "Так, скасувати" : "Скасувати"}</button>`
          : "";
        grid += `<div class="tl-block tl-busy" style="top:${top}px;height:${height}px">${time}<span class="tl-body"><b>${esc(p.name)}</b><span>${esc(roomLabel(p.room))}${tg}</span></span>${cancel}</div>`;
      }
    }
    for (const w of freeWindows(slots, nowMin).filter((w) => w.e > fromMin)) {
      const top = y(Math.max(fromMin, w.s)) + 2;
      const height = (w.e - Math.max(fromMin, w.s)) * PX - 4;
      const len = longestFit(w.e - w.s) ?? MIN_LEN;
      grid += `<a class="tl-block tl-free" href="#${esc(q("/laundry/book", { d: date, m: m.id, s: w.s, len }))}" style="top:${top}px;height:${height}px" aria-label="Вільно ${fmt(w.s)}–${fmt(w.e)}, записатися"><span class="tl-time">${fmt(w.s)}<small>${fmt(w.e)}</small></span><span class="tl-body"><b>Вільно</b><span>можна до ${esc(durationLabel(len))}</span></span><span class="plus" aria-hidden="true">${icon("plus", true)}</span></a>`;
    }
    if (nowMin != null && nowMin >= fromMin && nowMin < CLOSE) grid += `<div class="tl-now" style="top:${y(nowMin)}px" data-time="${fmt(nowMin)}"></div>`;

    return `${App.topbar({ back: "/laundry" })}
      <div class="day-head"><div><h2>${esc(m.name)}</h2><span class="state ${pill.cls}">${esc(pill.text)}</span></div></div>
      ${ctx.query.ok ? note("ok", "Запис скасовано.") : ""}
      ${daysNav(date, (d) => q(`/laundry/machine/${m.id}`, { d }))}
      <div class="glass timeline">
        ${fromMin > OPEN ? `<div class="past-row"><span>06:00–${fmt(fromMin)} уже минуло</span>${icon("clock", true)}</div>` : ""}
        <div class="tl-grid" style="height:${y(CLOSE) + 8}px">${grid}</div>
      </div>
      <div class="glass rule" style="margin-top:14px">${icon("info")}<span>Між записами є ${BUF} хвилин запасу. Якщо людини немає ${NO_SHOW} хвилин від початку, пралку може взяти будь-хто.</span></div>
      ${credit}`;
  }, { tab: "laundry", title: "Пралка", mount: restoreScroll });

  App.act("laundry-council-cancel", (el, ctx) => {
    if (!isCouncil(ctx.me)) return;
    const id = Number(el.dataset.id);
    if (armed !== id) { armed = id; keepY = window.scrollY; App.rerender(); return; }
    armed = null;
    const b = S.bookings.find((x) => x.id === id);
    EH.actions.cancelBooking(id, ctx.me.id);
    keepY = window.scrollY;
    ctx.go(q(`/laundry/machine/${b.machine}`, { d: b.date, ok: 1 }), { replace: true });
  });

  // ================= /laundry/booking/:id =================
  App.route("/laundry/booking/:id", (ctx) => {
    const me = ctx.me;
    const b = S.bookings.find((x) => x.id === Number(ctx.params.id));
    const back = ctx.query.from === "list" ? "/laundry/bookings" : "/laundry";
    if (!b || (b.person !== me.id && !isCouncil(me)))
      return `${App.topbar({ back, title: "Запис" })}<div class="glass empty"><b>Такого запису немає</b>Можливо, його вже скасували.</div>`;
    const mine = b.person === me.id;
    const isEnded = ended(b), isRunning = running(b);
    const status = b.status === "cancelled" ? "Скасовано" : isEnded ? "Завершено" : isRunning ? "Триває" : "Підтверджено";
    const owner = EH.person(b.person);
    const m = machine(b.machine);
    const live = b.status === "active" && !isEnded;

    let actions = "";
    if (live) {
      if (confirming === b.id) {
        actions = `<p class="lp-ask">Скасувати цей запис?</p><div class="actions"><button class="btn btn-soft" type="button" data-act="laundry-cancel-no">Ні, залишити</button><button class="btn btn-ghost-danger block" type="button" data-act="laundry-cancel" data-id="${b.id}">Так, скасувати</button></div>`;
      } else if (isRunning && mine) {
        actions = `<div class="actions running"><button class="btn btn-soft block" type="button" data-act="laundry-release" data-id="${b.id}">${icon("check", true)}Звільнити раніше</button></div>`;
      } else {
        actions = `<div class="actions"><button class="btn btn-soft" type="button" data-act="laundry-ics" data-id="${b.id}">${icon("cal", true)}У календар</button><button class="btn btn-ghost-danger block" type="button" data-act="laundry-cancel-ask" data-id="${b.id}">Скасувати</button></div>`;
      }
    }
    const on = reminders.has(b.id);
    const reminder = mine && live && !isRunning
      ? `<div class="glass notify"><span class="notify-ico">${icon("bell")}</span><div style="flex:1 1 0%;min-width:0"><div style="display:flex;align-items:center;gap:12px"><b>Нагадати за 15 хвилин</b><button class="switch" type="button" role="switch" aria-checked="${on}" aria-label="Нагадати за 15 хвилин" data-act="laundry-remind" data-id="${b.id}"></button></div><p aria-live="polite">Нагадаємо за 15 хвилин до початку на цьому пристрої.</p></div></div>`
      : "";

    return `${App.topbar({ back, title: mine ? "Мій запис" : "Запис" })}
      ${ctx.query.new && live ? note("ok", "Записано. Нагадаємо за 15 хвилин, якщо сповіщення увімкнені.") : ""}
      ${ctx.query.err && ERRORS[ctx.query.err] ? note("error", ERRORS[ctx.query.err]) : ""}
      ${ticket({
        big: true, celebrate: !!ctx.query.new && live, status, heading: dayHeading(b.date), s: b.s, e: b.e, machineName: m.name,
        footLeft: esc(mine ? durationWords(b.e - b.s) : `${owner.name}, ${roomLabel(owner.room)}`),
        footRight: live && !isRunning ? `<span>${esc(countdown(b.date, b.s))}</span>` : "",
      })}
      ${actions}
      ${reminder}
      <div class="glass rules">
        <div class="rule">${icon("clock")}<span>Під час прання можна звільнити пралку раніше, і решта часу стане вільною для інших.</span></div>
        <div class="rule">${icon("info")}<span>Якщо вас немає ${NO_SHOW} хвилин від початку, пралку може взяти будь-хто.</span></div>
        <div class="rule">${icon("user")}<span>Інші бачать ваше ім’я, кімнату й ім’я користувача в Telegram, якщо ви його вказали.</span></div>
      </div>
      <p style="margin:14px 4px"><a class="link" href="#/laundry/machine/${esc(m.id)}">Розклад цієї пралки</a></p>`;
  }, { tab: "laundry", title: "Мій запис" });

  App.act("laundry-cancel-ask", (el) => { confirming = Number(el.dataset.id); App.rerender(); });
  App.act("laundry-cancel-no", () => { confirming = null; App.rerender(); });
  App.act("laundry-cancel", (el, ctx) => {
    confirming = null;
    const b = S.bookings.find((x) => x.id === Number(el.dataset.id));
    const me = ctx.me;
    // re-check on the «server»: own or council, still active and not started
    if (!b || b.status !== "active" || ended(b) || (b.person !== me.id && !isCouncil(me)) || (running(b) && b.person === me.id)) {
      ctx.go(`/laundry/booking/${el.dataset.id}?err=cancel`, { replace: true });
      return;
    }
    const before = S.bot.length;
    EH.actions.cancelBooking(b.id, me.id);
    if (b.person !== me.id) { ctx.go(q(`/laundry/machine/${b.machine}`, { d: b.date, ok: 1 })); return; }
    ctx.go(S.bot.length > before ? "/laundry?cancelled=1&freed=1" : "/laundry?cancelled=1");
  });
  App.act("laundry-release", (el, ctx) => {
    const b = S.bookings.find((x) => x.id === Number(el.dataset.id));
    if (!b || b.person !== ctx.me.id || !running(b)) return;
    if (EH.actions.releaseBooking) EH.actions.releaseBooking(b.id, ctx.me.id);
    else {
      // lib/bookings.server.ts releaseBooking: the end moves to the next 5-minute mark
      const end = Math.min(ceil5(now()), b.e);
      if (end <= b.s) EH.actions.cancelBooking(b.id, ctx.me.id);
      else b.e = end;
    }
    ctx.go("/laundry?released=1");
  });
  App.act("laundry-remind", (el) => {
    const id = Number(el.dataset.id);
    if (reminders.has(id)) reminders.delete(id); else reminders.add(id);
    el.setAttribute("aria-checked", String(reminders.has(id)));
  });
  App.act("laundry-ics", (el) => {
    const b = S.bookings.find((x) => x.id === Number(el.dataset.id));
    if (!b) return;
    const m = machine(b.machine);
    const stamp = (date, min) => `${date.replace(/-/g, "")}T${String(Math.floor(min / 60) % 24).padStart(2, "0")}${String(min % 60).padStart(2, "0")}00`;
    const endDate = b.e >= CLOSE ? EH.DAYS[dayIdx(b.date) + 1]?.date || b.date : b.date;
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ehurtozhytok//UK", "BEGIN:VEVENT", `UID:booking-${b.id}@ehurtozhytok`, `DTSTART;TZID=Europe/Kyiv:${stamp(b.date, b.s)}`, `DTEND;TZID=Europe/Kyiv:${stamp(endDate, b.e)}`, `SUMMARY:Прання: ${m.name}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = `zapys-${b.id}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // ================= /laundry/bookings =================
  App.route("/laundry/bookings", (ctx) => {
    const list = upcoming(ctx.me.id);
    const rows = list.length
      ? `<div class="glass" style="padding:4px 0">${list.map((b) => {
          const run = running(b);
          return `<a class="list-row" href="#/laundry/booking/${b.id}?from=list"><span class="who-av" style="${run ? "background:var(--mine);color:#fff" : "background:var(--mine-soft);color:var(--mine)"}">${icon("clock", true)}</span><span style="flex:1"><b>${esc(dayName(b.date))} · ${fmt(b.s)}–${fmt(b.e)}</b><span class="sub">${esc(machine(b.machine).name)} · ${run ? "зараз ваш час" : esc(durationLabel(b.e - b.s))}</span></span>${icon("chev", true)}</a>`;
        }).join("")}</div>`
      : `<div class="glass empty"><b>Записів немає</b>Тут будуть ваші записи, поки вони не закінчаться.</div>`;
    return `${App.topbar({ back: "/laundry", title: "Мої записи" })}
      ${rows}
      <p class="muted" style="margin:14px 4px;font-size:13.5px">Одночасно можна мати до ${MAX_ACTIVE} записів.</p>
      <a class="btn btn-primary block" href="#/laundry/book">${icon("plus")}Записатися</a>
      ${credit}`;
  }, { tab: "laundry", title: "Мої записи" });
})();
