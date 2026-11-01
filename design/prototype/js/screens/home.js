/*
 * Головна: what matters to this person today.
 * Order: an important announcement, your next booking (or the nearest free
 * time), news on your own complaints, the work your roles bring, the next
 * events, a quiet way to write a complaint, the credit line.
 * Every block appears only when it has something to say.
 */
(function () {
  const { esc, icon } = App;

  // laundry rules, as in apps/web/app/lib/booking.ts (shared with Пральня through core.js)
  const CLOSE_MIN = App.LAUNDRY.CLOSE;
  const DEFAULT_LEN = App.LAUNDRY.DEF_LEN;

  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const dayIdx = (date) => App.EH.DAYS.findIndex((d) => d.date === date);
  const heading = (date) => cap(App.dayLong(date)); // «Сьогодні, субота», «Вівторок, 3 листопада»
  const toMin = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + m;
  };

  // the real countdown() wording: «через 4 год 20 хв», «через 1 день»
  const countdown = App.countdown;
  // 1 нове звернення, 2 нові звернення, 5 нових звернень
  const plural = App.plural;

  /* ---------- what to show ---------- */

  function upcomingBookings(S, EH, me) {
    const now = EH.nowMin();
    return S.bookings
      .filter(
        (b) =>
          b.person === me.id && b.status === "active" && dayIdx(b.date) >= 0,
      )
      .filter((b) => b.date > EH.TODAY || (b.date === EH.TODAY && b.e > now))
      .sort((a, b) =>
        a.date === b.date ? a.s - b.s : a.date < b.date ? -1 : 1,
      );
  }

  // the soonest start of a 2-hour booking on any machine, today, else tomorrow:
  // the same helper Пральня uses, so both screens name the same time
  const nearestFree = () => App.nearestFree(DEFAULT_LEN)[0] || null;

  // Current announcements this person may read. A dated one stays until its
  // time is over; an undated one (posted «без дати») stays until it is
  // archived, so a fresh notice is never lost from Головна.
  function visibleAnnouncements(S, EH, me) {
    const now = EH.nowMin();
    const squad = EH.can.readSquadAnnouncements(me);
    return S.announcements
      .filter(
        (a) =>
          !a.past &&
          (a.audience === "all" || (a.audience === "squad" && squad)),
      )
      .filter((a) => {
        if (!a.date) return true;
        if (a.date > EH.TODAY) return true;
        if (a.date < EH.TODAY) return false;
        const end = a.until
          ? toMin(a.until)
          : a.time
            ? toMin(a.time)
            : CLOSE_MIN;
        return end > now;
      })
      .sort((a, b) =>
        a.date === b.date
          ? toMin(a.time || "00:00") - toMin(b.time || "00:00")
          : a.date < b.date
            ? -1
            : 1,
      );
  }

  // who signs an announcement: «студрада», «оперзагін», «розпорядник»
  function signature(EH, a) {
    if (a.audience === "squad") return "оперзагін";
    const p = EH.person(a.author);
    if (!p) return "";
    if (EH.has(p, "council")) return "студрада";
    if (p.roles.includes("site_manager")) return "розпорядник";
    if (EH.has(p, "squad")) return "оперзагін";
    return "";
  }

  /* ---------- blocks ---------- */

  function importantCard(EH, a, first) {
    const parts = [a.until ? `до ${a.until}` : "", signature(EH, a)]
      .filter(Boolean)
      .join(" · ");
    const when = a.date ? heading(a.date) : cap(`оголошено ${a.at}`);
    return `<a class="glass home-ann"${first ? "" : ' style="margin-top:12px"'} href="#/board/ann/${a.id}">
      <span class="home-ann-flag">${icon("bell")}Важливе оголошення</span>
      <h3 class="home-ann-title">${esc(a.title)}</h3>
      ${a.audience === "squad" ? `<span class="home-for home-ann-for">Для загону</span>` : ""}
      <div class="home-ann-when">
        ${a.time ? `<span class="t">${esc(a.time)}</span>` : ""}
        <span class="d"><b>${esc(when)}</b>${parts ? `<span>${esc(parts)}</span>` : ""}${a.place ? `<span>${esc(a.place)}</span>` : ""}</span>
      </div>
    </a>`;
  }

  function ticket(EH, S, b, more, withHeader) {
    const m = S.machines.find((x) => x.id === b.machine);
    const running = b.date === EH.TODAY && b.s <= EH.nowMin();
    const foot = running
      ? "<b>Зараз ваш час</b>"
      : `Почнеться <b>${esc(countdown(b.date, b.s))}</b>`;
    return `<section class="area-ticket">
      ${withHeader ? `<div class="section-h" style="margin-top:20px"><h3>Мій запис</h3></div>` : ""}
      <a class="ticket compact" style="display:block;text-decoration:none" href="#/laundry/booking/${b.id}">
        <svg class="porthole" aria-hidden="true"><use href="#porthole"/></svg>
        <div class="ticket-when" style="margin-top:0">${esc(heading(b.date))}</div>
        <div class="ticket-time">${App.time(b.s)}<span class="dash">–</span>${App.time(b.e)}</div>
        <div class="ticket-machine">${esc(m ? m.name : b.machine)}</div>
        <div class="ticket-foot"><span>${foot}</span><span class="ticket-cta">Деталі</span></div>
      </a>
      ${more > 0 ? `<p style="margin:8px 4px 0;font-size:13.5px"><a class="link" href="#/laundry/bookings" style="min-height:0">Ще ${more} ${more === 1 ? "запис" : "записи"}</a></p>` : ""}
    </section>`;
  }

  function bookCard(EH, free, afterHero) {
    const gap = afterHero ? ' style="margin-top:12px"' : "";
    if (!free)
      return `<a class="glass list-row home-row"${gap} href="#/laundry"><span class="hub-ico">${icon("washer")}</span><span class="grow"><b>Сьогодні й завтра все зайнято</b><span class="sub">Подивіться інші дні або коротший запис</span></span>${icon("chev", true)}</a>`;
    const when = App.dayShort(free.date);
    return `<div class="glass nearest home-book"${gap}>
      <div class="nearest-top"><span class="state free">Вільно</span><span class="nearest-when">${esc(when)}, ${esc(countdown(free.date, free.s))}</span></div>
      <div class="nearest-time">${App.time(free.s)}<span class="dash">–</span>${App.time(free.s + DEFAULT_LEN)}</div>
      <div class="nearest-where">${esc(free.m.name)} · на 2 години</div>
      <a class="btn btn-primary home-book-go" href="#/laundry/book?len=${DEFAULT_LEN}&d=${esc(free.date)}&m=${esc(free.m.id)}&s=${free.s}">Записатися на прання</a>
    </div>`;
  }

  function complaintCards(EH, S, me) {
    const mine = S.complaints.filter(
      (c) => (c.author === me.id || c.anonOwner === me.id) && c.unread[me.id],
    );
    if (!mine.length) return "";
    const cards = mine.map((c) => {
      const title = App.complaintTitle(c);
      const last = [...c.messages].reverse().find((m) => m.from !== "author");
      let line = "";
      if (last && last.from === "handler") {
        const who = EH.person(last.who);
        line = `<p class="home-c-msg"><b>${esc(who ? who.first : "")}, ${esc(EH.RECIPIENTS[c.to].label)}:</b> ${esc(last.text)}</p>`;
      } else if (last) line = `<p class="home-c-msg">${esc(last.text)}</p>`;
      const meta = [
        c.anon ? `<span class="anon-tag">${icon("mask")}Анонімно</span>` : "",
        // the title already names the place unless it is a board task's own title
        c.place && c.taskId ? `<span>${icon("pin")}${esc(c.place)}</span>` : "",
        last ? `<span>${icon("clock")}${esc(last.at)}</span>` : "",
      ].join("");
      return `<a class="glass card-link" href="#/complaints/${c.id}" aria-label="Звернення: ${esc(title)}, є нове">
        <div class="card-top"><h4 class="unread-dot">${esc(title)}</h4>${App.status(c.status)}</div>
        ${line}
        <div class="meta">${meta}</div>
      </a>`;
    });
    return `<div class="section-h"><h3>Ваші звернення</h3></div><div class="stack">${cards.join("")}</div>`;
  }

  function inboxRow(EH, S, me, to) {
    const mine = S.complaints.filter(
      (c) => c.to === to && EH.can.handleComplaint(me, c),
    );
    const fresh = mine.filter((c) => c.unread[c.to]).length;
    const late = mine.find(
      (c) => c.overdue && (c.status === "sent" || c.status === "review"),
    );
    if (!fresh && !late) return "";
    const sub = [];
    if (fresh)
      sub.push(
        `${fresh} ${plural(fresh, "нове звернення", "нові звернення", "нових звернень")}`,
      );
    else sub.push("Нових немає");
    return `<a class="list-row home-row" href="#/inbox${fresh ? "?st=new" : ""}">
      <span class="hub-ico">${icon("inbox")}</span>
      <span class="grow"><b>Вхідні звернення</b><span class="sub">${esc(sub.join(""))}</span>${late ? `<span class="sub overdue">2 дні без відповіді — ${esc(App.complaintTitle(late).replace(": ", ", "))}</span>` : ""}</span>
      ${fresh ? `<span class="count-pill" aria-label="${fresh} нових">${fresh}</span>` : ""}
      ${icon("chev", true)}
    </a>`;
  }

  function shiftRow(EH, S, me) {
    if (!EH.has(me, "squad")) return "";
    const ahead = S.shifts
      .filter((s) => s.date >= EH.TODAY && dayIdx(s.date) >= 0)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const own = ahead.find((s) => s.person === me.id);
    if (own) {
      return `<a class="list-row home-row" href="#/squad">
        <span class="hub-ico">${icon("shield")}</span>
        <span class="grow"><b>Ваша вахта</b><span class="sub">${esc(heading(own.date))}${own.note ? ` · ${esc(own.note)}` : ""}</span></span>
        ${icon("chev", true)}
      </a>`;
    }
    const open = ahead.find((s) => !s.person);
    if (!open) return "";
    return `<a class="list-row home-row" href="#/squad">
      <span class="hub-ico">${icon("shield")}</span>
      <span class="grow"><b>Вільна вахта</b><span class="sub">${esc(cap(App.dayLong(open.date)))} · ще ніхто не записався</span></span>
      ${icon("chev", true)}
    </a>`;
  }

  function rolesRow(EH, S, me) {
    if (!EH.can.giveRoles(me)) return "";
    const sub = App.rolesSummary();
    return `<a class="list-row home-row" href="#/admin/roles">
      <span class="hub-ico">${icon("key")}</span>
      <span class="grow"><b>Ролі</b><span class="sub">${esc(sub)}</span></span>
      ${icon("chev", true)}
    </a>`;
  }

  function roleSections(EH, S, me) {
    const out = [];
    const block = (title, rows) => {
      const body = rows.filter(Boolean).join("");
      if (body)
        out.push(
          `<div class="section-h"><h3>${esc(title)}</h3></div><div class="glass home-list">${body}</div>`,
        );
    };
    if (EH.has(me, "council"))
      block("Студрада", [inboxRow(EH, S, me, "council")]);
    if (EH.has(me, "squad"))
      block("Оперзагін", [shiftRow(EH, S, me), inboxRow(EH, S, me, "squad")]);
    if (me.roles.includes("site_manager"))
      block("Розпорядник", [inboxRow(EH, S, me, "team"), rolesRow(EH, S, me)]);
    return out.join("");
  }

  function events(EH, list) {
    if (!list.length) return "";
    const rows = list.map((a) => {
      const d = App.day(a.date);
      const sub = [a.time, a.place].filter(Boolean).join(" · "); // the leaf already shows the date
      return `<a class="list-row home-row" href="#/board/ann/${a.id}">
        <span class="home-leaf" aria-hidden="true"><small>${esc(d ? d.wd : "")}</small><b>${esc(d ? d.d : "")}</b></span>
        <span class="grow"><b>${esc(a.title)}</b><span class="sub">${esc(cap([d && d.label, sub].filter(Boolean).join(", ")) || heading(a.date))}</span>${a.audience === "squad" ? `<span class="home-for">Для загону</span>` : ""}</span>
        ${icon("chev", true)}
      </a>`;
    });
    return `<div class="section-h"><h3>Найближчі події</h3><a href="#/board?tab=ann">Усі</a></div><div class="glass home-list">${rows.join("")}</div>`;
  }

  function complainRow() {
    return `<a class="glass list-row home-row home-quiet" href="#/complaints/new?from=home">
      <span class="hub-ico">${icon("chat")}</span>
      <span class="grow"><b>Щось зламалось чи заважає?</b><span class="sub">Написати звернення</span></span>
      ${icon("chev", true)}
    </a>`;
  }

  /* ---------- the screen ---------- */

  App.route(
    "/",
    (ctx) => {
      const { me, EH, S } = ctx;
      const anns = visibleAnnouncements(S, EH, me);
      // every current important announcement gets its own card, newest first;
      // the events list below never hides one
      const important = anns
        .filter((a) => a.important)
        .sort((a, b) => b.id - a.id);
      const hero = important.length > 0;
      const upcoming = upcomingBookings(S, EH, me);
      const next = upcoming[0];
      const laundry = next
        ? ticket(EH, S, next, upcoming.length - 1, hero)
        : bookCard(EH, nearestFree(), hero);

      return `${App.topbar()}
        <h2 class="title" style="margin-bottom:16px">Привіт, ${esc(me.vocative || me.first)}</h2>
        ${important.map((a, i) => importantCard(EH, a, i === 0)).join("")}
        ${laundry}
        ${complaintCards(EH, S, me)}
        ${roleSections(EH, S, me)}
        ${events(EH, anns.filter((a) => !a.important && a.date).slice(0, 2))}
        <div class="home-quiet-wrap">${complainRow()}</div>
        <p class="credit">Зроблено Антоном Михальчуком — студентом катедри СШІ.</p>`;
    },
    { tab: "home", title: "Головна" },
  );
})();
