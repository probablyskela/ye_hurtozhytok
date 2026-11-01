/*
 * Дошка: everything public in one place.
 *   /board?tab=ann|tasks&b=council|squad&col=new|in_progress|done&hist=1
 *   /board/ann/:id, /board/ann/new
 *   /board/task/:id, /board/task/new?b=council|squad
 * Every action re-checks permissions through EH.can before it changes the store.
 */
(function () {
  const { esc, icon } = App;
  const EH = App.EH;
  const S = App.S;

  const BOARD = {
    council: {
      label: "Студрада",
      of: "студради",
      only: "Лише для студради",
      who: "студрада",
    },
    squad: {
      label: "Оперзагін",
      of: "оперзагону",
      only: "Лише для загону",
      who: "оперзагін",
    },
  };
  // the columns are the task statuses, in the same words as everywhere else
  const COLS = ["new", "in_progress", "done"].map((id) => ({
    id,
    label: EH.TASK_STATUS[id],
  }));

  // ---------- small helpers ----------
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const plural = App.plural;
  const MONTHS = {
    січ: 1,
    лют: 2,
    бер: 3,
    кві: 4,
    тра: 5,
    чер: 6,
    лип: 7,
    сер: 8,
    вер: 9,
    жов: 10,
    лис: 11,
    гру: 12,
  };
  // "26 жов" | "сьогодні" -> days before the demo's today (31 October)
  function daysAgo(label) {
    const s = String(label || "").trim();
    if (!s || s.startsWith("сьогодні")) return 0;
    if (s.startsWith("вчора")) return 1;
    const m = s.match(/^(\d{1,2})\s+([а-яіїєґ]{3})/i);
    if (!m) return null;
    const [ty, tm, td] = EH.TODAY.split("-").map(Number);
    const mon = MONTHS[m[2].toLowerCase()];
    if (!mon) return null;
    const then = Date.UTC(ty, mon - 1, Number(m[1]));
    return Math.round((Date.UTC(ty, tm - 1, td) - then) / 86400000);
  }
  function age(label) {
    const n = daysAgo(label);
    if (n === null) return esc(label);
    if (n <= 0) return "сьогодні";
    if (n === 1) return "вчора";
    return `${n} ${plural(n, "день", "дні", "днів")} тому`;
  }
  const atDay = (at) => String(at || "").split(",")[0];
  const roleLabel = (p) =>
    p && p.roles.length
      ? EH.ROLES[p.roles[0]].label.toLowerCase()
      : "мешканець";
  const authorLine = (id) => {
    const p = EH.person(id);
    return p ? `${esc(p.name)}, ${esc(roleLabel(p))}` : "";
  };

  // ---------- announcements ----------
  const canSeeAnn = (me, a) =>
    a.audience !== "squad" || EH.can.readSquadAnnouncements(me);
  const canAnnounce = (me) =>
    EH.can.announceAll(me) || EH.can.announceSquad(me);
  const isHistory = (a) => !!a.past || (a.date && a.date < EH.TODAY);
  const dayOf = (date) => EH.DAYS.find((d) => d.date === date);
  function leaf(a) {
    const d = dayOf(a.date);
    if (d)
      return `<span class="cal-leaf" aria-hidden="true"><small>${esc(d.wd)}</small><b>${d.d}</b></span>`;
    return `<span class="cal-leaf blank" aria-hidden="true"><small>&nbsp;</small>${icon("horn")}</span>`;
  }
  const squadChip = (a) =>
    a.audience === "squad" ? `<span class="role-chip">Для загону</span>` : "";
  function annMeta(a) {
    const bits = [];
    if (a.time)
      bits.push(
        `<span>${icon("clock")}${esc(a.time)}${a.until ? `–${esc(a.until)}` : ""}</span>`,
      );
    if (a.place) bits.push(`<span>${icon("pin")}${esc(a.place)}</span>`);
    if (!a.date) bits.push(`<span>${esc(a.at)}</span>`);
    return bits.length ? `<div class="meta">${bits.join("")}</div>` : "";
  }
  function whenBlock(a) {
    if (!a.date && !a.time) return "";
    const d = dayOf(a.date);
    const dayText = d ? cap(d.long) : "Без дати";
    const sub = [
      a.until ? `до ${esc(a.until)}` : "",
      a.place ? esc(a.place) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return `<div class="ann-when">${a.time ? `<span class="t">${esc(a.time)}</span>` : ""}<span class="d"><b>${esc(dayText)}</b>${sub ? `<span>${sub}</span>` : ""}</span></div>`;
  }

  function annTab(ctx) {
    const me = ctx.me;
    const all = S.announcements.filter((a) => canSeeAnn(me, a));
    const live = all.filter((a) => !isHistory(a));
    const past = all.filter(isHistory);
    // undated news first (newest first), then dated by day and time
    const key = (a) => (a.date ? `1${a.date}${a.time || "99:99"}` : "0");
    const upcoming = live.slice().sort((x, y) => key(x).localeCompare(key(y)));
    const hero = upcoming.find((a) => a.important && a.audience === "all");
    const rest = upcoming.filter((a) => a !== hero);
    const histOpen = ctx.query.hist === "1";

    let html = "";
    if (hero) {
      html += `<a class="glass ann-hero" href="#/board/ann/${hero.id}">
        <span class="ann-flag">${icon("bell")}Важливе оголошення</span>
        <h3 class="ann-title">${esc(hero.title)}</h3>
        ${hero.details ? `<p class="ann-body">${esc(hero.details)}</p>` : ""}
        ${whenBlock(hero) || annMeta(hero)}
      </a>`;
    }
    if (rest.length) {
      html += `${hero ? `<div class="section-h"><h3>Далі</h3></div>` : ""}<div class="ann-list">${rest
        .map(
          (a) => `<a class="glass ann-row" href="#/board/ann/${a.id}">
          ${leaf(a)}
          <div class="grow">
            ${a.important || a.audience === "squad" ? `<div class="ann-tags">${a.important ? `<span class="ann-flag">${icon("bell")}Важливе</span>` : ""}${squadChip(a)}</div>` : ""}
            <h4>${esc(a.title)}</h4>
            ${a.details ? `<p>${esc(a.details)}</p>` : ""}
            ${annMeta(a)}
          </div>
        </a>`,
        )
        .join("")}</div>`;
    }
    if (!hero && !rest.length) {
      html += `<div class="glass empty"><b>Нових оголошень немає</b>Коли студрада щось оголосить, воно з’явиться тут.</div>`;
    }
    if (canAnnounce(me)) {
      html += `<a class="btn btn-soft block bd-add" href="#/board/ann/new">${icon("plus", true)}Нове оголошення</a>`;
    }
    if (past.length) {
      html += `<a class="history" href="#/board?tab=ann${histOpen ? "" : "&hist=1"}" aria-expanded="${histOpen}">Історія <small>${past.length} ${plural(past.length, "оголошення", "оголошення", "оголошень")}${icon("chev", true)}</small></a>`;
      if (histOpen) {
        html += `<div class="glass hist-list">${past
          .map(
            (a) =>
              `<a class="list-row" href="#/board/ann/${a.id}"><div class="grow"><b>${esc(a.title)}</b><span class="sub">${esc(a.at)}${a.author ? ` · ${esc(EH.person(a.author)?.name || "")}` : ""}</span></div>${icon("chev", true)}</a>`,
          )
          .join("")}</div>`;
      }
    }
    return html;
  }

  // ---------- tasks ----------
  // members see the board's private tasks; so does whoever runs the board
  const seesPrivate = (me, board) =>
    EH.can.seePrivateTasks(me, board) || EH.can.runBoard(me, board);
  const visibleTasks = (me, board) =>
    S.tasks.filter(
      (t) => t.board === board && (t.public || seesPrivate(me, board)),
    );

  function tasksTab(ctx) {
    const me = ctx.me;
    const b = BOARD[ctx.query.b] ? ctx.query.b : "council";
    const col = COLS.some((c) => c.id === ctx.query.col)
      ? ctx.query.col
      : "in_progress";
    const base = `/board?tab=tasks&b=${b}`;
    const tasks = visibleTasks(me, b);
    const counts = Object.fromEntries(
      COLS.map((c) => [c.id, tasks.filter((t) => t.status === c.id).length]),
    );
    const shown = tasks.filter((t) => t.status === col);

    const cs = S.complaints.filter((c) => c.to === b);
    const got = cs.length;
    const solved = cs.filter((c) => c.status === "resolved").length;
    const working = cs.filter((c) => c.status === "work").length;

    const other = b === "council" ? "squad" : "council";
    let html = `<div class="section-h bd-board"><h3>Дошка ${BOARD[b].of}</h3><a href="#/board?tab=tasks&b=${other}&col=${col}" aria-label="Перейти до дошки ${BOARD[other].of}">${BOARD[other].label}${icon("chev", true)}</a></div>`;

    html += `<div class="glass report" role="group" aria-label="Звернення: ${BOARD[b].who}">
      <div><b>${got}</b><span>${plural(got, "звернення надійшло", "звернення надійшли", "звернень надійшло")}</span></div>
      <div><b>${solved}</b><span>вирішено</span></div>
      <div><b>${working}</b><span><i class="work-dot" aria-hidden="true"></i>${plural(working, "звернення в роботі", "звернення в роботі", "звернень у роботі")}</span></div>
    </div>`;

    html += `<a class="glass write-cta" href="#/complaints/new">
      <p><b>Щось зламалось чи заважає?</b>Студрада чи оперзагін отримає одразу.</p>
      <span class="btn btn-primary">Написати</span>
    </a>`;

    html += App.seg(
      COLS.map((c) => ({
        href: `${base}&col=${c.id}`,
        label: c.label,
        on: c.id === col,
        count: counts[c.id],
      })),
      "Колонка",
      "",
      "cols",
    );

    if (shown.length) {
      html += `<div class="stack">${shown.map((t) => taskCard(t, b)).join("")}</div>`;
    } else {
      const empty = {
        new: "Нових завдань немає",
        in_progress: "Зараз нічого не в роботі",
        done: "Готових завдань ще немає",
      }[col];
      html += `<div class="glass empty"><b>${empty}</b>Завдання з’являються тут, коли ${BOARD[b].who} бере звернення в роботу.</div>`;
    }

    if (EH.can.runBoard(me, b)) {
      html += `<a class="btn btn-soft block bd-add" href="#/board/task/new?b=${b}">${icon("plus", true)}Нове завдання</a>`;
    }
    return html;
  }

  function taskCard(t, b) {
    return `<a class="glass card-link" href="#/board/task/${t.id}">
      <div class="card-top"><h3>${esc(t.title)}</h3></div>
      <div class="meta">${t.place ? `<span>${icon("pin")}${esc(t.place)}</span>` : ""}<span class="age">${t.status === "done" ? "додано " : ""}${age(t.createdAt)}</span></div>
      ${t.complaintId || !t.public ? `<div class="chips">${t.complaintId ? `<span class="from-c">${icon("chat")}Зі звернення</span>` : ""}${!t.public ? `<span class="from-c">${icon("lock")}${BOARD[b].only}</span>` : ""}</div>` : ""}
    </a>`;
  }

  // ---------- /board ----------
  App.route(
    "/board",
    (ctx) => {
      const tab = ctx.query.tab === "tasks" ? "tasks" : "ann";
      const top = `${App.topbar()}<h2 class="title bd-title">Дошка</h2>${App.seg(
        [
          { href: "/board?tab=ann", label: "Оголошення", on: tab === "ann" },
          { href: "/board?tab=tasks", label: "Завдання", on: tab === "tasks" },
        ],
        "Розділ дошки",
        "",
        "bd-tabs",
      )}`;
      return `<div class="bd">${top}${tab === "ann" ? annTab(ctx) : tasksTab(ctx)}</div>`;
    },
    { tab: "board", title: "Дошка" },
  );

  // ---------- /board/ann/new ----------
  const TIMES = (() => {
    const out = [];
    for (let m = 7 * 60; m <= 23 * 60 + 30; m += 30) out.push(App.time(m));
    return out;
  })();
  const opt = (s) => (s ? `<small class="opt">${s}</small>` : "");
  const OPTIONAL = "необов’язково";

  // the bottom sheet mirrors the form: who will see it, with or without a notification
  function annSheetText(form) {
    const aud =
      form.querySelector(
        '[name="audience"]:checked, input[type="hidden"][name="audience"]',
      )?.value || "all";
    const imp = form.querySelector('[name="important"]')?.checked;
    return {
      small: "Побачать",
      b:
        aud === "squad"
          ? "лише загін"
          : imp
            ? "усі, зі сповіщенням"
            : "усі мешканці",
    };
  }
  function mirrorSheet(root, form, fn) {
    const sheet = root.querySelector(".sheet .sheet-text");
    if (!sheet || !form) return;
    const upd = () => {
      const t = fn(form);
      sheet.innerHTML = `<small>${esc(t.small)}</small><b>${esc(t.b)}</b>`;
    };
    form.addEventListener("change", upd);
    requestAnimationFrame(upd); // after the shell restores typed values
  }

  App.route(
    "/board/ann/new",
    (ctx) => {
      const me = ctx.me;
      const head = App.topbar({ back: "/board?tab=ann" });
      if (!canAnnounce(me)) {
        return `<div class="bd">${head}<h2 class="title">Нове оголошення</h2><div class="glass empty bd-gap"><b>Оголошення публікують студрада, голова оперзагону й розпорядник</b>Студрада й розпорядник пишуть для всіх, голова оперзагону й розпорядник — для загону. Якщо щось важливе для всіх, напишіть звернення до студради.</div><p style="margin:14px 4px"><a class="link" href="#/complaints/new">Написати звернення</a></p></div>`;
      }
      const all = EH.can.announceAll(me);
      const squad = EH.can.announceSquad(me);
      const auds = [
        all && { v: "all", label: "Для всіх" },
        squad && { v: "squad", label: "Для загону" },
      ].filter(Boolean);
      const audField =
        auds.length > 1
          ? `<div><span class="lbl">Хто побачить</span><div class="topics" role="radiogroup" aria-label="Хто побачить">${auds
              .map(
                (x, i) =>
                  `<label class="topic"><input type="radio" name="audience" value="${x.v}"${i === 0 ? " checked" : ""}><span>${icon(x.v === "all" ? "users" : "shield")}${x.label}</span></label>`,
              )
              .join("")}</div></div>`
          : `<input type="hidden" name="audience" value="${auds[0].v}"><div class="route-line">${icon(auds[0].v === "all" ? "users" : "shield")}<span>${auds[0].v === "all" ? "Побачать усі мешканці. Бот повторить оголошення в групі гуртожитку." : "Побачать лише загін і розпорядник. Загін отримає сповіщення."}</span></div>`;
      const important = all
        ? `<label class="glass notify sw-row">
          <span class="notify-ico">${icon("bell")}</span>
          <span class="grow"><b>Важливе — зі сповіщенням</b><p>Прийде тим, хто ввімкнув сповіщення; бот також напише в групу гуртожитку. Оголошення стане першим на дошці.</p></span>
          <input class="sw-input" type="checkbox" name="important" value="1">
          <span class="switch" aria-hidden="true"></span>
        </label>`
        : "";
      const html = `<div class="bd">${head}
        <h2 class="title">Нове оголошення</h2>
        <p class="lede">${all ? "З’явиться на дошці в усіх, хто має застосунок." : "З’явиться на дошці в членів загону."}</p>
        <form data-form="ann-new" id="f-ann" class="bd-form" novalidate>
          <p class="error-note" role="alert" hidden data-err></p>
          <div class="glass form">
            <div class="field-row"><label for="an-title">Заголовок</label><input id="an-title" name="title" required maxlength="120" autocomplete="off" placeholder="${all ? "Збори мешканців" : "Збори загону"}"></div>
            <div class="field-row"><label for="an-details">Подробиці ${opt(OPTIONAL)}</label><textarea class="area" id="an-details" name="details" rows="3" placeholder="Що треба знати й зробити"></textarea></div>
            <div class="field-row"><label for="an-place">Де ${opt(OPTIONAL)}</label><input id="an-place" name="place" autocomplete="off" placeholder="Читальна зала, 1 поверх"></div>
            <div class="bd-two">
              <div class="field-row"><label for="an-date">День</label><select class="select" id="an-date" name="date"><option value="">Без дати</option>${EH.DAYS.map((d) => `<option value="${d.date}">${esc(d.label || `${d.wd}, ${d.d}`)}</option>`).join("")}</select></div>
              <div class="field-row"><label for="an-time">Час</label><select class="select" id="an-time" name="time"><option value="">Без часу</option>${TIMES.map((x) => `<option>${x}</option>`).join("")}</select></div>
            </div>
            ${audField}
          </div>
          ${important}
        </form></div>`;
      const sheet = `<div class="sheet"><div class="sheet-text"><small>Побачать</small><b>${auds[0].v === "squad" ? "лише загін" : "усі мешканці"}</b></div><button class="btn btn-primary" type="submit" form="f-ann">Опублікувати</button></div>`;
      return { html, sheet };
    },
    {
      tab: "board",
      title: "Нове оголошення",
      mount: (root) =>
        mirrorSheet(root, root.querySelector("#f-ann"), annSheetText),
    },
  );

  App.form("ann-new", (data, ctx, form) => {
    const me = ctx.me;
    const err = form.querySelector("[data-err]");
    const title = String(data.title || "").trim();
    if (!title) {
      err.hidden = false;
      err.textContent = "Напишіть заголовок оголошення.";
      form.querySelector("[name=title]").focus();
      return;
    }
    let audience = data.audience === "squad" ? "squad" : "all";
    if (audience === "all" && !EH.can.announceAll(me)) audience = "squad";
    if (audience === "squad" && !EH.can.announceSquad(me)) return;
    if (data.time && !data.date) {
      err.hidden = false;
      err.textContent = "Оберіть день або приберіть час.";
      form.querySelector("[name=date]").focus();
      return;
    }
    const a = EH.actions.announce(me.id, {
      title,
      details: String(data.details || "").trim(),
      place: String(data.place || "").trim(),
      date: data.date || "",
      time: data.date ? data.time || "" : "",
      audience,
      important:
        audience === "all" && EH.can.announceAll(me) && !!data.important,
    });
    ctx.go(`/board/ann/${a.id}`);
  });

  // ---------- /board/ann/:id ----------
  App.route(
    "/board/ann/:id",
    (ctx) => {
      const a = S.announcements.find((x) => String(x.id) === ctx.params.id);
      const head = App.topbar({ back: "/board?tab=ann", title: "Оголошення" });
      if (!a)
        return `<div class="bd">${head}<div class="glass empty"><b>Оголошення не знайшли</b>Можливо, його вже прибрали.</div></div>`;
      if (!canSeeAnn(ctx.me, a))
        return `<div class="bd">${head}<div class="glass empty"><b>Це оголошення для загону</b>Його бачать лише члени оперзагону й розпорядник.</div></div>`;
      return `<div class="bd">${head}
        <article class="glass detail">
          ${a.important || a.audience === "squad" ? `<div class="ann-tags">${a.important ? `<span class="ann-flag">${icon("bell")}Важливе · сповіщення надіслано</span>` : ""}${squadChip(a)}</div>` : ""}
          <h2>${esc(a.title)}</h2>
          ${a.details ? `<p class="ann-body">${esc(a.details)}</p>` : ""}
          ${whenBlock(a)}
        </article>
        <div class="glass facts">
          ${!whenBlock(a) && a.place ? `<div class="fact">${icon("pin")}<div>${esc(a.place)}</div></div>` : ""}
          <div class="fact">${icon(a.audience === "squad" ? "shield" : "users")}<div>${a.audience === "squad" ? "Для загону" : "Для всіх мешканців"}<small>${a.audience === "squad" ? "Бачать лише оперзагін і розпорядник." : "Бот повторив оголошення в групі гуртожитку."}</small></div></div>
          ${a.author ? `<div class="fact">${icon("user")}<div>${authorLine(a.author)}<small>Опубліковано ${esc(a.at)}</small></div></div>` : ""}
        </div>
      </div>`;
    },
    { tab: "board", title: "Оголошення" },
  );

  // ---------- /board/task/new ----------
  const taskSheetText = (form) => {
    const b = form.querySelector('[name="board"]').value;
    return {
      small: `Дошка ${BOARD[b].of}`,
      b: form.querySelector('[name="public"]').checked
        ? "бачать усі мешканці"
        : BOARD[b].only.toLowerCase(),
    };
  };
  App.route(
    "/board/task/new",
    (ctx) => {
      const me = ctx.me;
      const b = BOARD[ctx.query.b] ? ctx.query.b : "council";
      const head = App.topbar({ back: `/board?tab=tasks&b=${b}` });
      if (!EH.can.runBoard(me, b)) {
        return `<div class="bd">${head}<h2 class="title">Нове завдання</h2><div class="glass empty bd-gap"><b>Завдання на цю дошку додає ${BOARD[b].who}</b>Якщо щось зламалось, напишіть звернення — його візьмуть у роботу.</div><p style="margin:14px 4px"><a class="link" href="#/complaints/new">Написати звернення</a></p></div>`;
      }
      const both = Object.keys(BOARD).filter((x) => EH.can.runBoard(me, x));
      const pub = b === "council";
      const html = `<div class="bd">${head}
        <h2 class="title">Нове завдання</h2>
        <p class="lede">${b === "council" ? "Для того, що студрада робить сама, без звернення." : "Для справ загону: перевірки, обходи, ремонт замків."}</p>
        ${
          both.length > 1
            ? App.seg(
                both.map((x) => ({
                  href: `/board/task/new?b=${x}`,
                  label: BOARD[x].label,
                  on: x === b,
                })),
                "Дошка",
                "",
                "bd-tabs",
              )
            : ""
        }
        <form data-form="task-new" id="f-task" class="bd-form" novalidate>
          <input type="hidden" name="board" value="${b}">
          <p class="error-note" role="alert" hidden data-err></p>
          <div class="glass form">
            <div class="field-row"><label for="tn-title">Що треба зробити</label><input id="tn-title" name="title" required maxlength="120" autocomplete="off" placeholder="Замінити лампу на сходах"></div>
            <div class="field-row"><label for="tn-place">Де ${opt(OPTIONAL)}</label><input id="tn-place" name="place" autocomplete="off" placeholder="Сходи, крило А"></div>
            <div class="field-row"><label for="tn-details">Подробиці ${opt(OPTIONAL)}</label><textarea class="area" id="tn-details" name="details" rows="3" placeholder="Що відомо, до кого звертатися"></textarea></div>
          </div>
          <label class="glass notify sw-row">
            <span class="notify-ico">${icon("users")}</span>
            <span class="grow"><b>Показувати всім мешканцям</b><p>${b === "council" ? "Завдання видно на дошці, бот напише в групі гуртожитку." : "Вимкніть, якщо це внутрішня справа загону."}</p></span>
            <input class="sw-input" type="checkbox" name="public" value="1"${pub ? " checked" : ""}>
            <span class="switch" aria-hidden="true"></span>
          </label>
        </form></div>`;
      const sheet = `<div class="sheet"><div class="sheet-text"><small>Дошка ${BOARD[b].of}</small><b>${pub ? "бачать усі мешканці" : BOARD[b].only.toLowerCase()}</b></div><button class="btn btn-primary" type="submit" form="f-task">Додати</button></div>`;
      return { html, sheet };
    },
    {
      tab: "board",
      title: "Нове завдання",
      mount: (root) =>
        mirrorSheet(root, root.querySelector("#f-task"), taskSheetText),
    },
  );

  App.form("task-new", (data, ctx, form) => {
    const me = ctx.me;
    const b = BOARD[data.board] ? data.board : "council";
    if (!EH.can.runBoard(me, b)) return;
    const err = form.querySelector("[data-err]");
    const title = String(data.title || "").trim();
    if (!title) {
      err.hidden = false;
      err.textContent = "Напишіть, що треба зробити.";
      form.querySelector("[name=title]").focus();
      return;
    }
    const t = EH.actions.addTask(me.id, {
      board: b,
      title,
      place: String(data.place || "").trim(),
      details: String(data.details || "").trim(),
      public: !!data.public,
    });
    ctx.go(`/board/task/${t.id}`);
  });

  // ---------- /board/task/:id ----------
  function trackFor(t) {
    const h = t.history; // newest first
    const oldest = (re) => {
      for (let i = h.length - 1; i >= 0; i--)
        if (re.test(h[i].text)) return atDay(h[i].at);
      return "";
    };
    const newest = (re) => {
      const x = h.find((e) => re.test(e.text));
      return x ? atDay(x.at) : "";
    };
    const workAt = oldest(
      /^(Взяли в роботу|В роботі|.+ бере в роботу|.+ долучається)/,
    );
    const doneAt = newest(/^Готово/);
    const st = t.status;
    return App.track(
      [
        { label: EH.TASK_STATUS.new, small: t.createdAt, state: "on" },
        {
          label: EH.TASK_STATUS.in_progress,
          small: st !== "new" ? workAt : "",
          state: st === "in_progress" ? "cur" : st === "done" ? "on" : "",
        },
        {
          label: EH.TASK_STATUS.done,
          small: st === "done" ? doneAt : "",
          state: st === "done" ? "on" : "",
        },
      ],
      "Хід роботи",
    );
  }

  App.route(
    "/board/task/:id",
    (ctx) => {
      const me = ctx.me;
      const t = S.tasks.find((x) => String(x.id) === ctx.params.id);
      if (!t)
        return `<div class="bd">${App.topbar({ back: "/board?tab=tasks", title: "Завдання" })}<div class="glass empty"><b>Завдання не знайшли</b>Можливо, його вже прибрали з дошки.</div></div>`;
      const B = BOARD[t.board];
      const head = App.topbar({
        back: `/board?tab=tasks&b=${t.board}&col=${t.status}`,
        title: `Дошка ${B.of} · №${t.id}`,
      });
      if (!t.public && !seesPrivate(me, t.board)) {
        return `<div class="bd">${head}<div class="glass empty"><b>Це внутрішнє завдання</b>Його бачать лише ${B.who} й розпорядник.</div></div>`;
      }
      const c =
        t.complaintId && S.complaints.find((x) => x.id === t.complaintId);
      const handler = c && EH.can.handleComplaint(me, c);
      const author = c && (c.author === me.id || c.anonOwner === me.id);
      const runs = EH.can.runBoard(me, t.board);
      const members = seesPrivate(me, t.board);
      const names = t.assignees
        .map((id) => EH.person(id)?.name)
        .filter(Boolean);

      let facts = "";
      if (c) {
        facts += `<div class="fact">${icon("chat")}<div>Виникло зі звернення мешканця<small>${author ? "Це ваше звернення. Хто написав, на дошці не показуємо." : "Хто написав, на дошці не показуємо."}</small>${
          handler
            ? `<a class="link fact-link" href="#/complaints/${c.id}">Відкрити звернення${icon("chev", true)}</a>`
            : author
              ? `<a class="link fact-link" href="#/complaints/${c.id}">Ваше звернення${icon("chev", true)}</a>`
              : ""
        }</div></div>`;
      } else {
        facts += `<div class="fact">${icon("board")}<div>${t.board === "squad" ? "Оперзагін додав завдання сам" : "Студрада додала завдання сама"}<small>Не зі звернення мешканця.</small></div></div>`;
      }
      facts += `<div class="fact">${icon("users")}<div>Займається ${B.who}${members && names.length ? `<small>${names.map(esc).join(", ")}</small>` : !names.length ? `<small>Поки ніхто не взяв.</small>` : ""}</div></div>`;
      if (!t.public)
        facts += `<div class="fact">${icon("lock")}<div>${B.only}<small>Мешканці цього завдання не бачать.</small></div></div>`;

      let manage = "";
      if (runs) {
        const mine = t.assignees.includes(me.id);
        const btns = [];
        // a new task has one way forward: take it, which assigns the person and starts the work
        if (t.status === "new")
          btns.push(
            `<button class="btn btn-primary block" type="submit" name="status" value="in_progress">${icon("user", true)}Взяти в роботу</button>`,
          );
        if (t.status === "done")
          btns.push(
            `<button class="btn btn-soft block" type="submit" name="status" value="in_progress">Знову в роботу</button>`,
          );
        if (t.status === "in_progress")
          btns.push(
            `<button class="btn btn-primary block" type="submit" name="status" value="done">${icon("check", true)}Готово</button>`,
          );
        manage = `<div class="section-h"><h3>Керування</h3></div>
          ${!mine && t.status === "in_progress" ? `<button class="btn btn-soft block bd-take" type="button" data-act="take-task" data-id="${t.id}">${icon("user", true)}Взяти собі</button>` : ""}
          <form data-form="task-status" class="glass form bd-manage">
            <input type="hidden" name="id" value="${t.id}">
            <div class="field-row"><label for="ts-note">Що змінилось <small class="opt">необов’язково</small></label><input id="ts-note" name="note" autocomplete="off" placeholder="Майстер прийде в понеділок"><small>${c && t.status === "in_progress" ? "«Готово» позначить звернення вирішеним, а автор отримає сповіщення." : "Запис з’явиться в історії завдання."}</small></div>
            <div class="actions bd-actions${btns.length === 1 ? " one" : ""}">${btns.join("")}</div>
            ${t.status !== "new" ? `<button class="link bd-back" type="submit" name="status" value="new">Повернути в «${EH.TASK_STATUS.new}»</button>` : ""}
          </form>`;
      }

      return `<div class="bd">${head}
        <article class="glass detail">
          <div class="card-top">${App.status(t.status)}${!t.public ? `<span class="from-c" style="margin:0">${icon("lock")}${B.only}</span>` : ""}</div>
          <h2>${esc(t.title)}</h2>
          ${t.place ? `<div class="meta"><span>${icon("pin")}${esc(t.place)}</span><span>${age(t.createdAt) === "сьогодні" ? "додано сьогодні" : `додано ${esc(t.createdAt)}`}</span></div>` : ""}
          ${t.details ? `<p class="detail-body">${esc(t.details)}</p>` : ""}
          ${trackFor(t)}
        </article>
        <div class="glass facts">${facts}</div>
        ${manage}
        <div class="section-h"><h3>Що відбувалося</h3></div>
        <ol class="log${t.status === "in_progress" ? " live" : ""}">${t.history.map((e) => `<li><time>${esc(e.at)}</time>${esc(e.text)}</li>`).join("")}</ol>
      </div>`;
    },
    { tab: "board", title: "Завдання" },
  );

  App.act("take-task", (el, ctx) => {
    const t = S.tasks.find((x) => x.id === Number(el.dataset.id));
    if (!t || t.status !== "in_progress" || !EH.can.runBoard(ctx.me, t.board))
      return;
    if (!t.assignees.includes(ctx.me.id)) EH.actions.takeTask(t.id, ctx.me.id);
  });

  App.form("task-status", (data, ctx) => {
    const t = S.tasks.find((x) => x.id === Number(data.id));
    if (!t || !EH.can.runBoard(ctx.me, t.board)) return;
    const status = ["new", "in_progress", "done"].includes(data.status)
      ? data.status
      : null;
    if (!status || status === t.status) return;
    const note = String(data.note || "").trim();
    // taking a new task assigns the person and writes one line in its history
    if (t.status === "new" && status === "in_progress")
      EH.actions.startTask(t.id, ctx.me.id, note);
    else EH.actions.setTaskStatus(t.id, ctx.me.id, status, note);
    const field = document.querySelector(
      'form[data-form="task-status"] [name="note"]',
    );
    if (field) field.value = "";
  });
})();
