/*
 * Звернення: the new-complaint form, one complaint (author's and handler's
 * views) and the handler inbox. Everyone is a resident and can write; only
 * the people whose role covers the recipient (council, squad, or the site
 * manager for the app team) can read and work on someone else's complaint.
 */
(function () {
  const { esc, icon } = App;
  const EH = App.EH;
  const S = App.S;

  const GROUPS = ["council", "squad", "team"];
  // App complaints go to the person with the розпорядник role, so the recipient is named after the role.
  const RC = EH.RECIPIENTS;
  const GROUP_LABEL = {
    council: "Студрада",
    squad: "Оперзагін",
    team: "Розпорядник",
  };
  const INBOX_TITLE = {
    council: "Звернення до студради",
    squad: "Звернення до оперзагону",
    team: "Звернення про застосунок",
  };
  // Complaints about people: kept off the public board unless the handler decides otherwise.
  const ABOUT_PEOPLE = new Set(["noise", "strangers", "safety", "rules"]);
  const WEEKLY_ANON = 3;
  const REVIEW = EH.COMPLAINT_STATUS.review;
  const recipients = "Студрада, оперзагін і розпорядник";

  // per-phone screen state (each phone runs its own copy of this module)
  const ui = { newErr: "", rejectOpen: {}, rejectErr: {}, flash: "" };

  // ---------- helpers ----------
  const topicOf = (c) =>
    EH.TOPICS.find((t) => t.id === c.topic) || {
      id: c.topic,
      label: "Інше",
      icon: "dots",
      to: c.to,
    };
  const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
  // one title on every screen: the task title once there is a task, otherwise «Тема: місце»
  const titleOf = App.complaintTitle;
  const draftTitle = (c) => {
    const t = topicOf(c);
    return c.place ? `${t.label}: ${lowerFirst(c.place)}` : t.label;
  };
  const status = App.status;
  // the shared clock writes «13:41» for things that happen during the demo
  const stamp = (at) =>
    /^\d{1,2}:\d\d$/.test(at || "") ? `сьогодні, ${at}` : at || "";
  const dayOf = (at) => stamp(at).split(",")[0];
  const findC = (id) => S.complaints.find((x) => x.id === Number(id));
  const isAuthor = (c, me) => c.author === me.id || c.anonOwner === me.id;
  const isOpen = (c) => c.status === "sent" || c.status === "review";
  const isClosed = (c) => c.status === "resolved" || c.status === "rejected";
  const handledGroups = (me) =>
    GROUPS.filter((g) => EH.can.handleComplaint(me, { to: g }));
  const ticketsLeft = (me) => EH.state.anonTickets[me.id] ?? WEEKLY_ANON;
  const anonCount = (n) => {
    const m10 = n % 10,
      m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return `${n} анонімне звернення`;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14))
      return `${n} анонімні звернення`;
    return `${n} анонімних звернень`;
  };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  function backBar(href, title) {
    return `<div class="topbar"><a class="icon-btn" href="#${esc(href)}" aria-label="Назад">${icon("back")}</a>${title ? `<span class="bar-title">${esc(title)}</span>` : ""}<span style="width:44px"></span></div>`;
  }

  function tickets(left) {
    const pips = Array.from(
      { length: WEEKLY_ANON },
      (_, i) => `<i${i < left ? ' class="on"' : ""}></i>`,
    ).join("");
    const text = left
      ? `Лишилось ${anonCount(left)} з ${WEEKLY_ANON} цього тижня`
      : "Цього тижня анонімних звернень більше немає";
    return `<div class="tickets" role="img" aria-label="${esc(text)}"><span class="pips" aria-hidden="true">${pips}</span><span>${esc(text)}</span></div>`;
  }

  // reset screen state when leaving a screen
  window.addEventListener("hashchange", () => {
    const path = (location.hash.replace(/^#/, "") || "/").split("?")[0];
    if (path !== "/complaints/new") ui.newErr = "";
    if (path !== "/inbox") ui.flash = "";
    if (!/^\/complaints\/\d+$/.test(path)) {
      ui.rejectOpen = {};
      ui.rejectErr = {};
    }
  });

  // ======================================================================
  // /complaints/new
  // ======================================================================
  App.route(
    "/complaints/new",
    (ctx) => {
      const me = ctx.me;
      const pre = EH.TOPICS.find((t) => t.id === ctx.query.topic);
      const left = ticketsLeft(me);
      const back = ctx.query.from === "home" ? "/" : "/me";

      const groups = GROUPS.map((g) => {
        const list = EH.TOPICS.filter((t) => t.to === g);
        return `<div class="to-group"><small id="tg-${g}">${GROUP_LABEL[g]}</small><div class="topics" role="radiogroup" aria-labelledby="tg-${g}">${list
          .map(
            (t) =>
              `<label class="topic"><input type="radio" name="topic" value="${t.id}" data-to="${t.to}"${pre && pre.id === t.id ? " checked" : ""}><span>${icon(t.icon)}${esc(t.label)}</span></label>`,
          )
          .join("")}</div></div>`;
      }).join("");

      const html = `
      <div class="topbar"><a class="icon-btn" href="#${back}" data-act="c-back" data-fallback="${back}" aria-label="Назад">${icon("back")}</a><span style="width:44px"></span></div>
      <h2 class="title" data-c-title>Нове звернення</h2>
      <p class="lede">Оберіть тему — звернення саме дійде до тих, хто це вирішує.</p>

      <div class="anon-mark" data-anon-only hidden>
        <span class="mask">${icon("mask")}</span>
        <span><b>Без імені й кімнати</b><span data-anon-mark-who>${pre ? `${esc(cap(RC[pre.to].label))} не побачить` : `${recipients} не побачать`}, хто написав. Це одне з ${WEEKLY_ANON} анонімних звернень на тиждень.</span></span>
      </div>

      <form class="c-new" id="c-new" data-form="c-new" novalidate>
        <div class="glass form-block">
          <div class="lbl">Про що</div>
          ${groups}
        </div>

        <div class="glass form-block">
          <div class="field-row">
            <label for="c-place">Де саме <span class="opt">необов’язково</span></label>
            <input id="c-place" name="place" maxlength="80" autocomplete="off" placeholder="Кухня, 3 поверх" aria-describedby="c-place-help">
            <small id="c-place-help" data-place-help>Поверх, кімната чи місце, щоб одразу знайти.</small>
          </div>
          <div class="field-row">
            <label for="c-body">Що сталося</label>
            <textarea class="area" id="c-body" name="body" maxlength="1000" placeholder="Що не так і відколи" aria-describedby="c-count c-photo-later"></textarea>
            <span class="count" id="c-count" data-count aria-live="off">0 / 1000</span>
            <small id="c-photo-later">Фото можна буде додати згодом.</small>
          </div>
        </div>

        <div class="glass form-block who-sees">
          <div class="lbl" id="c-who-l">Хто знатиме, що це ви</div>
          <div class="seg c-anon" role="radiogroup" aria-labelledby="c-who-l">
            <span class="pill" aria-hidden="true"></span>
            <label data-pill-item><input type="radio" name="anon" value="0" checked><span>З іменем</span></label>
            <label data-pill-item><input type="radio" name="anon" value="1"${left ? "" : " disabled"}><span>Анонімно</span></label>
          </div>
          <ul class="promise" data-show="named">
            <li>${icon("user")}<span data-named-who>${pre ? esc(cap(RC[pre.to].label)) : "Отримувач"} бачить ваше ім’я й кімнату ${esc(me.room)} і може уточнити деталі.</span></li>
            <li>${icon("bell")}<span>Сповіщення, коли звернення розглянуть, візьмуть у роботу й вирішать.</span></li>
            <li>${icon("eye-off")}<span>На дошці ваше ім’я не показується нікому.</span></li>
            <li data-squad-only${pre && pre.to === "squad" ? "" : " hidden"}>${icon("chat")}<span>Текст звернення до оперзагону також надходить у чат загону в Телеграмі.</span></li>
          </ul>
          <ul class="promise" data-show="anon" hidden>
            <li>${icon("lock")}<span data-anon-who>${pre ? `${esc(cap(RC[pre.to].label))} не побачить` : `${recipients} не побачать`} вашого імені й кімнати.</span></li>
            <li class="warn">${icon("alert")}<span>Сповіщень не буде: статус і відповіді видно лише на цьому телефоні, у «Моє».</span></li>
            <li class="warn">${icon("alert")}<span>Не пишіть того, що вас видає: номер своєї кімнати, ім’я, «мій сусід».</span></li>
            <li data-squad-only${pre && pre.to === "squad" ? "" : " hidden"}>${icon("chat")}<span>Текст звернення до оперзагону також надходить у чат загону в Телеграмі, без вашого імені.</span></li>
          </ul>
          ${left ? `<div data-show="anon" hidden>${tickets(left)}</div>` : tickets(left)}
          ${left ? "" : `<p class="c-hint">Наступні анонімні звернення з’являться з початком нового тижня. З іменем можна писати завжди.</p>`}
        </div>

        <div class="c-submit-note">
          ${ui.newErr ? `<p class="error-note" role="alert">${esc(ui.newErr)}</p>` : ""}
          <p class="c-hint" data-submit-note>Відповісти мають протягом 2 днів.</p>
        </div>
      </form>`;
      const sheet = `<div class="sheet c-new-sheet"><div class="sheet-text" aria-live="polite"><small data-route-l>Отримає</small><b data-route>${pre ? esc(RC[pre.to].label) : "оберіть тему"}</b></div><button class="btn btn-primary" type="submit" form="c-new" data-submit>Надіслати</button></div>`;
      return { html, sheet };
    },
    {
      tab: "me",
      title: "Нове звернення",
      mount(root) {
        const form = root.querySelector("#c-new");
        if (!form) return;
        const seg = form.querySelector(".c-anon");
        const pill = seg.querySelector(".pill");
        const count = form.querySelector("[data-count]");
        const body = form.elements.body;

        const placePill = () => {
          const on = [...seg.querySelectorAll("label")].find(
            (l) => l.querySelector("input").checked,
          );
          if (!on) return;
          pill.style.width = on.offsetWidth + "px";
          pill.style.height = on.offsetHeight + "px";
          pill.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
          seg
            .querySelectorAll("label")
            .forEach((l) => l.toggleAttribute("data-pill-on", l === on));
        };
        const sync = () => {
          const checked = form.querySelector("input[name=topic]:checked");
          const to = checked?.dataset.to;
          const anon =
            form.querySelector("input[name=anon]:checked")?.value === "1";
          const who = to
            ? `${cap(RC[to].label)} не побачить`
            : `${recipients} не побачать`;
          root.querySelector("[data-route]").textContent = to
            ? RC[to].label
            : "оберіть тему";
          root.querySelector("[data-route-l]").textContent = anon
            ? "Отримає анонімно"
            : "Отримає";
          root.querySelector("[data-submit]").textContent = anon
            ? "Надіслати анонімно"
            : "Надіслати";
          form
            .querySelectorAll("[data-show]")
            .forEach(
              (u) => (u.hidden = u.dataset.show !== (anon ? "anon" : "named")),
            );
          form
            .querySelectorAll("[data-squad-only]")
            .forEach((u) => (u.hidden = to !== "squad"));
          root.querySelector("[data-anon-only]").hidden = !anon;
          root.querySelector("[data-c-title]").textContent = anon
            ? "Анонімне звернення"
            : "Нове звернення";
          root.querySelector("[data-anon-mark-who]").textContent =
            `${who}, хто написав. Це одне з ${WEEKLY_ANON} анонімних звернень на тиждень.`;
          form.querySelector("[data-anon-who]").textContent =
            `${who} вашого імені й кімнати.`;
          form.querySelector("[data-place-help]").textContent = anon
            ? "Поверх чи місце, без номера своєї кімнати."
            : "Поверх, кімната чи місце, щоб одразу знайти.";
          form.querySelector("[data-submit-note]").textContent = anon
            ? "Відповідь з’явиться тут, на цьому телефоні, у «Моє»."
            : "Відповісти мають протягом 2 днів.";
          form.querySelector("[data-named-who]").textContent =
            `${to ? cap(RC[to].label) : "Отримувач"} бачить ваше ім’я й кімнату ${App.me().room} і може уточнити деталі.`;
          count.textContent = `${body.value.length} / ${body.maxLength}`;
          placePill();
          clearErr();
        };
        const clearErr = () => {
          if (
            !ui.newErr ||
            !form.querySelector("input[name=topic]:checked") ||
            !body.value.trim()
          )
            return;
          ui.newErr = "";
          form.querySelector(".c-submit-note .error-note")?.remove();
        };

        seg.classList.add("has-pill");
        form.addEventListener("change", sync);
        body.addEventListener("input", () => {
          count.textContent = `${body.value.length} / ${body.maxLength}`;
          clearErr();
        });
        sync();
        // typed values come back right after a shared-data re-render; follow them
        queueMicrotask(sync);
        requestAnimationFrame(() => pill.classList.add("pill-ready"));
      },
    },
  );

  App.act("c-back", (el, ctx) => ctx.back(el.dataset.fallback || "/me"));

  App.form("c-new", (data, ctx) => {
    const me = ctx.me;
    const body = (data.body || "").trim();
    const topic = EH.TOPICS.find((t) => t.id === data.topic);
    if (!topic && !body) ui.newErr = "Оберіть тему й опишіть, що сталося.";
    else if (!topic)
      ui.newErr = "Оберіть тему — від неї залежить, хто отримає звернення.";
    else if (!body) ui.newErr = "Опишіть, що сталося.";
    else ui.newErr = "";
    if (ui.newErr) {
      App.rerender();
      document
        .querySelector(".c-submit-note .error-note")
        ?.scrollIntoView({ block: "center" });
      return;
    }
    const anon = data.anon === "1" && ticketsLeft(me) > 0;
    const c = EH.actions.complain(me.id, {
      topic: topic.id,
      place: (data.place || "").trim(),
      body,
      anon,
    });
    ctx.go(`/complaints/${c.id}`, { replace: true });
  });

  // ======================================================================
  // /complaints/:id
  // ======================================================================
  function trackOf(c) {
    const created = dayOf(c.createdAt);
    const firstReply = c.messages.find((m) => m.from !== "author");
    // the latest matching line: a reopened complaint has two «в роботі» and maybe two «Вирішено»
    const sysAt = (re) =>
      c.messages.findLast((m) => m.from === "system" && re.test(m.text))?.at;
    const reviewed = firstReply ? dayOf(firstReply.at) : "";
    const tookAt = sysAt(/в роботу|^Знову в роботі/);
    const doneAt = sysAt(/^Вирішено/);
    const s = c.status;
    if (s === "rejected") {
      return App.track(
        [
          { label: EH.COMPLAINT_STATUS.sent, small: created, state: "on" },
          { label: REVIEW, small: reviewed, state: "on" },
          {
            label: EH.COMPLAINT_STATUS.rejected,
            small: dayOf(sysAt(/^Відхилено/)),
            state: "end-no",
          },
        ],
        "Хід звернення",
      );
    }
    const order = ["sent", "review", "work", "resolved"];
    const i = order.indexOf(s);
    return App.track(
      [
        { label: EH.COMPLAINT_STATUS.sent, small: created, state: "on" },
        {
          label: REVIEW,
          small: i >= 1 ? (i === 1 ? "зараз" : reviewed) : "",
          state: i === 1 ? "cur" : i > 1 ? "on" : "",
        },
        {
          label: EH.COMPLAINT_STATUS.work,
          small: i >= 2 ? (tookAt ? `з ${dayOf(tookAt)}` : "") : "",
          state: i === 2 ? "cur" : i > 2 ? "on" : "",
        },
        {
          label: EH.COMPLAINT_STATUS.resolved,
          small: i === 3 ? dayOf(doneAt) : "",
          state: i === 3 ? "on" : "",
        },
      ],
      "Хід звернення",
    );
  }

  function thread(c, me, asAuthor) {
    const rc = RC[c.to];
    if (!c.messages.length) {
      return `<div class="thread"><p class="sys">${asAuthor ? `Поки без відповіді. ${cap(rc.label)} має відповісти протягом 2 днів.` : "Повідомлень ще немає. Якщо чогось бракує, уточніть в автора."}</p></div>`;
    }
    const rows = c.messages.map((m) => {
      const at = `<time>${esc(stamp(m.at))}</time>`;
      if (m.from === "system")
        return `<p class="sys">${esc(m.text)} · ${esc(stamp(m.at))}</p>`;
      if (asAuthor) {
        if (m.from === "author")
          return `<div class="msg own">${esc(m.text)}${at}</div>`;
        const who = EH.person(m.who);
        return `<div class="msg them"><small>${esc(who ? `${who.first}, ${rc.label}` : cap(rc.label))}</small>${esc(m.text)}${at}</div>`;
      }
      if (m.from === "handler" && m.who === me.id)
        return `<div class="msg own">${esc(m.text)}${at}</div>`;
      if (m.from === "handler") {
        const who = EH.person(m.who);
        return `<div class="msg them"><small>${esc(who ? `${who.first}, ${rc.label}` : cap(rc.label))}</small>${esc(m.text)}${at}</div>`;
      }
      const author = c.author && EH.person(c.author);
      return `<div class="msg them"><small>${esc(author ? `${author.first}, автор` : "Автор, анонімно")}</small>${esc(m.text)}${at}</div>`;
    });
    return `<div class="thread">${rows.join("")}</div>`;
  }

  function composer(c, placeholder) {
    return `<div class="sheet compose"><form class="composer" data-form="c-reply" data-id="${c.id}" autocomplete="off">
      <input name="text" maxlength="600" aria-label="${esc(placeholder)}" placeholder="${esc(placeholder)}">
      <button class="send" type="submit" aria-label="Надіслати">${icon("send")}</button>
    </form></div>`;
  }

  function rejectReason(c) {
    if (c.status !== "rejected" || !c.rejectReason) return "";
    return `<div class="glass rules c-reason"><div class="rule">${icon("info")}<span><b>Чому відхилили</b>${esc(c.rejectReason)}</span></div></div>`;
  }

  function authorView(ctx, c) {
    const me = ctx.me;
    const t = topicOf(c);
    const rc = RC[c.to];
    const task = c.taskId && S.tasks.find((x) => x.id === c.taskId);
    const onBoard = task
      ? task.public
        ? `<a class="glass on-board" href="#/board/task/${task.id}">${icon("board")}<span><small>Усі бачать на дошці, без вашого імені</small><b>${esc(task.title)}</b></span>${icon("chev", true)}</a>`
        : `<p class="empty-note">${icon("lock", true)}<span>На дошці цього немає: справу веде ${esc(rc.label)} без розголосу.</span></p>`
      : "";
    const closed = isClosed(c)
      ? `<a class="btn btn-soft block c-again" href="#/complaints/new?topic=${esc(c.topic)}">${icon("plus", true)}Нове звернення на цю тему</a>`
      : "";
    const html = `
      ${backBar("/me", `Звернення №${c.id}`)}
      <article class="c-doc">
        <svg class="porthole" aria-hidden="true"><use href="#porthole"/></svg>
        <div class="c-doc-top"><span>Кому: <b>${esc(rc.dative)}</b></span><span>${esc(stamp(c.createdAt))}</span></div>
        ${titleOf(c) === t.label || titleOf(c).startsWith(`${t.label}:`) ? "" : `<div class="c-doc-topic">${icon(t.icon, true)}${esc(t.label)}</div>`}
        <h2>${esc(titleOf(c))}</h2>
        <p>${esc(c.body)}</p>
        ${trackOf(c)}
      </article>
      ${c.anon ? `<p class="c-anon-note">${icon("mask", true)}Анонімне · видно лише на цьому телефоні</p>` : ""}
      ${rejectReason(c)}
      ${onBoard}
      <div class="section-h"><h3>Листування</h3></div>
      ${thread(c, me, true)}
      ${closed}`;
    return isClosed(c)
      ? html
      : { html, sheet: composer(c, `Відповісти ${rc.dative}`) };
  }

  function handlerView(ctx, c) {
    const me = ctx.me;
    const t = topicOf(c);
    const rc = RC[c.to];
    const author = c.author && EH.person(c.author);
    const task = c.taskId && S.tasks.find((x) => x.id === c.taskId);
    const multi = handledGroups(me).length > 1;
    const pubDefault = !ABOUT_PEOPLE.has(c.topic);
    const who = author
      ? `<span class="who-av" aria-hidden="true">${esc(author.initials)}</span><span><b>${esc(author.name)}</b>кімната ${esc(author.room)}${author.tg ? ` · <a href="https://t.me/${esc(author.tg)}" target="_blank" rel="noopener">@${esc(author.tg)}</a>` : ""}</span>`
      : `<span class="who-av" aria-hidden="true">${icon("mask", true)}</span><span><b>Анонімне — автор невідомий</b>Відповідь побачить лише на своєму телефоні, без сповіщення.</span>`;

    const card = `
      <article class="glass review-card">
        <div class="card-top"><span class="c-topic">${icon(t.icon, true)}${esc(t.label)}</span>${status(c.status)}</div>
        <blockquote>${esc(c.body)}</blockquote>
        <div class="meta">${c.place ? `<span>${icon("pin")}${esc(c.place)}</span>` : ""}<span>${icon("clock")}${esc(stamp(c.createdAt))}</span>${c.overdue && isOpen(c) ? `<span class="overdue">2 дні без відповіді</span>` : ""}${multi ? `<span>${icon("inbox")}${GROUP_LABEL[c.to]}</span>` : ""}</div>
        <div class="author">${who}</div>
      </article>`;

    let work = "";
    if (isOpen(c)) {
      const other = c.to === "squad" ? "council" : "squad";
      const reject = ui.rejectOpen[c.id]
        ? `<form class="glass form-block c-reject" data-form="c-reject" data-id="${c.id}" novalidate>
            <div class="field-row">
              <label for="c-reason">Чому відхиляєте</label>
              <textarea class="area" id="c-reason" name="reason" maxlength="500" placeholder="Наприклад: це вирішує адміністрація гуртожитку, не студрада"></textarea>
              <small>Автор побачить це пояснення${c.anon ? " на своєму телефоні" : " й отримає сповіщення"}.</small>
            </div>
            ${ui.rejectErr[c.id] ? `<p class="error-note" role="alert">${esc(ui.rejectErr[c.id])}</p>` : ""}
            <div class="actions"><button class="btn btn-soft" type="button" data-act="c-reject-cancel" data-id="${c.id}">Скасувати</button><button class="btn btn-primary" type="submit">Відхилити</button></div>
          </form>`
        : `<button class="btn btn-soft block c-reject-open" type="button" data-act="c-reject-open" data-id="${c.id}">${icon("x", true)}Відхилити з поясненням</button>`;
      const takeForm =
        c.to === "team"
          ? `<form class="glass publish" data-form="c-take" data-id="${c.id}" autocomplete="off">
            <p class="c-hint c-take-note">Звернення про застосунок на дошку не потрапляє: його ведете ви тут, а автор бачить хід${c.anon ? " на своєму телефоні" : " і отримує сповіщення"}.</p>
            <button class="btn btn-primary block" type="submit">Взяти в роботу</button>
          </form>`
          : `
        <form class="glass publish" data-form="c-take" data-id="${c.id}" autocomplete="off">
          <div class="field-row">
            <label for="c-title">Як це побачать на дошці</label>
            <input id="c-title" name="title" maxlength="90" value="${esc(draftTitle(c))}" aria-describedby="c-pub-help">
          </div>
          <div class="field-row">
            <label for="c-details">Подробиці для дошки <span class="opt">необов’язково</span></label>
            <textarea class="area c-details" id="c-details" name="details" maxlength="500" placeholder="${ABOUT_PEOPLE.has(c.topic) ? "Без імен, кімнат і прикмет людей" : "Що зламано й що вже зробили"}" aria-describedby="c-pub-help"></textarea>
            <small id="c-pub-help" data-pub-help>${esc(pubHelp(c, pubDefault, true))}</small>
          </div>
          <div class="check-row"><span id="c-pub-l">Показувати на дошці</span><button type="button" class="switch" role="switch" aria-checked="${pubDefault}" aria-labelledby="c-pub-l" data-act="c-public"></button><input type="hidden" name="public" value="${pubDefault ? "1" : "0"}" data-keep></div>
          <button class="btn btn-primary block" type="submit">Взяти в роботу</button>
        </form>`;
      work = `
        ${takeForm}
        <div class="act-grid${c.to === "team" ? " one" : ""}">
          <button class="btn btn-soft" type="button" data-act="c-ask">${icon("chat", true)}Уточнити</button>
          ${c.to === "team" ? "" : `<button class="btn btn-soft" type="button" data-act="c-transfer" data-id="${c.id}">${icon("swap", true)}Передати ${RC[other].dative}</button>`}
        </div>
        ${reject}`;
    } else if (c.to === "team" && c.status === "work") {
      // no board task: the розпорядник closes it right here
      work = `<form class="glass form-block c-resolve" data-form="c-resolve" data-id="${c.id}" autocomplete="off">
          <div class="field-row">
            <label for="c-done-note">Що зробили <span class="opt">необов’язково</span></label>
            <input id="c-done-note" name="note" maxlength="200" placeholder="Виправили в оновленні">
            <small>Автор побачить це${c.anon ? " на своєму телефоні" : " й отримає сповіщення"}.</small>
          </div>
          <button class="btn btn-primary block" type="submit">${icon("check", true)}${EH.COMPLAINT_STATUS.resolved}</button>
        </form>`;
    } else if (task) {
      work = `<a class="glass on-board" href="#/board/task/${task.id}">${icon("board")}<span><small>${task.public ? "Завдання на дошці" : `Завдання бачить лише ${esc(rc.label)}`}</small><b>${esc(task.title)}</b></span>${status(task.status)}</a>`;
    }

    const html = `
      ${backBar("/inbox", `Звернення №${c.id}`)}
      ${card}
      ${rejectReason(c)}
      ${work}
      <div class="section-h"><h3>Листування з автором</h3></div>
      ${thread(c, me, false)}`;
    return isClosed(c) ? html : { html, sheet: composer(c, "Написати автору") };
  }

  App.route(
    "/complaints/:id",
    (ctx) => {
      const me = ctx.me;
      const c = findC(ctx.params.id);
      if (!c) {
        return `${backBar("/me", "")}<div class="glass empty"><b>Звернення не знайдено</b>Можливо, посилання застаріло.</div>`;
      }
      if (isAuthor(c, me)) return authorView(ctx, c);
      if (EH.can.handleComplaint(me, c)) return handlerView(ctx, c);
      return `${backBar("/me", "")}<div class="glass empty c-not-yours">${icon("lock")}<b>Це звернення вам не адресоване</b>Його бачать лише автор і ${esc(RC[c.to].label)}. Своє звернення можна надіслати з «Моє».</div>
      <a class="btn btn-soft block" href="#/complaints/new" style="margin-top:12px">Нове звернення</a>`;
    },
    {
      tab: "me",
      title: "Звернення",
      mount(root, ctx) {
        const me = ctx.me;
        const c = findC(ctx.params.id);
        if (!c) return;
        const pub = root.querySelector("input[name=public]");
        if (pub) queueMicrotask(() => syncPublic(root));
        // someone else may have closed or taken the complaint while the reject form was open
        if (!isOpen(c)) {
          delete ui.rejectOpen[c.id];
          delete ui.rejectErr[c.id];
        }
        const reason = root.querySelector("#c-reason");
        if (ui.rejectOpen[c.id] && reason && !reason.value) reason.focus();
        // opening the complaint marks it read; a handler opening a new one starts the review
        setTimeout(() => {
          if (isAuthor(c, me)) {
            if (c.unread[me.id]) EH.actions.markRead(c.id, me.id);
            return;
          }
          if (!EH.can.handleComplaint(me, c)) return;
          if (c.status === "sent") EH.actions.review(c.id, me.id);
          else if (c.unread[c.to]) EH.actions.markRead(c.id, c.to);
        });
      },
    },
  );

  // says exactly what the task will show, and to whom
  function pubHelp(c, on, first) {
    const rc = RC[c.to];
    if (!on) {
      return first && ABOUT_PEOPLE.has(c.topic)
        ? `Скарги на людей краще не виносити на дошку: завдання бачитиме лише ${rc.label}.`
        : `Завдання бачитиме лише ${rc.label}, на дошці його не буде.`;
    }
    const place = c.place ? `, місце «${c.place}»` : "";
    return `Усі мешканці побачать заголовок${place}, ці подробиці й хід роботи. Текст звернення, ім’я й кімната автора на дошку не потрапляють.`;
  }

  function syncPublic(root) {
    const pub = root.querySelector("input[name=public]");
    const sw = root.querySelector("[data-act=c-public]");
    if (!pub || !sw) return;
    const on = pub.value === "1";
    sw.setAttribute("aria-checked", String(on));
    const c = findC(root.querySelector("[data-form=c-take]").dataset.id);
    if (c)
      root.querySelector("[data-pub-help]").textContent = pubHelp(c, on, false);
  }

  App.act("c-public", (el) => {
    const root = el.closest("form");
    const pub = root.querySelector("input[name=public]");
    pub.value = pub.value === "1" ? "0" : "1";
    syncPublic(document);
  });

  App.act("c-ask", () => {
    const input = document.querySelector(".composer input");
    if (!input) return;
    input.focus();
    if (!input.value) input.value = "Уточніть, будь ласка, ";
    input.setSelectionRange(input.value.length, input.value.length);
  });

  App.act("c-transfer", (el, ctx) => {
    const c = findC(el.dataset.id);
    if (
      !c ||
      !EH.can.handleComplaint(ctx.me, c) ||
      !isOpen(c) ||
      c.to === "team"
    )
      return;
    const to = c.to === "squad" ? "council" : "squad";
    ui.flash = `Звернення №${c.id} передано ${RC[to].dative}. Автор отримає сповіщення.`;
    ctx.go("/inbox");
    EH.actions.transfer(c.id, ctx.me.id);
  });

  App.act("c-reject-open", (el) => {
    ui.rejectOpen[el.dataset.id] = true;
    App.rerender();
  });
  App.act("c-reject-cancel", (el) => {
    delete ui.rejectOpen[el.dataset.id];
    delete ui.rejectErr[el.dataset.id];
    App.rerender();
  });

  App.form("c-reject", (data, ctx, form) => {
    const c = findC(form.dataset.id);
    if (!c || !EH.can.handleComplaint(ctx.me, c) || !isOpen(c)) return;
    const reason = (data.reason || "").trim();
    if (!reason) {
      ui.rejectErr[c.id] = "Напишіть пояснення: без нього відхилити не можна.";
      App.rerender();
      return;
    }
    delete ui.rejectOpen[c.id];
    delete ui.rejectErr[c.id];
    EH.actions.reject(c.id, ctx.me.id, reason);
    window.scrollTo(0, 0);
  });

  App.form("c-take", (data, ctx, form) => {
    const c = findC(form.dataset.id);
    if (!c || !EH.can.handleComplaint(ctx.me, c) || !isOpen(c)) return;
    const title = (data.title || "").trim() || draftTitle(c);
    const details = (data.details || "").trim();
    // the board gets only what the handler wrote, never the author's own text
    const task = EH.actions.take(
      c.id,
      ctx.me.id,
      title,
      data.public === "1",
      details,
    );
    // a complaint about the app has no board task: stay on the complaint, now «В роботі»
    if (task) ctx.go(`/board/task/${task.id}`);
    else window.scrollTo(0, 0);
  });

  App.form("c-resolve", (data, ctx, form) => {
    const c = findC(form.dataset.id);
    if (
      !c ||
      !EH.can.handleComplaint(ctx.me, c) ||
      c.status !== "work" ||
      c.taskId
    )
      return;
    EH.actions.resolve(c.id, ctx.me.id, (data.note || "").trim());
    window.scrollTo(0, 0);
  });

  App.form("c-reply", (data, ctx, form) => {
    const c = findC(form.dataset.id);
    const text = (data.text || "").trim();
    const input = form.querySelector("input[name=text]");
    if (!c || !text) {
      input?.focus();
      return;
    }
    if (!isAuthor(c, ctx.me) && !EH.can.handleComplaint(ctx.me, c)) return;
    if (isClosed(c)) return;
    input.value = "";
    EH.actions.reply(c.id, ctx.me.id, text);
    window.scrollTo(0, document.documentElement.scrollHeight);
  });

  // ======================================================================
  // /inbox
  // ======================================================================
  const BUCKETS = [
    { id: "new", label: "Нові", has: (c) => c.status === "sent" },
    { id: "review", label: REVIEW, has: (c) => c.status === "review" },
    { id: "work", label: "В роботі", has: (c) => c.status === "work" },
    { id: "closed", label: "Закриті", has: isClosed },
  ];

  function emptyFor(st, groups) {
    const who = groups.length > 1 ? "вам" : RC[groups[0]].dative;
    switch (st) {
      case "new":
        return `<b>Нових звернень немає</b>Щойно мешканець напише ${who}, звернення з’явиться тут, а вам прийде сповіщення.`;
      case "review":
        return `<b>Нічого не чекає на рішення</b>Відкрите звернення можна взяти в роботу, уточнити в автора, передати або відхилити з поясненням.`;
      case "work":
        return groups.length === 1 && groups[0] === "team"
          ? `<b>Зараз нічого в роботі</b>Узяте звернення про застосунок закриваєте ви, кнопкою «${EH.COMPLAINT_STATUS.resolved}» у самому зверненні.`
          : `<b>Зараз нічого в роботі</b>Узяте звернення стає завданням на дошці. Коли завдання готове, звернення закривається саме, а автор дізнається про це.`;
      default:
        return `<b>Закритих ще немає</b>Тут зберігаються вирішені й відхилені звернення.`;
    }
  }

  function inboxRow(c, multi, st) {
    const t = topicOf(c);
    const author = c.author && EH.person(c.author);
    const unread = !!c.unread[c.to];
    const who = author
      ? `<span>${esc(author.name)}, ${esc(author.room)}</span>`
      : `<span class="anon-tag">${icon("mask")}Анонімне</span>`;
    const overdue = c.overdue && !isClosed(c) && c.status !== "work";
    return `<a class="list-row in-row" href="#/complaints/${c.id}">
      <span class="hub-ico">${icon(t.icon)}</span>
      <span class="grow">
        <b class="${unread ? "unread-dot" : ""}">${esc(titleOf(c))}${unread ? '<span class="c-sr"> (нове)</span>' : ""}</b>
        <span class="sub c-excerpt">${esc(c.body)}</span>
        <span class="meta">${who}${multi ? `<span>${GROUP_LABEL[c.to]}</span>` : ""}${overdue ? `<span class="overdue">2 дні без відповіді</span>` : `<span>${esc(stamp(c.createdAt))}</span>`}${st === "closed" ? status(c.status) : ""}</span>
      </span>
    </a>`;
  }

  App.route(
    "/inbox",
    (ctx) => {
      const me = ctx.me;
      const groups = handledGroups(me);
      if (!groups.length) {
        return `${backBar("/me", "")}<h2 class="title">Вхідні звернення</h2>
        <p class="lede">Тут на звернення мешканців відповідають студрада, оперзагін і розпорядник.</p>
        <div class="glass empty"><b>Вам звернення не адресують</b>Ви можете писати звернення самі й стежити за ними в «Моє».</div>
        <a class="btn btn-primary block" href="#/complaints/new" style="margin-top:12px">Нове звернення</a>`;
      }
      const multi = groups.length > 1;
      const all = S.complaints.filter((c) => groups.includes(c.to));
      const st = BUCKETS.some((b) => b.id === ctx.query.st)
        ? ctx.query.st
        : "new";
      const bucket = BUCKETS.find((b) => b.id === st);
      const list = all.filter(bucket.has);
      const title = multi ? "Вхідні звернення" : INBOX_TITLE[groups[0]];
      const boardB =
        groups.includes("squad") && !groups.includes("council")
          ? "squad"
          : "council";

      const seg = App.seg(
        BUCKETS.map((b) => ({
          href: `/inbox?st=${b.id}`,
          label: b.label,
          on: b.id === st,
          count: all.filter(b.has).length,
        })),
        "Стан звернень",
      );
      const body = list.length
        ? `<div class="glass c-inbox">${list.map((c) => inboxRow(c, multi, st)).join("")}</div>`
        : `<div class="glass empty">${emptyFor(st, groups)}</div>`;
      const foot =
        st === "work" && groups.some((g) => g !== "team")
          ? `<p class="c-foot"><a class="link" href="#/board?tab=tasks&b=${boardB}&col=in_progress">Завдання на дошці${icon("chev", true)}</a></p>`
          : "";

      return `
      ${backBar("/me", "")}
      <h2 class="title">${esc(title)}</h2>
      <p class="lede">Відповісти треба протягом 2 днів, інакше звернення підсвічується.${multi ? ` Тут звернення до ${groups.map((g) => RC[g].of).join(" й ")}.` : ""}</p>
      ${ui.flash ? `<p class="ok-note" role="status">${esc(ui.flash)}</p>` : ""}
      <div class="c-seg">${seg}</div>
      ${body}
      ${foot}`;
    },
    {
      tab: "me",
      title: "Вхідні звернення",
      mount(root) {
        // on a narrow phone the four states scroll sideways; keep the chosen one in view
        const nav = root.querySelector(".c-seg .seg");
        const on = nav?.querySelector("[aria-current=true]");
        if (nav && on && nav.scrollWidth > nav.clientWidth) {
          nav.scrollLeft = Math.max(
            0,
            on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2,
          );
        }
      },
    },
  );
})();
