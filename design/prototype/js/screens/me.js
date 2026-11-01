/*
 * «Моє»: the person's own hub, the profile, and the role pages that live
 * under it — «Вахти й обходи» for the squad, «Ролі» for the site manager and
 * «Мешканці» for the student council.
 * Everyone who signs in is a resident; a role only adds rows here.
 */
(function () {
  const { esc, icon, time } = App;
  const EH = App.EH;
  const S = App.S;

  const CREDIT = "Зроблено Антоном Михальчуком — студентом катедри СШІ.";
  const MONTHS = [
    "січня",
    "лютого",
    "березня",
    "квітня",
    "травня",
    "червня",
    "липня",
    "серпня",
    "вересня",
    "жовтня",
    "листопада",
    "грудня",
  ];
  const WEEKDAYS = [
    "неділя",
    "понеділок",
    "вівторок",
    "середа",
    "четвер",
    "п’ятниця",
    "субота",
  ];

  // Per-phone screen state: notes after a form, the reminder switch, open lists.
  // `revoke` is the role chip waiting for the second tap «Так, зняти».
  const ui = {
    profile: null,
    roles: null,
    block: null,
    reminder: false,
    logout: false,
    restOpen: false,
    q: "",
    revoke: null,
  };
  // Notes belong to the moment they were shown: leaving the screen clears them.
  window.addEventListener("hashchange", () => {
    ui.profile = null;
    ui.roles = null;
    ui.block = null;
    ui.logout = false;
    ui.revoke = null;
  });

  // Roles are tied to an email, so the site manager can give one before the
  // person first signs in (docs/v2-plan.md, «Ролі»). The store keeps them.
  const pending = () => S.pendingRoles || [];

  // ---------- small helpers ----------
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const roomLabel = (room) =>
    !room
      ? "кімната —"
      : /^\d+[а-яіїєґa-z]?$/i.test(room)
        ? `кімната ${room}`
        : room;
  const plural = App.plural;
  const isMine = (c, me) => c.author === me.id || c.anonOwner === me.id;
  const topicOf = (c) =>
    EH.TOPICS.find((t) => t.id === c.topic) || { label: c.topic, icon: "dots" };
  const machineOf = (id) => S.machines.find((m) => m.id === id);
  const chev = icon("chev", true);

  // a date the demo week may not cover (past patrols): «вчора, пʼятниця»
  function dateLong(date) {
    const d = EH.DAYS.find((x) => x.date === date);
    if (d) return d.long;
    const dt = new Date(date + "T12:00:00Z");
    const diff = Math.round(
      (dt - new Date(EH.TODAY + "T12:00:00Z")) / 86400000,
    );
    const wd = WEEKDAYS[dt.getUTCDay()];
    if (diff === -1) return `вчора, ${wd}`;
    return `${wd}, ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
  }

  const complaintTitle = App.complaintTitle;

  function upcomingBookings(me) {
    const now = EH.nowMin();
    return S.bookings
      .filter(
        (b) =>
          b.person === me.id &&
          b.status === "active" &&
          (b.date > EH.TODAY || (b.date === EH.TODAY && b.e > now)),
      )
      .sort((a, b) =>
        a.date === b.date ? a.s - b.s : a.date < b.date ? -1 : 1,
      );
  }

  const row = ({ href, ico, title, sub, extra = "", act }) =>
    `<a class="list-row" href="#${esc(href)}"${act ? ` data-act="${act}"` : ""}><span class="hub-ico">${icon(ico)}</span><span class="grow"><b>${title}</b>${sub ? `<span class="sub">${sub}</span>` : ""}</span>${extra}${chev}</a>`;

  // new / in-review counts of an inbox for one recipient
  function inboxCounts(to) {
    const list = S.complaints.filter((c) => c.to === to);
    return {
      fresh: list.filter((c) => c.status === "sent").length,
      review: list.filter((c) => c.status === "review").length,
      work: list.filter((c) => c.status === "work").length,
    };
  }
  function inboxRow(to, title) {
    const n = inboxCounts(to);
    const parts = [];
    if (n.fresh)
      parts.push(`${n.fresh} ${plural(n.fresh, "нове", "нові", "нових")}`);
    if (n.review)
      parts.push(`${n.review} ${EH.COMPLAINT_STATUS.review.toLowerCase()}`);
    if (n.work)
      parts.push(`${n.work} ${EH.COMPLAINT_STATUS.work.toLowerCase()}`);
    return row({
      href: n.fresh ? "/inbox?st=new" : "/inbox",
      ico: "inbox",
      title: esc(title),
      sub: esc(parts.length ? cap(parts.join(", ")) : "Нових звернень немає"),
      extra: n.fresh
        ? `<span class="count-pill" aria-label="${n.fresh} ${plural(n.fresh, "нове", "нові", "нових")}">${n.fresh}</span>`
        : "",
    });
  }

  function shiftsSub(me) {
    const own = S.shifts.find((s) => s.person === me.id);
    const free = S.shifts.filter((s) => !s.person).length;
    const parts = [];
    if (own)
      parts.push(
        own.date === EH.TODAY
          ? "Ваша вахта сьогодні"
          : `Ваша вахта: ${dateLong(own.date)}`,
      );
    parts.push(
      free
        ? `${own ? "вільних" : "Вільних"} вахт: ${free}`
        : own
          ? "усі вахти зайняті"
          : "Усі вахти зайняті",
    );
    return parts.join(" · ");
  }

  function meHeader(me, sub) {
    return `<div class="me"><span class="me-av" aria-hidden="true">${esc(me.initials)}</span><div><b>${esc(me.name)}</b><span>${esc(sub)}</span></div></div>`;
  }

  // ---------- /me ----------
  App.route(
    "/me",
    (ctx) => {
      const me = ctx.me;
      const can = ctx.can;
      const sub = `${roomLabel(me.room)}${me.tg ? ` · @${me.tg}` : ""}`;
      const chips = App.roleChips(me);

      // own complaints: open first, then closed; anonymous ones only on the phone they came from
      const mine = S.complaints.filter((c) => isMine(c, me));
      const open = (c) => ["sent", "review", "work"].includes(c.status);
      const sorted = [...mine.filter(open), ...mine.filter((c) => !open(c))];
      const cards = sorted.map((c) => {
        const t = topicOf(c);
        const to = EH.RECIPIENTS[c.to].label;
        const unread = !!c.unread[me.id];
        const meta = [
          c.anon
            ? `<span class="anon-tag">${icon("mask")}Анонімне, лише на цьому телефоні</span>`
            : "",
          `<span>${icon(t.icon)}${esc(t.label)} · ${esc(to)}</span>`,
          unread
            ? `<span>${icon("chat")}нова відповідь</span>`
            : `<span>${esc(c.createdAt)}</span>`,
        ].join("");
        return `<a class="glass card-link" href="#/complaints/${c.id}"><div class="card-top"><h4${unread ? ' class="unread-dot"' : ""}>${esc(complaintTitle(c))}</h4>${App.status(c.status)}</div><div class="meta">${meta}</div></a>`;
      });
      const complaintsBlock = cards.length
        ? `<div class="stack">${cards.join("")}</div>`
        : `<div class="glass empty"><b>Звернень ще немає</b>Якщо щось зламалось чи заважає, напишіть студраді або оперзагону.</div>`;

      const bk = upcomingBookings(me);
      const next = bk[0];
      const laundrySub = next
        ? `${cap(App.dayShort(next.date))} ${time(next.s)}–${time(next.e)} · ${bk.length > 1 ? `ще ${bk.length - 1}` : machineOf(next.machine)?.short || ""}`
        : "Записів немає";

      const sections = [];
      if (EH.has(me, "council")) {
        sections.push(
          `<div class="section-h"><h3>Студрада</h3></div><div class="glass me-hub">${inboxRow("council", "Вхідні звернення")}${row({ href: "/council/residents", ico: "users", title: "Мешканці", sub: "Пошук і блокування" })}</div>`,
        );
      }
      if (EH.has(me, "squad")) {
        sections.push(
          `<div class="section-h"><h3>Оперзагін</h3></div><div class="glass me-hub">${row({ href: "/squad", ico: "shield", title: "Вахти й обходи", sub: esc(shiftsSub(me)) })}${inboxRow("squad", "Вхідні звернення оперзагону")}</div>`,
        );
      }
      if (can.giveRoles(me)) {
        sections.push(
          `<div class="section-h"><h3>Розпорядник</h3></div><div class="glass me-hub">${row({ href: "/admin/roles", ico: "key", title: "Ролі", sub: esc(App.rolesSummary()) })}${inboxRow("team", "Звернення про застосунок")}${!EH.has(me, "squad") && can.squadTools(me) ? row({ href: "/squad", ico: "shield", title: "Вахти й обходи", sub: esc(shiftsSub(me)) }) : ""}</div>`,
        );
      }

      return `${App.topbar({ right: "" })}
      ${meHeader(me, sub)}
      ${chips ? `<div class="me-roles" aria-label="Ваші ролі">${chips}</div>` : ""}
      <div class="section-h"><h3>Мої звернення</h3><a href="#/complaints/new">Написати</a></div>
      ${complaintsBlock}
      <div class="section-h"><h3>Прання</h3></div>
      <div class="glass me-hub">${row({ href: "/laundry/bookings", ico: "cal", title: "Мої записи", sub: esc(laundrySub) })}</div>
      ${sections.join("")}
      <div class="glass me-hub me-last">${row({ href: "/me/profile", ico: "user", title: "Профіль", sub: "Кімната, Telegram, сповіщення, вихід" })}</div>
      <p class="credit">${CREDIT}</p>`;
    },
    { tab: "me", title: "Моє" },
  );

  // ---------- /me/profile ----------
  const tgClean = (v) =>
    String(v || "")
      .trim()
      .replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, "")
      .replace(/^@/, "");
  const tgPreview = (v) => tgClean(v).replace(/[^A-Za-z0-9_]/g, "");

  App.route(
    "/me/profile",
    (ctx) => {
      const me = ctx.me;
      const st = ui.profile || {};
      const err = st.errors || {};
      return `${App.topbar({ back: "/me", title: "Профіль" })}
      ${meHeader(me, me.email)}
      <p class="me-note">Ім’я та пошта беруться з акаунта Політехніки.</p>
      <form class="glass form" data-form="profile" novalidate>
        ${st.saved ? `<p class="ok-note" role="status">Збережено.</p>` : ""}
        <div class="field-row">
          <label for="room">Кімната</label>
          <input id="room" name="room" maxlength="20" required autocomplete="off" value="${esc(me.room || "")}"${err.room ? ' aria-invalid="true"' : ""} aria-describedby="room-help">
          <small id="room-help"${err.room ? ' style="color:var(--danger)"' : ""}>${esc(err.room || "Номер чи назва: 612, 1б, робочка. Обов’язково.")}</small>
        </div>
        <div class="field-row">
          <label for="tg">Ім’я користувача в Telegram <span class="opt">необов’язково</span></label>
          <div class="affix"><span aria-hidden="true">@</span><input id="tg" name="telegram" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(me.tg || "")}"${err.telegram ? ' aria-invalid="true"' : ""} aria-describedby="tg-help"></div>
          <small id="tg-help"${err.telegram ? ' style="color:var(--danger)"' : ""}>${esc(err.telegram || "Щоб вам могли написати, якщо пралка звільнилась раніше чи ви забули білизну. Можна лишити порожнім.")}</small>
        </div>
        <button class="btn btn-primary block" type="submit">Зберегти</button>
      </form>
      <div class="preview-who">
        <small>Так вас бачать інші біля запису</small>
        <div class="tl-block tl-busy who-demo"><span class="n">${esc(me.name)}</span><span class="c" data-preview>${esc(roomLabel(me.room))}${me.tg ? ` · @${esc(me.tg)}` : ""}</span></div>
      </div>
      <div class="glass notify">
        <span class="notify-ico">${icon("bell")}</span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:12px"><b>Нагадати за 15 хвилин</b><button class="switch" type="button" role="switch" aria-checked="${ui.reminder}" aria-label="Нагадати за 15 хвилин" data-act="me-reminder"></button></div>
          <p aria-live="polite">Нагадаємо за 15 хвилин до початку на цьому пристрої.</p>
        </div>
      </div>
      <button class="btn btn-ghost-danger block" type="button" style="margin-top:14px" data-act="me-logout">${icon("logout", true)}Вийти</button>
      ${ui.logout ? `<p class="me-hint" role="status">У прототипі вихід лише показаний. У застосунку він також вимикає нагадування й стирає збережені сторінки на цьому телефоні.</p>` : ""}
      <p class="credit">Кімнату й ім’я користувача в Telegram бачать лише ті, хто увійшов через пошту Політехніки.<br>${CREDIT}</p>`;
    },
    {
      tab: "me",
      title: "Профіль",
      mount(root) {
        const form = root.querySelector('form[data-form="profile"]');
        const out = root.querySelector("[data-preview]");
        if (!form || !out) return;
        const sync = () => {
          const room = form.room.value.trim();
          const tg = tgPreview(form.telegram.value);
          out.textContent = `${roomLabel(room || null)}${tg ? ` · @${tg}` : ""}`;
        };
        form.addEventListener("input", sync);
        sync();
      },
    },
  );

  App.form("profile", (data, ctx) => {
    const room = String(data.room || "").trim();
    const tg = tgClean(data.telegram);
    const errors = {};
    if (!room || room.length > 20)
      errors.room = "Вкажіть кімнату: номер чи назву, до 20 символів.";
    if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg))
      errors.telegram =
        "Ім’я користувача в Telegram — від 5 до 32 латинських літер, цифр або «_».";
    if (Object.keys(errors).length) {
      ui.profile = { errors };
      App.rerender();
      document.getElementById(errors.room ? "room" : "tg")?.focus();
      return;
    }
    ui.profile = { saved: true };
    EH.actions.saveProfile(ctx.me.id, { room, tg });
    const form = document.querySelector('form[data-form="profile"]');
    if (form) {
      form.room.value = room;
      form.telegram.value = tg;
      form.dispatchEvent(new Event("input"));
    }
  });
  App.act("me-reminder", () => {
    ui.reminder = !ui.reminder;
    App.rerender();
  });
  App.act("me-logout", () => {
    ui.logout = true;
    App.rerender();
  });

  // ---------- /squad ----------
  function names(ids, me) {
    return ids
      .map((id) => (id === me.id ? "ви" : EH.person(id)?.name || id))
      .join(", ");
  }

  App.route(
    "/squad",
    (ctx) => {
      const me = ctx.me;
      const top = App.topbar({ back: "/me", title: "Вахти й обходи" });
      if (!ctx.can.squadTools(me)) {
        return `${top}<div class="glass empty"><b>Цей розділ — для оперзагону</b>Вахти й обходи бачать оперзагін і розпорядник. Якщо шумлять чи заходять сторонні, напишіть оперзагону звернення.</div>
        <a class="btn btn-soft block" href="#/complaints/new?topic=noise" style="margin-top:14px">${icon("chat", true)}Написати оперзагону</a>`;
      }
      const member = ctx.can.signShifts(me);
      const shifts = S.shifts.map((s) => {
        const d = EH.DAYS.find((x) => x.date === s.date);
        const own = s.person === me.id;
        const who = s.person && EH.person(s.person);
        const av = `<span class="who-av me-day${own ? " own" : !who ? " free" : ""}" aria-hidden="true">${d ? d.d : s.date.slice(8)}</span>`;
        const sub = own
          ? `Ви на вахті${s.note ? ` · ${esc(s.note)}` : ""}`
          : who
            ? `${esc(who.name)} · ${esc(roomLabel(who.room))}${who.tg ? ` · @${esc(who.tg)}` : ""}${s.note ? ` · ${esc(s.note)}` : ""}`
            : `<span class="me-free">Вільна</span>${s.note ? ` · ${esc(s.note)}` : ""}`;
        const label = cap(dateLong(s.date));
        const btn = !member
          ? ""
          : own
            ? `<button class="pill-btn" type="button" data-act="me-leave-shift" data-date="${s.date}" aria-label="Не зможу стояти на вахті: ${esc(label)}">Не зможу</button>`
            : !who
              ? `<button class="pill-btn" type="button" data-act="me-sign-shift" data-date="${s.date}" aria-label="Записатися на вахту: ${esc(label)}">Записатися</button>`
              : "";
        return `<div class="list-row">${av}<span class="grow"><b>${esc(label)}</b><span class="sub">${sub}</span></span>${btn}</div>`;
      });
      const free = S.shifts.filter((s) => !s.person).length;

      const patrols = [...S.patrols]
        .sort((a, b) =>
          a.done === b.done ? (a.date < b.date ? 1 : -1) : a.done ? 1 : -1,
        )
        .map((p) => {
          const sub = `${esc(cap(names(p.people, me)))}${p.note ? ` · ${esc(p.note)}` : ""}`;
          return `<div class="list-row"><span class="hub-ico">${icon("moon")}</span><span class="grow"><b>${esc(cap(dateLong(p.date)))}</b><span class="sub">${sub}</span></span>${p.done ? App.status("done", "Проведено") : App.status("new", "Заплановано")}</div>`;
        });

      const lastAnn = S.announcements.find((a) => a.audience === "squad");
      const annRow = ctx.can.readSquadAnnouncements(me)
        ? `<div class="section-h"><h3>Оголошення для загону</h3></div><div class="glass me-hub">${row({ href: "/board?tab=ann", ico: "horn", title: lastAnn ? esc(lastAnn.title) : "Оголошення", sub: lastAnn ? esc(`${lastAnn.date ? cap(dateLong(lastAnn.date)) : ""}${lastAnn.time ? `, ${lastAnn.time}` : ""}${lastAnn.place ? ` · ${lastAnn.place}` : ""}`) : "Поки немає" })}</div>`
        : "";

      return `${top}
      <p class="lede">${member ? "Вахти на тиждень і обходи. Записатися на вахту чи звільнити її можна тут, а бот повідомить чат загону." : "Вахти на тиждень і обходи. Записуються на вахти члени оперзагону, тут видно, хто стоїть."}</p>
      <div class="section-h"><h3>Вахти</h3><span class="me-aside">${free ? `вільних: ${free}` : "усі зайняті"}</span></div>
      <div class="glass me-hub">${shifts.join("")}</div>
      <div class="section-h"><h3>Обходи</h3></div>
      <div class="glass me-hub">${patrols.length ? patrols.join("") : `<p class="empty">Обходів ще немає.</p>`}</div>
      ${annRow}`;
    },
    { tab: "me", title: "Вахти й обходи" },
  );

  App.act("me-sign-shift", (el, ctx) => {
    if (ctx.can.signShifts(ctx.me))
      EH.actions.signShift(el.dataset.date, ctx.me.id);
  });
  App.act("me-leave-shift", (el, ctx) => {
    const s = S.shifts.find((x) => x.date === el.dataset.date);
    if (s && s.person === ctx.me.id)
      EH.actions.leaveShift(el.dataset.date, ctx.me.id);
  });

  // ---------- /admin/roles ----------
  const GROUPS = [
    { id: "council", title: "Студрада", roles: ["council_head", "council"] },
    { id: "squad", title: "Оперзагін", roles: ["squad_head", "squad"] },
    { id: "admin", title: "Розпорядник", roles: ["site_manager"] },
  ];
  // «Хто що може» is read off EH.can (and the same checks the screens use),
  // so the list can never promise more or less than the app allows.
  function rightsOf(roles) {
    const p = { roles };
    const c = EH.can;
    const out = [];
    const all = c.announceAll(p),
      squad = c.announceSquad(p);
    if (all && squad) out.push("публікує оголошення для всіх і для загону");
    else if (all) out.push("публікує оголошення для всіх");
    else if (squad) out.push("публікує оголошення для загону");
    if (!squad && c.readSquadAnnouncements(p))
      out.push("читає оголошення для загону");
    const boards = ["council", "squad"].filter((b) => c.runBoard(p, b));
    if (boards.length === 2)
      out.push("веде обидві дошки й бачить на них усі картки");
    else if (boards.length)
      out.push(
        `веде дошку ${boards[0] === "council" ? "студради" : "оперзагону"} й бачить на ній усі картки`,
      );
    const inbox = [
      ["council", "до студради"],
      ["squad", "до оперзагону"],
      ["team", "про застосунок"],
    ].filter(([to]) => c.handleComplaint(p, { to }));
    if (inbox.length)
      out.push(`читає й веде звернення ${inbox.map(([, l]) => l).join(" і ")}`);
    if (c.signShifts(p)) out.push("записується на вахти, бачить обходи");
    else if (c.squadTools(p)) out.push("бачить вахти й обходи");
    const cancels = c.cancelAnyBooking(p),
      blocks = c.blockResidents(p);
    if (cancels && blocks)
      out.push("скасовує будь-які записи на прання й блокує мешканців");
    else if (cancels) out.push("скасовує будь-які записи на прання");
    else if (blocks) out.push("блокує мешканців");
    if (c.giveRoles(p)) out.push("видає й знімає ролі");
    return out;
  }
  const OF = { council: "у студради", squad: "в оперзагону" };
  function rightsRows() {
    const rows = [
      {
        who: "Мешканець",
        what: "Кожен, хто увійшов через пошту Політехніки. Записується на прання, читає оголошення для всіх, бачить на дошках картки для всіх, пише звернення.",
      },
    ];
    const base = {};
    Object.entries(EH.ROLES).forEach(([id, r]) => {
      const list = rightsOf([id]);
      const key = list.join("|");
      const same = Object.entries(base).find(
        ([group, k]) => group === r.group && k.key === key,
      );
      if (same)
        rows.push({
          who: r.label,
          what: `Ті самі права, що й ${OF[r.group] || `у ${same[1].label.toLowerCase()}`}. Окремих прав поки немає.`,
        });
      else rows.push({ who: r.label, what: cap(list.join(", ")) + "." });
      if (!base[r.group]) base[r.group] = { key, label: r.label };
    });
    return rows;
  }

  // a person who has signed in, or an email still waiting for the first sign-in
  function personRow(p, me, roles, isPending) {
    const key = isPending ? `@${p.email}` : p.id;
    const armed =
      ui.revoke && ui.revoke.key === key && roles.includes(ui.revoke.role)
        ? ui.revoke.role
        : null;
    const chips = roles
      .map((r) => {
        const label = EH.ROLES[r].label;
        const locked = !isPending && p.id === me.id && r === "site_manager";
        const who = isPending ? p.email : p.name;
        return `<span class="role-chip${locked ? "" : " me-chip"}${armed === r ? " armed" : ""}">${esc(label)}${locked ? "" : `<button class="me-chip-x" type="button" data-act="me-revoke-ask" data-key="${esc(key)}" data-role="${r}" aria-label="Зняти роль «${esc(label)}»: ${esc(who)}"${armed === r ? ' aria-expanded="true"' : ""}>${icon("x", true)}</button>`}</span>`;
      })
      .join("");
    const confirm = armed
      ? `<span class="me-confirm" role="group" aria-label="Підтвердження"><span class="me-confirm-q">Зняти роль «${esc(EH.ROLES[armed].label)}»?</span><button class="pill-btn danger" type="button" data-act="me-revoke" data-key="${esc(key)}" data-role="${armed}">Так, зняти</button><button class="pill-btn" type="button" data-act="me-revoke-no">Ні</button></span>`
      : "";
    const av = isPending
      ? `<span class="who-av me-wait" aria-hidden="true">${esc(p.email.charAt(0).toUpperCase())}</span>`
      : `<span class="who-av" aria-hidden="true">${esc(p.initials)}</span>`;
    const title = isPending
      ? esc(p.email)
      : `${esc(p.name)}${p.id === me.id ? ` <span class="me-you">ви</span>` : ""}`;
    const sub = isPending ? "чекає першого входу" : esc(p.email);
    return `<div class="list-row me-person">${av}<span class="grow"><b${isPending ? ' class="me-mail"' : ""}>${title}</b><span class="sub">${sub}</span>${chips ? `<span class="me-chips">${chips}</span>` : ""}${confirm}</span></div>`;
  }

  App.route(
    "/admin/roles",
    (ctx) => {
      const me = ctx.me;
      const top = App.topbar({ back: "/me", title: "Ролі" });
      if (!ctx.can.giveRoles(me)) {
        return `${top}<div class="glass empty"><b>Ролі видає розпорядник</b>Без ролі кожен, хто увійшов через пошту Політехніки, — мешканець.</div>`;
      }
      const st = ui.roles;
      const options = Object.entries(EH.ROLES)
        .map(([id, r]) => `<option value="${id}">${esc(r.label)}</option>`)
        .join("");
      const groups = GROUPS.map((g) => {
        const people = S.people.filter((p) =>
          p.roles.some((r) => g.roles.includes(r)),
        );
        const rank = (roles) =>
          g.roles.indexOf(roles.find((r) => g.roles.includes(r)));
        people.sort(
          (a, b) =>
            rank(a.roles) - rank(b.roles) || a.name.localeCompare(b.name, "uk"),
        );
        const waiting = pending().filter((x) =>
          x.roles.some((r) => g.roles.includes(r)),
        );
        const rows = [
          ...people.map((p) =>
            personRow(
              p,
              me,
              g.roles.filter((r) => p.roles.includes(r)),
            ),
          ),
          ...waiting.map((x) =>
            personRow(
              x,
              me,
              g.roles.filter((r) => x.roles.includes(r)),
              true,
            ),
          ),
        ];
        return `<div class="section-h"><h3>${g.title}</h3><span class="me-aside">${App.roleCount(g.id)}</span></div><div class="glass me-hub">${rows.length ? rows.join("") : `<p class="empty">Поки нікого.</p>`}</div>`;
      }).join("");
      const rest = S.people
        .filter((p) => !p.roles.length)
        .sort((a, b) => a.name.localeCompare(b.name, "uk"));

      return `${top}
      <p class="lede">Без ролі кожен, хто увійшов через пошту Політехніки, — мешканець. Роль лише додає права. Її можна видати й до першого входу.</p>
      <form class="glass form" data-form="grant-role">
        ${st ? `<p class="${st.ok ? "ok-note" : "error-note"}" role="${st.ok ? "status" : "alert"}">${esc(st.text)}</p>` : ""}
        <div class="field-row">
          <label for="grant-email">Пошта</label>
          <input id="grant-email" name="email" type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ім’я@lpnu.ua" required>
        </div>
        <div class="field-row">
          <label for="grant-role">Роль</label>
          <div class="me-select"><select id="grant-role" name="role">${options}</select>${icon("chev", true)}</div>
          <small>Ролі можна поєднувати: людина буває і в студраді, і в оперзагоні.</small>
        </div>
        <button class="btn btn-primary block" type="submit">Видати роль</button>
      </form>
      ${groups}
      <details class="glass me-rest"${ui.restOpen ? " open" : ""}>
        <summary class="list-row"><span class="hub-ico">${icon("users")}</span><span class="grow"><b>Мешканці без ролі</b><span class="sub">${rest.length} ${plural(rest.length, "людина", "людини", "людей")}</span></span>${chev}</summary>
        ${rest.map((p) => personRow(p, me, [])).join("")}
      </details>
      <div class="section-h"><h3>Хто що може</h3></div>
      <div class="glass me-hub">${rightsRows()
        .map(
          (r) =>
            `<div class="list-row me-right"><span class="grow"><b>${esc(r.who)}</b><span class="sub">${esc(r.what)}</span></span></div>`,
        )
        .join("")}</div>`;
    },
    {
      tab: "me",
      title: "Ролі",
      mount(root) {
        root
          .querySelector("details.me-rest")
          ?.addEventListener("toggle", (e) => {
            ui.restOpen = e.target.open;
          });
      },
    },
  );

  App.form("grant-role", (data, ctx) => {
    if (!ctx.can.giveRoles(ctx.me)) return;
    const email = String(data.email || "")
      .trim()
      .toLowerCase();
    const role = data.role;
    if (!EH.ROLES[role]) return;
    const label = EH.ROLES[role].label;
    const clear = () => {
      const f = document.querySelector('form[data-form="grant-role"]');
      if (f) f.email.value = "";
    };
    ui.revoke = null;
    if (!/^[^@\s]+@lpnu\.ua$/i.test(email)) {
      ui.roles = {
        ok: false,
        text: "Вкажіть пошту Політехніки: ім’я@lpnu.ua.",
      };
      App.rerender();
      document.getElementById("grant-email")?.focus();
      return;
    }
    // the store gives the role at once, or keeps it until this email first signs in
    const res = EH.actions.grantRole(email, role, ctx.me.id);
    if (!res.ok)
      ui.roles = {
        ok: false,
        text: "Не вдалося видати роль. Спробуйте ще раз.",
      };
    else if (res.person)
      ui.roles = {
        ok: true,
        text: res.already
          ? `${res.person.name} вже має роль «${label}».`
          : `Роль «${label}» видано: ${res.person.name}.`,
      };
    else
      ui.roles = {
        ok: true,
        text: res.already
          ? `Роль «${label}» для ${email} вже чекає першого входу.`
          : `Роль «${label}» записано для ${email}. Вона ввімкнеться, щойно людина вперше увійде.`,
      };
    App.rerender();
    clear();
  });

  // first tap on «×» asks, the second («Так, зняти») removes
  App.act("me-revoke-ask", (el, ctx) => {
    if (!ctx.can.giveRoles(ctx.me)) return;
    ui.revoke = { key: el.dataset.key, role: el.dataset.role };
    App.rerender();
    document.querySelector('[data-act="me-revoke"]')?.focus();
  });
  App.act("me-revoke-no", () => {
    ui.revoke = null;
    App.rerender();
  });
  App.act("me-revoke", (el, ctx) => {
    if (!ctx.can.giveRoles(ctx.me)) return;
    const { key, role } = el.dataset;
    ui.revoke = null;
    const label = EH.ROLES[role]?.label;
    if (!label) return;
    if (key.startsWith("@")) {
      const email = key.slice(1);
      if (!pending().some((x) => x.email === email)) {
        App.rerender();
        return;
      }
      ui.roles = { ok: true, text: `Роль «${label}» для ${email} скасовано.` };
      EH.actions.revokePending(email, role);
      return;
    }
    if (key === ctx.me.id && role === "site_manager") return;
    const p = EH.person(key);
    if (!p || !p.roles.includes(role)) {
      App.rerender();
      return;
    }
    ui.roles = { ok: true, text: `Роль «${label}» знято: ${p.name}.` };
    EH.actions.revokeRole(key, role);
  });

  // ---------- /council/residents ----------
  App.route(
    "/council/residents",
    (ctx) => {
      const me = ctx.me;
      const top = App.topbar({ back: "/me", title: "Мешканці" });
      if (!ctx.can.blockResidents(me)) {
        return `${top}<div class="glass empty"><b>Ця сторінка лише для студради</b>Тут студрада шукає мешканців і блокує тих, хто порушує правила пральні.</div>`;
      }
      const all = [...S.people].sort(
        (a, b) =>
          String(a.room).localeCompare(String(b.room), "uk", {
            numeric: true,
          }) || a.name.localeCompare(b.name, "uk"),
      );
      const stats = [
        { label: "зареєстровано", value: all.length },
        { label: "вказали кімнату", value: all.filter((p) => p.room).length },
        { label: "заблоковано", value: 0 },
      ];
      const rows = all.map((p) => {
        const council = EH.has(p, "council");
        const canBlock = ctx.can.blockResidents(me, p);
        const hay =
          `${p.name} ${p.room || ""} ${p.email} ${p.tg || ""}`.toLowerCase();
        return `<div class="list-row" data-hay="${esc(hay)}"><span style="flex:1;min-width:0"><b>${esc(p.name)}${council ? ` <span class="council-tag">студрада</span>` : ""}</b><span class="sub">${esc(roomLabel(p.room))} · ${esc(p.email)}${p.tg ? ` · @${esc(p.tg)}` : ""}</span></span>${canBlock ? `<button class="pill-btn danger" type="button" data-act="me-block" data-person="${p.id}">Заблокувати</button>` : ""}</div>`;
      });
      return `${top}
      <p class="lede">Записи будь-кого можна скасувати на сторінці пралки. Тут — блокування мешканців.</p>
      <dl class="glass council-stats">${stats.map((s) => `<div><dt>${s.label}</dt><dd>${s.value}</dd></div>`).join("")}</dl>
      ${ui.block ? `<p class="me-hint" role="status">${esc(ui.block)}</p>` : ""}
      <form class="field-row" style="margin-bottom:14px" role="search" onsubmit="return false">
        <label for="q">Пошук</label>
        <input id="q" name="q" placeholder="Ім’я, кімната або пошта" autocomplete="off" value="${esc(ui.q)}">
      </form>
      <div class="glass" style="padding:4px 0" data-people>${rows.join("")}<p class="empty" data-none hidden>Нікого не знайдено.</p></div>`;
    },
    {
      tab: "me",
      title: "Мешканці",
      mount(root) {
        const q = root.querySelector("#q");
        const list = root.querySelector("[data-people]");
        if (!q || !list) return;
        const filter = () => {
          ui.q = q.value;
          const s = q.value.trim().toLowerCase();
          let shown = 0;
          list.querySelectorAll("[data-hay]").forEach((r) => {
            const on = !s || r.dataset.hay.includes(s);
            r.hidden = !on;
            if (on) shown++;
          });
          list.querySelector("[data-none]").hidden = shown > 0;
        };
        q.addEventListener("input", filter);
        filter();
      },
    },
  );

  App.act("me-block", (el, ctx) => {
    const p = EH.person(el.dataset.person);
    if (!p || !ctx.can.blockResidents(ctx.me, p)) return;
    ui.block = `У прототипі блокування лише показане. У застосунку ${p.name} не зможе записуватися на прання, а записи, які ще не почалися, буде скасовано.`;
    App.rerender();
  });
})();
