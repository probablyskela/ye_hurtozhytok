/*
 * Shared demo state for every phone on the prototype page.
 * The top window owns one store; each phone (an iframe) reads and changes it,
 * so what one person does shows up on the others' phones at once.
 * Everything here is invented sample data.
 */
(function () {
  if (window.EH) return;

  const listeners = new Set();
  let seq = 100;
  let minute = 13 * 60 + 40; // the demo clock: Saturday 31 October, 13:40

  const TODAY = "2026-10-31";
  const DAYS = [
    {
      date: "2026-10-31",
      wd: "Сб",
      d: 31,
      label: "Сьогодні",
      long: "сьогодні, субота",
    },
    {
      date: "2026-11-01",
      wd: "Нд",
      d: 1,
      label: "Завтра",
      long: "завтра, неділя",
    },
    { date: "2026-11-02", wd: "Пн", d: 2, long: "понеділок, 2 листопада" },
    { date: "2026-11-03", wd: "Вт", d: 3, long: "вівторок, 3 листопада" },
    { date: "2026-11-04", wd: "Ср", d: 4, long: "середа, 4 листопада" },
    { date: "2026-11-05", wd: "Чт", d: 5, long: "четвер, 5 листопада" },
    { date: "2026-11-06", wd: "Пт", d: 6, long: "пʼятниця, 6 листопада" },
  ];

  // Everyone who signs in is a resident. A role only adds rights on top.
  const ROLES = {
    council: { label: "Студрада", group: "council" },
    council_head: { label: "Голова студради", group: "council" },
    squad: { label: "Оперзагін", group: "squad" },
    squad_head: { label: "Голова оперзагону", group: "squad" },
    site_manager: { label: "Розпорядник", group: "admin" },
  };

  const TOPICS = [
    { id: "electric", label: "Електрика", icon: "bolt", to: "council" },
    { id: "plumbing", label: "Сантехніка", icon: "drop", to: "council" },
    { id: "furniture", label: "Меблі й вікна", icon: "chair", to: "council" },
    { id: "laundry", label: "Пралки", icon: "washer", to: "council" },
    { id: "clean", label: "Чистота", icon: "broom", to: "council" },
    { id: "other", label: "Інше", icon: "dots", to: "council" },
    { id: "noise", label: "Шум", icon: "sound", to: "squad" },
    { id: "strangers", label: "Сторонні", icon: "door", to: "squad" },
    { id: "safety", label: "Безпека", icon: "shield", to: "squad" },
    { id: "rules", label: "Порушення правил", icon: "flag", to: "squad" },
    { id: "app", label: "Про застосунок", icon: "phone", to: "team" },
  ];

  // who took a complaint, in the right gender: «Студрада взяла», «Оперзагін взяв»
  const TOOK = {
    council: "Студрада взяла",
    squad: "Оперзагін взяв",
    team: "Розпорядник взяв",
  };

  // Complaints «Про застосунок» go to whoever has the розпорядник role.
  const RECIPIENTS = {
    council: { label: "студрада", dative: "студраді", of: "студради" },
    squad: { label: "оперзагін", dative: "оперзагону", of: "оперзагону" },
    team: { label: "розпорядник", dative: "розпоряднику", of: "розпорядника" },
  };

  // one status vocabulary for every screen, notification and system line
  const COMPLAINT_STATUS = {
    sent: "Надіслано",
    review: "На розгляді",
    work: "В роботі",
    resolved: "Вирішено",
    rejected: "Відхилено",
  };
  const TASK_STATUS = { new: "Нове", in_progress: "В роботі", done: "Готово" };

  const people = [
    {
      id: "olena",
      name: "Олена Гриценко",
      first: "Олена",
      vocative: "Олено",
      initials: "ОГ",
      room: "612",
      tg: "olena_h",
      email: "olena.hrytsenko@lpnu.ua",
      roles: [],
    },
    {
      id: "marta",
      name: "Марта Гнатів",
      first: "Марта",
      vocative: "Марто",
      initials: "МГ",
      room: "415",
      tg: "marta_hn",
      email: "marta.hnativ@lpnu.ua",
      roles: ["council"],
    },
    {
      id: "taras",
      name: "Тарас Гуменюк",
      first: "Тарас",
      vocative: "Тарасе",
      initials: "ТГ",
      room: "404",
      tg: "taras_g",
      email: "taras.humeniuk@lpnu.ua",
      roles: ["squad"],
    },
    {
      id: "anton",
      name: "Антон",
      first: "Антон",
      vocative: "Антоне",
      initials: "А",
      room: "509",
      tg: "",
      email: "anton@lpnu.ua",
      roles: ["site_manager"],
    },
    {
      id: "iryna",
      name: "Ірина Лисенко",
      first: "Ірина",
      initials: "ІЛ",
      room: "603",
      tg: "iryna_l",
      email: "iryna.lysenko@lpnu.ua",
      roles: ["council_head"],
    },
    {
      id: "ostap",
      name: "Остап Савчук",
      first: "Остап",
      initials: "ОС",
      room: "608",
      tg: "ostap_s",
      email: "ostap.savchuk@lpnu.ua",
      roles: ["squad_head"],
    },
    {
      id: "denys",
      name: "Денис Ткач",
      first: "Денис",
      initials: "ДТ",
      room: "302",
      tg: "den_tkach",
      email: "denys.tkach@lpnu.ua",
      roles: [],
    },
    {
      id: "yulia",
      name: "Юлія Бойко",
      first: "Юлія",
      initials: "ЮБ",
      room: "418",
      tg: "",
      email: "yulia.boiko@lpnu.ua",
      roles: [],
    },
    {
      id: "ivan",
      name: "Іван Мельник",
      first: "Іван",
      initials: "ІМ",
      room: "407",
      tg: "ivan_m",
      email: "ivan.melnyk@lpnu.ua",
      roles: [],
    },
    {
      id: "vira",
      name: "Віра Шевчук",
      first: "Віра",
      initials: "ВШ",
      room: "611",
      tg: "",
      email: "vira.shevchuk@lpnu.ua",
      roles: [],
    },
    {
      id: "marko",
      name: "Марко Дячук",
      first: "Марко",
      initials: "МД",
      room: "621",
      tg: "marko_d",
      email: "marko.diachuk@lpnu.ua",
      roles: ["squad"],
    },
  ];

  const machines = [
    { id: "4", name: "4 поверх", short: "4 пов." },
    { id: "6-1", name: "6 поверх, №1", short: "6 пов., №1" },
    { id: "6-2", name: "6 поверх, №2", short: "6 пов., №2" },
  ];

  const t = (s) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  let bid = 1;
  const B = (machine, person, date, s, e) => ({
    id: bid++,
    machine,
    person,
    date,
    s: t(s),
    e: t(e),
    status: "active",
  });
  const bookings = [
    B("4", "ivan", TODAY, "09:00", "11:00"),
    B("4", "denys", TODAY, "15:30", "17:30"),
    B("4", "yulia", TODAY, "19:00", "21:00"),
    B("6-1", "ostap", TODAY, "12:30", "14:30"),
    B("6-1", "olena", TODAY, "18:00", "20:00"),
    B("6-1", "iryna", TODAY, "20:15", "21:45"),
    B("6-2", "marko", TODAY, "13:00", "15:00"),
    B("6-2", "vira", TODAY, "18:30", "20:30"),
    B("4", "marta", "2026-11-01", "10:00", "12:00"),
    B("6-1", "taras", "2026-11-01", "17:00", "19:30"),
    B("6-2", "olena", "2026-11-03", "09:00", "09:30"),
  ];

  const announcements = [
    {
      id: 1,
      audience: "all",
      title: "Вимкнуть гарячу воду на 5 і 6 поверхах",
      details:
        "Ремонт труби в підвалі. Пралки на 6 поверсі працюватимуть лише на холодних програмах.",
      place: "5 і 6 поверхи",
      date: "2026-11-01",
      time: "09:00",
      until: "18:00",
      important: true,
      author: "iryna",
      at: "сьогодні, 11:20",
    },
    {
      id: 2,
      audience: "all",
      title: "Збори мешканців",
      details: "Звіт студради за жовтень і вибори старост поверхів.",
      place: "Читальна зала, 1 поверх",
      date: "2026-11-02",
      time: "19:00",
      important: false,
      author: "marta",
      at: "вчора, 18:02",
    },
    {
      id: 3,
      audience: "all",
      title: "Генеральне прибирання кухонь",
      details: "Звільніть полиці в холодильниках до вечора вівторка.",
      place: "Усі поверхи",
      date: "2026-11-04",
      time: "10:00",
      important: false,
      author: "marta",
      at: "28 жовтня",
    },
    {
      id: 4,
      audience: "squad",
      title: "Збори загону",
      details: "Графік вахт на листопад, нові обходи.",
      place: "Кімната 101",
      date: "2026-11-01",
      time: "20:00",
      important: false,
      author: "ostap",
      at: "вчора, 21:40",
    },
    {
      id: 5,
      audience: "all",
      title: "Нові правила пральні",
      details: "Запис лише через застосунок, зошити прибрали.",
      place: "",
      date: "",
      time: "",
      important: false,
      author: "iryna",
      at: "20 жовтня",
      past: true,
    },
  ];

  const tasks = [
    {
      id: 41,
      board: "council",
      title: "Тече кран у душі, 6 поверх",
      details: "Ліва душова, кран не закривається до кінця.",
      place: "6 поверх, душ ліворуч",
      status: "in_progress",
      public: true,
      complaintId: 27,
      assignees: ["marta"],
      createdAt: "26 жов",
      history: [
        {
          at: "28 жов, 16:10",
          text: "Передали сантехніку, обіцяв до понеділка",
        },
        { at: "27 жов, 09:30", text: "Взяли в роботу" },
        { at: "26 жов, 22:05", text: "Додано на дошку" },
      ],
    },
    {
      id: 42,
      board: "council",
      title: "Не світить лампа на сходах між 3 і 4 поверхом",
      details: "",
      place: "Сходи, крило А",
      status: "in_progress",
      public: true,
      complaintId: null,
      assignees: ["iryna"],
      createdAt: "29 жов",
      history: [{ at: "29 жов, 12:00", text: "Взяли в роботу" }],
    },
    {
      id: 43,
      board: "council",
      title: "Друга сушарка для пральні",
      details: "Домовитися з адміністрацією про другу сушарку на 6 поверх.",
      place: "Пральня, 6 поверх",
      status: "new",
      public: true,
      complaintId: null,
      assignees: [],
      createdAt: "30 жов",
      history: [{ at: "30 жов, 10:15", text: "Додано на дошку" }],
    },
    {
      id: 44,
      board: "council",
      title: "Полиця на кухні 5 поверху",
      details: "",
      place: "Кухня, 5 поверх",
      status: "done",
      public: true,
      complaintId: null,
      assignees: ["marta"],
      createdAt: "20 жов",
      history: [{ at: "24 жов, 15:00", text: "Готово" }],
    },
    {
      id: 45,
      board: "council",
      title: "Пралка на 4 поверсі не зливала воду",
      details: "",
      place: "Пральня, 4 поверх",
      status: "done",
      public: true,
      complaintId: 19,
      assignees: ["iryna"],
      createdAt: "12 жов",
      history: [
        { at: "14 жов, 11:00", text: "Готово: майстер почистив фільтр" },
      ],
    },
    {
      id: 51,
      board: "squad",
      title: "Шум після 01:00, 5 поверх",
      details: "Скарга на гучну музику вночі.",
      place: "5 поверх, крило Б",
      status: "in_progress",
      public: true,
      complaintId: 30,
      assignees: ["taras"],
      createdAt: "30 жов",
      history: [{ at: "30 жов, 23:40", text: "Взяли в роботу" }],
    },
    {
      id: 52,
      board: "squad",
      title: "Перевірити замок на запасному виході",
      details: "Внутрішнє завдання загону.",
      place: "1 поверх",
      status: "new",
      public: false,
      complaintId: null,
      assignees: [],
      createdAt: "29 жов",
      history: [{ at: "29 жов, 21:00", text: "Додано" }],
    },
  ];

  const complaints = [
    {
      id: 27,
      topic: "plumbing",
      to: "council",
      place: "6 поверх, душ ліворуч",
      body: "Кран у лівій душовій не закривається до кінця, вода тече цілу ніч. Під дверима вже калюжа.",
      author: "olena",
      anon: false,
      status: "work",
      taskId: 41,
      createdAt: "26 жов, 22:01",
      unread: { olena: true },
      messages: [
        {
          from: "handler",
          who: "marta",
          text: "Дякуємо! Кран в одній кабінці чи в обох?",
          at: "27 жов, 09:28",
        },
        {
          from: "author",
          who: "olena",
          text: "Лише в лівій, права нормальна.",
          at: "27 жов, 10:02",
        },
        {
          from: "system",
          text: "Студрада взяла звернення в роботу",
          at: "27 жов, 10:30",
        },
        {
          from: "handler",
          who: "marta",
          text: "Передали сантехніку, обіцяв до понеділка. Напишіть, якщо стане гірше.",
          at: "28 жов, 16:10",
        },
      ],
    },
    {
      id: 30,
      topic: "noise",
      to: "squad",
      place: "5 поверх, крило Б",
      body: "Майже щоночі після 01:00 гучна музика в кінці коридору, до 3–4 ранку.",
      author: null,
      anon: true,
      anonOwner: "olena",
      status: "work",
      taskId: 51,
      createdAt: "30 жов, 23:12",
      unread: {},
      messages: [
        {
          from: "system",
          text: "Оперзагін взяв звернення в роботу",
          at: "30 жов, 23:40",
        },
      ],
    },
    {
      id: 19,
      topic: "laundry",
      to: "council",
      place: "Пральня, 4 поверх",
      body: "Пралка не зливає воду після прання.",
      author: "olena",
      anon: false,
      status: "resolved",
      taskId: 45,
      createdAt: "12 жов, 20:30",
      unread: {},
      messages: [
        {
          from: "system",
          text: "Вирішено: майстер почистив фільтр",
          at: "14 жов, 11:00",
        },
      ],
    },
    {
      id: 31,
      topic: "electric",
      to: "council",
      place: "Кухня, 3 поверх",
      body: "На кухні 3 поверху ліва розетка іскрить, коли вмикаєш чайник. Вже двічі вибивало світло на поверсі.",
      author: "denys",
      anon: false,
      status: "sent",
      taskId: null,
      createdAt: "сьогодні, 13:00",
      unread: { council: true },
      messages: [],
    },
    {
      id: 32,
      topic: "clean",
      to: "council",
      place: "Сходи між 5 і 6",
      body: "Третій день стоять пакети зі сміттям біля вікна, вже пахне.",
      author: null,
      anon: true,
      status: "sent",
      taskId: null,
      createdAt: "сьогодні, 10:40",
      unread: { council: true },
      messages: [],
    },
    {
      id: 33,
      topic: "furniture",
      to: "council",
      place: "Кімната 418",
      body: "Ручка вікна провертається, вікно не зачиняється, дме.",
      author: "yulia",
      anon: false,
      status: "review",
      taskId: null,
      createdAt: "29 жов, 19:15",
      overdue: true,
      unread: {},
      messages: [],
    },
    {
      id: 34,
      topic: "strangers",
      to: "squad",
      place: "1 поверх, вхід",
      body: "Учора близько 23:00 двоє незнайомих хлопців пройшли повз вахту й піднялися на 3 поверх.",
      author: "ivan",
      anon: false,
      status: "sent",
      taskId: null,
      createdAt: "сьогодні, 09:15",
      unread: { squad: true },
      messages: [],
    },
  ];

  const shifts = [
    { date: "2026-10-31", person: "taras", note: "" },
    { date: "2026-11-01", person: "marko", note: "До 01:00, потім обхід" },
    { date: "2026-11-02", person: null, note: "" },
    { date: "2026-11-03", person: "ostap", note: "" },
    { date: "2026-11-04", person: null, note: "" },
  ];
  const patrols = [
    {
      id: 1,
      date: "2026-10-30",
      people: ["taras", "marko"],
      note: "Шум на 5 поверсі, крило Б. Попередили.",
      done: true,
    },
    {
      id: 2,
      date: "2026-11-01",
      people: ["ostap", "taras"],
      note: "",
      done: false,
    },
  ];

  const bot = [
    {
      chat: "dorm",
      text: "📌 Важливе: вимкнуть гарячу воду на 5 і 6 поверхах — завтра, 09:00–18:00.",
      at: "11:20",
    },
    {
      chat: "squad",
      text: "Нове звернення до загону: «Сторонні», 1 поверх, вхід.",
      at: "09:15",
    },
    {
      chat: "dorm",
      text: "Готово: пралка на 4 поверсі знову зливає воду.",
      at: "14 жов",
    },
  ];

  const notes = { olena: [], marta: [], taras: [], anton: [] };
  const anonTickets = { olena: 2 };
  // Roles are tied to an email: the розпорядник may give one before the person
  // first signs in. It switches on when that email appears (actions.signIn).
  const pendingRoles = [
    { email: "bohdan.kravets@lpnu.ua", roles: ["squad"], by: "anton" },
  ];

  const state = {
    people,
    machines,
    bookings,
    announcements,
    tasks,
    complaints,
    shifts,
    patrols,
    bot,
    notes,
    anonTickets,
    pendingRoles,
  };

  // ---------- helpers ----------
  const pad = (n) => String(n).padStart(2, "0");
  // One action = one moment: the demo clock moves a single minute per action,
  // however many people it notifies or bot lines it writes.
  let moment = null;
  const clock = () => {
    if (moment === null) {
      minute += 1;
      moment = fmt(minute);
      queueMicrotask(() => {
        moment = null;
      });
    }
    return moment;
  };
  const nowLabel = () => `сьогодні, ${clock()}`;
  const ceil5 = (m) => Math.ceil(m / 5) * 5;
  // short day for messages: «сьогодні», «завтра», otherwise «02.11»
  const dayWord = (date) =>
    date === TODAY
      ? "сьогодні"
      : date === DAYS[1].date
        ? "завтра"
        : `${date.slice(8)}.${date.slice(5, 7)}`;
  const person = (id) => people.find((p) => p.id === id);
  const groups = (p) => new Set((p?.roles || []).map((r) => ROLES[r]?.group));
  const has = (p, group) => groups(p).has(group);
  const handlersOf = (to) =>
    people
      .filter((p) =>
        to === "team" ? p.roles.includes("site_manager") : has(p, to),
      )
      .map((p) => p.id);

  function emit(kind, detail) {
    listeners.forEach((fn) => {
      try {
        fn(kind, detail);
      } catch (e) {
        console.error(e);
      }
    });
  }
  function notify(ids, text, href) {
    for (const id of new Set(ids)) {
      if (!notes[id]) notes[id] = [];
      const n = { id: ++seq, text, href, at: clock() };
      notes[id].unshift(n);
      emit("note", { to: id, note: n });
    }
  }
  function say(chat, text) {
    bot.unshift({ chat, text, at: clock() });
    emit("bot", { chat, text });
  }
  function changed(what) {
    emit("change", { what });
  }

  // ---------- permissions (mirrors lib/permissions.ts in spirit) ----------
  const can = {
    announceAll: (p) => has(p, "council") || p.roles.includes("site_manager"),
    // squad announcements: the squad head and the розпорядник publish, squad members only read
    announceSquad: (p) =>
      p.roles.includes("squad_head") || p.roles.includes("site_manager"),
    readSquadAnnouncements: (p) =>
      has(p, "squad") || p.roles.includes("site_manager"),
    runBoard: (p, board) => has(p, board) || p.roles.includes("site_manager"),
    seePrivateTasks: (p, board) => has(p, board),
    handleComplaint: (p, c) =>
      c.to === "team" ? p.roles.includes("site_manager") : has(p, c.to),
    giveRoles: (p) => p.roles.includes("site_manager"),
    squadTools: (p) => has(p, "squad") || p.roles.includes("site_manager"),
    // only squad members sign up for shifts; the розпорядник sees them
    signShifts: (p) => has(p, "squad"),
    // lib/permissions.ts: the council cancels anyone's booking, even one already running (a no-show)
    cancelAnyBooking: (p) => has(p, "council"),
    // the council blocks residents, never itself or another council member
    blockResidents: (p, target) =>
      has(p, "council") &&
      (!target || (target.id !== p.id && !has(target, "council"))),
  };

  const machineName = (id) => machines.find((x) => x.id === id)?.name || id;
  // «Пралка звільнилась» only for time still ahead today, and only when it is worth booking
  function announceFree(b, from, to) {
    if (b.date !== TODAY) return false;
    const s = Math.max(from, ceil5(minute));
    if (to - s < 30 || s - minute > 180) return false;
    say(
      "dorm",
      `Пралка звільнилась: ${machineName(b.machine)}, сьогодні ${fmt(s)}–${fmt(to)}.`,
    );
    return true;
  }
  function addRole(p, role) {
    if (p.roles.includes(role)) return false;
    p.roles.push(role);
    return true;
  }

  // ---------- mutations ----------
  const actions = {
    book(personId, machine, date, s, len) {
      const b = {
        id: bid++,
        machine,
        person: personId,
        date,
        s,
        e: s + len,
        status: "active",
      };
      bookings.push(b);
      changed("bookings");
      return b;
    },
    // Returns { freed } — whether the dorm group heard that the machine is free.
    cancelBooking(id, byId) {
      const b = bookings.find((x) => x.id === id);
      if (!b || b.status !== "active") return { freed: false };
      b.status = "cancelled";
      const freed = announceFree(b, b.s, b.e);
      if (byId && byId !== b.person) {
        const when = `${dayWord(b.date)} ${fmt(b.s)}–${fmt(b.e)}`;
        notify(
          [b.person],
          `Студрада скасувала ваш запис: ${machineName(b.machine)}, ${when}`,
          "/laundry/bookings",
        );
      }
      changed("bookings");
      return { freed };
    },
    // During the wash: the end moves to the next 5-minute mark and the rest is free.
    releaseBooking(id, byId) {
      const b = bookings.find((x) => x.id === id);
      if (!b || b.status !== "active" || b.person !== byId)
        return { freed: false };
      const end = Math.min(ceil5(minute), b.e);
      const was = b.e;
      if (end <= b.s) b.status = "cancelled";
      else b.e = end;
      const freed = announceFree(b, end, was);
      changed("bookings");
      return { freed };
    },
    saveProfile(id, { room, tg }) {
      const p = person(id);
      if (!p) return;
      p.room = room;
      p.tg = tg || "";
      changed("people");
    },
    announce(byId, data) {
      const a = {
        id: ++seq,
        audience: data.audience || "all",
        title: data.title,
        details: data.details || "",
        place: data.place || "",
        date: data.date || "",
        time: data.time || "",
        until: data.until || "",
        important: !!data.important,
        author: byId,
        at: nowLabel(),
      };
      announcements.unshift(a);
      const by = person(byId);
      if (a.audience === "all") {
        const d = DAYS.find((x) => x.date === a.date);
        const dayText = !a.date
          ? ""
          : a.date === TODAY
            ? "сьогодні"
            : a.date === DAYS[1].date
              ? "завтра"
              : d
                ? d.long
                : a.date;
        const when = [
          dayText,
          a.time ? (a.until ? `${a.time}–${a.until}` : a.time) : "",
        ]
          .filter(Boolean)
          .join(", ");
        say(
          "dorm",
          `${a.important ? "📌 Важливе: " : "Оголошення: "}${a.title}${when ? ` — ${when}` : ""}.`,
        );
        if (a.important)
          notify(
            people.filter((p) => p.id !== byId).map((p) => p.id),
            `Важливе оголошення: ${a.title}`,
            `/board?tab=ann`,
          );
      } else {
        say("squad", `Оголошення для загону: ${a.title}.`);
        notify(
          people
            .filter((p) => can.readSquadAnnouncements(p) && p.id !== byId)
            .map((p) => p.id),
          `Оголошення для загону: ${a.title}`,
          `/board?tab=ann`,
        );
      }
      changed("announcements");
      return a;
    },
    complain(byId, data) {
      const topic = TOPICS.find((x) => x.id === data.topic);
      const c = {
        id: ++seq,
        topic: topic.id,
        to: topic.to,
        place: data.place || "",
        body: data.body,
        author: data.anon ? null : byId,
        anon: !!data.anon,
        anonOwner: data.anon ? byId : undefined,
        status: "sent",
        taskId: null,
        createdAt: nowLabel(),
        unread: { [topic.to]: true },
        messages: [],
      };
      complaints.unshift(c);
      if (data.anon)
        anonTickets[byId] = Math.max(0, (anonTickets[byId] ?? 3) - 1);
      const by = person(byId);
      notify(
        handlersOf(c.to),
        c.anon
          ? `Анонімне звернення: ${topic.label}`
          : `Нове звернення: ${topic.label} — ${by.name}, кімната ${by.room}`,
        `/complaints/${c.id}`,
      );
      if (c.to === "squad")
        say(
          "squad",
          `Нове звернення до загону: «${topic.label}», ${c.place || "місце не вказано"}. ${c.body}`,
        );
      changed("complaints");
      return c;
    },
    reply(complaintId, byId, text) {
      const c = complaints.find((x) => x.id === complaintId);
      const mine = c.author === byId || c.anonOwner === byId;
      c.messages.push({
        from: mine ? "author" : "handler",
        who: mine && c.anon ? null : byId,
        text,
        at: clock(),
      });
      if (mine) {
        c.unread[c.to] = true;
        notify(
          handlersOf(c.to).filter((id) => id !== byId),
          `Відповідь у зверненні №${c.id}`,
          `/complaints/${c.id}`,
        );
      } else {
        if (c.status === "sent") c.status = "review";
        if (c.author) {
          c.unread[c.author] = true;
          notify(
            [c.author],
            `${person(byId).first} відповідає у вашому зверненні`,
            `/complaints/${c.id}`,
          );
        } else if (c.anonOwner) c.unread[c.anonOwner] = true; // no push for anonymous authors; seen on their phone only
      }
      changed("complaints");
    },
    review(complaintId, byId) {
      const c = complaints.find((x) => x.id === complaintId);
      const fresh = c.status === "sent";
      if (fresh) {
        c.status = "review";
        c.messages.push({
          from: "system",
          text: `${TOOK[c.to]} звернення на розгляд`,
          at: clock(),
        });
        if (c.author)
          notify(
            [c.author],
            `Звернення №${c.id}: ${COMPLAINT_STATUS.review.toLowerCase()}`,
            `/complaints/${c.id}`,
          );
      }
      delete c.unread[c.to];
      changed("complaints");
    },
    // Takes a complaint into work. Council and squad complaints become a task on
    // their board. The task carries only what the handler wrote for it (title,
    // details) and the place the form shows; never the complaint text or author.
    // A complaint about the app goes to the розпорядник and gets no board task
    // (returns null), so nothing about it reaches the board or the dorm chat.
    take(complaintId, byId, publicTitle, isPublic, details) {
      const c = complaints.find((x) => x.id === complaintId);
      if (!c || !(c.status === "sent" || c.status === "review")) return null;
      const topic = TOPICS.find((x) => x.id === c.topic);
      const tookIt = () => {
        c.status = "work";
        delete c.unread[c.to];
        c.messages.push({
          from: "system",
          text: `${TOOK[c.to]} звернення в роботу`,
          at: clock(),
        });
        if (c.author) {
          c.unread[c.author] = true;
          notify(
            [c.author],
            `Звернення №${c.id}: ${COMPLAINT_STATUS.work.toLowerCase()}`,
            `/complaints/${c.id}`,
          );
        } else if (c.anonOwner) c.unread[c.anonOwner] = true;
      };
      if (c.to === "team") {
        tookIt();
        changed("complaints");
        return null;
      }
      const task = {
        id: ++seq,
        board: c.to === "squad" ? "squad" : "council",
        title: publicTitle || topic.label,
        details: typeof details === "string" ? details.trim() : "",
        place: c.place,
        status: "in_progress",
        public: !!isPublic,
        complaintId: c.id,
        assignees: [byId],
        createdAt: "сьогодні",
        history: [
          { at: nowLabel(), text: `${person(byId).first} бере в роботу` },
        ],
      };
      tasks.unshift(task);
      c.taskId = task.id;
      tookIt();
      if (task.public)
        say(
          task.board === "squad" ? "squad" : "dorm",
          `Нове на дошці ${task.board === "squad" ? "оперзагону" : "студради"}: ${task.title}.`,
        );
      changed("tasks");
      return task;
    },
    // Only between the council and the squad; a complaint about the app stays with the розпорядник.
    transfer(complaintId, byId) {
      const c = complaints.find((x) => x.id === complaintId);
      if (!c || (c.to !== "council" && c.to !== "squad")) return false;
      const from = c.to;
      c.to = from === "squad" ? "council" : "squad";
      c.status = "sent";
      delete c.unread[from];
      c.unread[c.to] = true;
      c.messages.push({
        from: "system",
        text: `Передано: ${RECIPIENTS[from].label} → ${RECIPIENTS[c.to].label}`,
        at: clock(),
      });
      notify(
        handlersOf(c.to),
        `Передали звернення №${c.id} (${RECIPIENTS[from].label})`,
        `/complaints/${c.id}`,
      );
      if (c.author)
        notify(
          [c.author],
          `Ваше звернення передали: ${RECIPIENTS[c.to].label}`,
          `/complaints/${c.id}`,
        );
      if (c.to === "squad")
        say(
          "squad",
          `Студрада передала звернення загону: «${TOPICS.find((x) => x.id === c.topic)?.label || ""}», ${c.place || "місце не вказано"}. ${c.body}`,
        );
      changed("complaints");
      return true;
    },
    // A complaint without a board task (about the app) is closed straight from the complaint.
    resolve(complaintId, byId, note) {
      const c = complaints.find((x) => x.id === complaintId);
      if (!c || c.status !== "work" || c.taskId) return;
      c.status = "resolved";
      c.messages.push({
        from: "system",
        text: note
          ? `${COMPLAINT_STATUS.resolved}: ${note}`
          : COMPLAINT_STATUS.resolved,
        at: clock(),
      });
      if (c.author) {
        c.unread[c.author] = true;
        notify(
          [c.author],
          `Звернення №${c.id}: ${COMPLAINT_STATUS.resolved.toLowerCase()}`,
          `/complaints/${c.id}`,
        );
      } else if (c.anonOwner) c.unread[c.anonOwner] = true;
      changed("complaints");
    },
    reject(complaintId, byId, reason) {
      const c = complaints.find((x) => x.id === complaintId);
      c.status = "rejected";
      c.rejectReason = reason;
      delete c.unread[c.to];
      c.messages.push({
        from: "system",
        text: `Відхилено: ${reason}`,
        at: clock(),
      });
      if (c.author) {
        c.unread[c.author] = true;
        notify(
          [c.author],
          `Звернення №${c.id}: ${COMPLAINT_STATUS.rejected.toLowerCase()}, є пояснення`,
          `/complaints/${c.id}`,
        );
      } else if (c.anonOwner) c.unread[c.anonOwner] = true;
      changed("complaints");
    },
    addTask(byId, data) {
      const task = {
        id: ++seq,
        board: data.board,
        title: data.title,
        details: data.details || "",
        place: data.place || "",
        status: "new",
        public: data.public !== false,
        complaintId: null,
        assignees: [],
        createdAt: "сьогодні",
        history: [{ at: nowLabel(), text: "Додано на дошку" }],
      };
      tasks.unshift(task);
      if (task.public && task.board === "council")
        say("dorm", `Нове на дошці студради: ${task.title}.`);
      if (task.board === "squad")
        say("squad", `Нове завдання загону: ${task.title}.`);
      changed("tasks");
      return task;
    },
    // Someone joins a task already in work.
    takeTask(taskId, byId) {
      const task = tasks.find((x) => x.id === taskId);
      if (!task || task.assignees.includes(byId)) return;
      task.assignees.push(byId);
      if (task.status === "new") task.status = "in_progress";
      task.history.unshift({
        at: nowLabel(),
        text: `${person(byId).first} долучається до виконання`,
      });
      changed("tasks");
    },
    // A new task taken into work: assigns the person and writes one history line.
    startTask(taskId, byId, note) {
      const task = tasks.find((x) => x.id === taskId);
      if (!task || task.status !== "new") return;
      if (!task.assignees.includes(byId)) task.assignees.push(byId);
      task.status = "in_progress";
      task.history.unshift({
        at: nowLabel(),
        text: `${person(byId).first} бере в роботу${note ? `: ${note}` : ""}`,
      });
      changed("tasks");
    },
    setTaskStatus(taskId, byId, status, note) {
      const task = tasks.find((x) => x.id === taskId);
      task.status = status;
      const label = {
        new: `Повернули в «${TASK_STATUS.new}»`,
        in_progress: TASK_STATUS.in_progress,
        done: TASK_STATUS.done,
      }[status];
      task.history.unshift({
        at: nowLabel(),
        text: note ? `${label}: ${note}` : label,
      });
      const c =
        task.complaintId && complaints.find((x) => x.id === task.complaintId);
      if (c) {
        if (status === "done") {
          c.status = "resolved";
          c.messages.push({
            from: "system",
            text: note
              ? `${COMPLAINT_STATUS.resolved}: ${note}`
              : COMPLAINT_STATUS.resolved,
            at: clock(),
          });
          if (c.author) {
            c.unread[c.author] = true;
            notify(
              [c.author],
              `Звернення №${c.id}: ${COMPLAINT_STATUS.resolved.toLowerCase()}`,
              `/complaints/${c.id}`,
            );
          } else if (c.anonOwner) c.unread[c.anonOwner] = true;
        } else if (c.status === "resolved") {
          // reopening the task reopens the complaint, and the author hears about it
          c.status = "work";
          c.messages.push({
            from: "system",
            text: note ? `Знову в роботі: ${note}` : "Знову в роботі",
            at: clock(),
          });
          if (c.author) {
            c.unread[c.author] = true;
            notify(
              [c.author],
              `Звернення №${c.id}: знову в роботі`,
              `/complaints/${c.id}`,
            );
          } else if (c.anonOwner) c.unread[c.anonOwner] = true;
        }
      }
      if (status === "done" && task.public)
        say(
          task.board === "squad" ? "squad" : "dorm",
          `Готово: ${task.title}.`,
        );
      changed("tasks");
    },
    // Returns { person } when the email has signed in, else { pending } — the
    // grant waits for the first sign-in; { already: true } when nothing changes.
    grantRole(email, role, byId) {
      const mail = String(email || "")
        .trim()
        .toLowerCase();
      if (!ROLES[role] || !mail) return { error: true };
      const p = people.find((x) => x.email.toLowerCase() === mail);
      if (p) {
        if (!addRole(p, role)) return { ok: true, already: true, person: p };
        notify([p.id], `Вам видали роль: ${ROLES[role].label}`, "/me");
        changed("people");
        return { ok: true, person: p };
      }
      let wait = pendingRoles.find((x) => x.email === mail);
      if (wait && wait.roles.includes(role))
        return { ok: true, already: true, pending: wait };
      if (!wait) {
        wait = { email: mail, roles: [], by: byId };
        pendingRoles.push(wait);
      }
      wait.roles.push(role);
      changed("people");
      return { ok: true, pending: wait };
    },
    revokePending(email, role) {
      const i = pendingRoles.findIndex(
        (x) => x.email === String(email).toLowerCase(),
      );
      if (i < 0) return;
      const wait = pendingRoles[i];
      wait.roles = wait.roles.filter((r) => r !== role);
      if (!wait.roles.length) pendingRoles.splice(i, 1);
      changed("people");
    },
    // The first sign-in of an email: it becomes a resident, and roles waiting for it switch on.
    signIn({ email, name, first, initials, room = "", tg = "" }) {
      const mail = String(email).trim().toLowerCase();
      let p = people.find((x) => x.email.toLowerCase() === mail);
      if (!p) {
        p = {
          id: mail.split("@")[0].replace(/[^a-z0-9]/g, "") || `p${++seq}`,
          name,
          first: first || name.split(" ")[0],
          initials:
            initials ||
            name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2),
          room,
          tg,
          email: mail,
          roles: [],
        };
        people.push(p);
      }
      const i = pendingRoles.findIndex((x) => x.email === mail);
      if (i >= 0) {
        pendingRoles[i].roles.forEach((r) => addRole(p, r));
        pendingRoles.splice(i, 1);
      }
      changed("people");
      return p;
    },
    revokeRole(personId, role) {
      const p = person(personId);
      p.roles = p.roles.filter((r) => r !== role);
      notify([p.id], `Роль «${ROLES[role].label}» знято`, "/me");
      changed("people");
    },
    signShift(date, byId) {
      const s = shifts.find((x) => x.date === date);
      if (!s || s.person || !can.signShifts(person(byId))) return;
      s.person = byId;
      const p = person(byId);
      say(
        "squad",
        `${p.name}${p.tg ? ` (@${p.tg})` : ""} ${date === TODAY ? "стоїть" : "стоятиме"} на вахті ${dayWord(date)}.`,
      );
      changed("shifts");
    },
    leaveShift(date, byId) {
      const s = shifts.find((x) => x.date === date);
      s.person = null;
      say(
        "squad",
        `${person(byId).name} не зможе стояти на вахті ${dayWord(date)} — вахта вільна.`,
      );
      changed("shifts");
    },
    markRead(complaintId, key) {
      const c = complaints.find((x) => x.id === complaintId);
      if (c && c.unread[key]) {
        delete c.unread[key];
        changed("read");
      }
    },
    dismissNote(personId, noteId) {
      notes[personId] = (notes[personId] || []).filter((n) => n.id !== noteId);
    },
  };

  function fmt(m) {
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  window.EH = {
    state,
    TODAY,
    DAYS,
    ROLES,
    TOPICS,
    RECIPIENTS,
    COMPLAINT_STATUS,
    TASK_STATUS,
    can,
    actions,
    has,
    person,
    fmt,
    nowMin: () => minute,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
})();
