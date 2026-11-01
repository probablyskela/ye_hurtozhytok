---
name: єГуртожиток
description: Phone-first laundry booking for dormitory №14 — calm glass over a water-coloured field, your booking the one solid object.
colors:
  ink: "#101217"
  ink-2: "#2b2f38"
  muted: "#525a6b"
  faint: "#626a7c"
  field-mint: "#cdeee2"
  field-sky: "#cfe0f9"
  field-lilac: "#e4daf6"
  field-base: "#edf2f8"
  mine: "#2a37d8"
  mine-deep: "#1b23a3"
  mine-soft: "#e3e6ff"
  free: "#0b6c61"
  free-tint: "#0f8f7e"
  booked: "#b9c0cc"
  booked-port: "#9aa2b1"
  now: "#e5484d"
  danger: "#c4282e"
  work: "#8f5200"
  work-dot: "#e8950f"
  porthole-mint: "#5ee0c8"
  white: "#ffffff"
typography:
  display-time:
    fontFamily: "Fixel Display, Fixel Text, -apple-system, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontFeature: '"tnum"'
  headline:
    fontFamily: "Fixel Text, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Fixel Text, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Fixel Text, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Fixel Text, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  tile: "26px"
  ticket: "28px"
  tabbar: "30px"
  row: "18px"
  field: "16px"
  segment: "6px"
  pill: "999px"
spacing:
  screen-x: "16px"
  gap-sm: "8px"
  gap-md: "12px"
  tile-pad: "16px"
  section-top: "26px"
  touch-min: "44px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  button-soft:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  button-ghost-danger:
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  day-option-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.row}"
    width: "66px"
    height: "64px"
  booking-ticket:
    backgroundColor: "{colors.mine}"
    textColor: "{colors.white}"
    typography: "{typography.display-time}"
    rounded: "{rounded.ticket}"
    padding: "20px 20px 18px"
  glass-tile:
    rounded: "{rounded.tile}"
    padding: "16px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "52px"
  state-free:
    textColor: "{colors.free}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  tab-main:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
---

# Design System: єГуртожиток

## Overview

**Creative North Star: "The Card in Your Pocket"**

A booking is a document you carry. Every screen is a calm instrument of white liquid glass floating over a soft, slowly drifting water-coloured field (mint, sky, lilac), and the resident's own booking is the one solid, saturated object on it: an ultramarine card with a porthole drawn into its corner. Everything else stays quiet so that "yours", "free" and "now" read in one glance from a hallway, one-handed.

Density is phone-first and generous: 16px screen margins, 44px minimum targets, one idea per glass tile. Language is clarity and craft in the spirit of Ukrainian state-services apps, without borrowing any of their identity: no state symbols, no Дія name or marks, nothing that suggests a government or university service. The UI is light only, Ukrainian only, with plain words and no loanwords («сповіщення», not «пуші»; «ім’я користувача в Telegram», not «нік»; «запис», not «бронь»). The developer credit is a single modest line in faint small text, never a banner: «Розробник: @serpanchyk · LinkedIn», the handle linking to Instagram and «LinkedIn» to the LinkedIn profile (ink-2 links with a soft underline). It closes the main pages and the sign-in page (the `Credit` component); the printed stickers keep their original line.

The direction rejected the grey admin calendar grid and the paper-notebook costume; time is shown as capsule ribbons and soft blocks, not ruled cells.

Scope note: the presentation canvas in `design/mockup/index.html` (phone bezels, status bar, captions under each phone, the page heading and the jump navigation) is mockup chrome, not part of the product system. Do not carry its styles into the app.

**Key Characteristics:**

- White liquid-glass tiles (26px radius, rim light, long soft shadow) over a drifting pastel field.
- One saturated object per screen: the ultramarine booking card, or the booking frame on the scrubber.
- Black capsule primary buttons; everything is a pill or a generously rounded tile.
- Fixel Display Black only for times and duration numerals; Fixel Text for everything else.
- The day strip: each machine's day as a capsule ribbon with booked segments, hatched buffers and a coral now-marker.
- No layout shift: anything that changes while someone interacts (scrubber status, the time card across scale / list / no-room states, the nearest card across lengths) keeps a fixed height; status labels are one word («Вільно», «Зайнято», «Минуло»).
- Sliding pill: every horizontal switcher (days, machines, segmented controls) has one selection pill that slides to the tapped item at once (0.45s, the system ease) and text colour follows it; without JavaScript items keep their own highlight. A dark selected day has no white top highlight.
- Nearest free time: one glass card with the soonest start across machines in Display numerals, the machine, a black «Записатися» that books in one tap and a soft «Інший час»; the other machines' first starts sit below as quiet links.
- The time scrubber: the day slides under a fixed ultramarine frame the size of the booking (8px per 5 minutes, 96px per hour, native momentum scroll with snap points); the frame turns red on busy time and glides to the nearest free start when released. The frame's left edge stays where the longest booking would sit centred; its right edge is a 44px-wide handle (a 12×34px ultramarine capsule with a white rim) that stretches the booking in 5-minute steps like an event in a calendar. The length rides above the frame in 11.5px ultramarine. When the edge hits the next booking, 24:00 or 2.5 hours, only the handle turns red, bumps, and the hint line says why; the hint line is always two lines tall.
- Motion: page changes slide sideways like a pager, without blur: between menu sections in menu order, deeper into a section from the right, «Назад» and browser back from the left (`lib/nav-direction.ts` sets `html[data-nav]`); only the page content (`main`) moves as its own layer, so the background field and the tab bar stay put and the gradient never disappears, and the section pill glides to its new tab; nothing inside the page flies on its own (the booking card moves with its page); tiles rise and the ticket catches light only on the first load of the app (never on later screens), a ripple spreads from the porthole after booking, a busy machine's drum turns and a free one breathes, the now-marker pulses. Everything stops under reduced motion.
- The porthole motif: ticket rings and machine state dots.
- The facade mark: a black squircle holding a 3×3 grid of rounded windows — three lit white, five dim, one ultramarine («твоє вікно»).

## Colors

A cool pastel field under white glass, graphite ink, and three signal colours that each mean one thing (a fourth, amber «в роботі», arrives with v2).

### Primary

- **Ultramarine "Yours"** (mine): reserved for what belongs to the signed-in resident — the booking card, your segment in a day strip, your block in the machine timeline, the booking frame and its handle. Also the focus outline, caret and text selection.
- **Deep Ultramarine** (mine-deep): the dark end of the ticket gradient and the text colour of the white button on the ticket.
- **Pale Ultramarine** (mine-soft): reserved token, not used in the app yet.

### Secondary

- **Pool Teal "Free"** (free): free state text, the free porthole dot, the plus button on a free timeline window, and the "on" state of switches. The lighter **Aqua tint** (free-tint) is used only as low-alpha fills and strokes (13% track fill, 6% window fill, dashed outline) — never as text.

### Tertiary

- **Coral Now** (now): the now-marker only — the vertical line and dot on day strips, the horizontal line and time pill on the timeline.

### Fourth signal (amber «на розгляді» / в роботі)

- **Amber "In work"** (work, work-dot): a task or complaint someone is working on right now — the «В роботі» and «Розглядаємо» status pills (text in work #8f5200, dot in work-dot #e8950f, fill work-dot at 16%), the current step of a progress track, the unread dot in an inbox and the «N днів без відповіді» warning. Never decoration, never a heading, never a button.

### Neutral

- **Graphite Ink** (ink): text, black capsule buttons (as a #2b2f38 → #0d0f14 gradient), selected day.
- **Slate** (ink-2): secondary strong text, links, filled quota pips.
- **Muted Slate** (muted): supporting copy, unselected tab and segment labels.
- **Faint Slate** (faint): scale ticks, hour labels, credit line.
- **Opaque Booked Grey** (booked): booked segments in day strips, solid and opaque so they never read as a shade of free. **Booked Port Grey** (booked-port) is the porthole dot of a busy machine.
- **Field Mint / Sky / Lilac / Base** (field-*): the three radial washes and the base of the background field.
- **Danger Red** (danger): cancel actions and invalid input outlines only.
- **Porthole Mint** (porthole-mint): the status dot inside ticket pills.

Hairlines are ink at 8% alpha; glass is white at 56% (tiles) and 78% (controls).

### Named Rules

**The Four Signals Rule.** Ultramarine means yours, teal means free, coral means now, amber means in work (added with the v2 board and complaints). No colour takes a second job, and no fifth signal colour is added. Danger red appears only on destructive actions; a rejected complaint is not destructive and stays neutral.

**The Ultramarine Is Yours Rule.** Never use ultramarine for other people's bookings, for general accents, for headings or for decorative fills. If it is not the resident's own booking or own current choice, it is not ultramarine.

**The Opaque Booked Rule.** Booked time is an opaque grey (booked) segment, not a translucent tint; free time is the teal-tinted track it sits on.

## Typography

**Display Font:** Fixel Display Black 900 (with Fixel Text, system-ui)
**Body Font:** Fixel Text 400/500/600/700 (with -apple-system, Segoe UI, system-ui)

Both families are self-hosted (`apps/web/app/fonts`).

**Character:** A Ukrainian-made grotesque used plainly — tight negative tracking on headings, sentence case everywhere — with the Black display cut kept as a stamp for numbers you need to read across a room.

### Hierarchy

- **Display — time** (900, 46px; 42px compact, 48px large; line-height 1; -0.035em; tabular): the start–end time on the booking card. The en dash between times drops to Fixel Text 400 at 0.6em.
- **Hero** (700, 44px, 1, -0.04em): sign-in headline only.
- **Headline** (700, 28px, 1.1, -0.035em): screen titles; machine-day title steps down to 24px.
- **Title** (700, 18px, -0.02em): section headings; tile and machine names at 17px.
- **Body** (400, 15px, 1.5): running copy; ledes in muted.
- **Label** (600, 13.5px): state pills, sublabels, helper text; scale ticks at 11.5–12px in faint.

### Named Rules

**The Display Is For Numbers Rule.** Fixel Display Black sets times and duration numerals only — never headings, names or sentences.

**The Tabular Times Rule.** Times, dates in pickers, strip scales and the scrubber readout use tabular figures (`font-feature-settings: "tnum"`) so they do not jitter.

**The Sentence Case Rule.** No uppercase labels and no tracked-out small caps; hierarchy comes from size and weight.

## Layout

Single column on a phone (designed at 390px, must hold at 360px and still fit at 320px). Screen content sits in 16px side margins, with at least 16px top padding (the safe area on notched phones) and 120px bottom padding to clear the floating tab bar or action sheet. Sections are separated by 26px above a title row (title left, a 44px text link right). Inside lists and rows the gap is 8–12px; tile padding is 16px (14–18px by density).

Horizontal choice rows (days) scroll sideways with hidden scrollbars rather than wrapping, bleeding to the screen edge with room for their shadows. The tab bar and the booking action sheet are fixed and centred, at most 456px wide, 12px from the sides on phones and 14px above the bottom safe area. Below 360px the scrubber time steps down to 24px.

Wider screens work but the phone stays the main case: from 720px the column grows to 600px; from 1024px the home page uses two columns (up to 1040px) with the machines panel sticky.

In the app the background is currently the flat field base (#edf2f8); the drifting mint, sky and lilac washes exist only in the mockup (the `Field` element is an empty hook). All motion collapses under `prefers-reduced-motion`; all glass becomes opaque near-white (#fbfcfd) under `prefers-reduced-transparency`.

## Elevation & Depth

Depth is glass, not stacking. Tiles and bars are translucent white with backdrop blur (18–22px, saturate 170–180%) and a layered shadow that combines an inner rim light along the top edge, an inner glow near the bottom, and one long, soft, cool-tinted drop. Small controls (day options, avatars, icon buttons) use a lighter gloss shadow. The booking card carries its own ultramarine-tinted drop. There are no hard offset shadows and no borders around surfaces.

### Shadow Vocabulary

- **Glass** (`inset 0 1px 1px rgb(255 255 255 / .95), inset 0 -1px 1px rgb(255 255 255 / .35), inset 0 -22px 34px -26px rgb(255 255 255 / .8), 0 1px 2px rgb(16 18 23 / .05), 0 20px 40px -24px rgb(31 45 90 / .28)`): tiles, tab bar, action sheet.
- **Gloss** (`inset 0 1px 0 #fff, 0 1px 2px rgb(16 18 23 / .08), 0 6px 16px -6px rgb(16 18 23 / .2)`): options, avatars, icon buttons, the sliding pill, other people's timeline blocks.
- **Ticket** (`inset 0 1px 1px rgb(255 255 255 / .35), inset 0 -30px 50px -40px rgb(160 180 255 / .7), 0 26px 44px -22px rgb(27 35 163 / .6)`): the booking card.
- **Capsule** (`inset 0 1px 0 rgb(255 255 255 / .16), 0 10px 22px -10px rgb(16 18 23 / .6)`): black primary buttons and the central tab.

### Named Rules

**The One Solid Object Rule.** Everything floats as glass; only the resident's booking is solid and saturated.

## Shapes

Soft and continuous: no square corners anywhere in the product. Glass tiles 26px, the booking card and action sheet 28px, the tab bar 30px, rows and day options 18–20px, inputs 16px, timeline blocks 16px, segments inside a strip 6px. Every button, state pill, segmented control and strip track is a full capsule (999px). The mark is the facade: a 30px graphite squircle (23% radius) with a 3×3 grid of 4.5-radius windows — three white, five at 16% white, one ultramarine for «твоє вікно». It stays legible down to 32px; at 16px use it only with the wordmark beside it.

Circles carry the porthole motif: the concentric rings with a water line drawn into the top-right of the booking card (white strokes at 30% opacity), and the ringed state dot before each machine name.

Hatching (−45° diagonal ink lines at 7–10% alpha) marks the 5-minute buffer on either side of a booking, in strips and on the timeline. Free windows on the timeline use a dashed teal outline.

## Components

### Buttons

Tactile capsules that compress slightly when pressed.

- **Shape:** full capsule, 52px tall, 22px side padding, 16px/600 label.
- **Primary:** graphite gradient (#2b2f38 → #0d0f14) with white text and the capsule shadow; brightens 15% on hover; scales to 0.97 on press. Disabled: ink at 18% with 45% ink text, no shadow.
- **Soft:** strong glass with gloss shadow and ink text; becomes solid white on hover.
- **Ghost danger:** transparent with danger-red text; a 7% red wash on hover.
- **On the ticket:** a white 94% capsule, 44px, deep-ultramarine text.
- **Focus:** 2px ultramarine outline with 2px offset across all controls.

### Day Options

- **Duration:** chosen on the scrubber by stretching the frame (see the scrubber rule above); the home screen offers five quick lengths in a segmented control.
- **Day:** 66×64px tiles, 18px radius; weekday in small muted text over the date. Selected turns graphite ink, not ultramarine — the day is a filter, not your booking.
- **Segmented control:** capsule track at ink 7% with the white sliding pill; selected label in ink 600.
- **Machine picker:** three equal options in an ink-6% track (22px radius); short name over the first free start in teal; the white sliding pill marks the chosen machine.

### Cards / Containers

- **Glass tile:** 26px radius, white 56% with blur, glass shadow, no border, 16px padding. Rows inside a tile are divided by 8% ink hairlines.
- **Booking ticket (signature):** 28px radius; ultramarine gradient (#3442e6 → mine → mine-deep) with two radial glows; porthole rings in the top-right; date line in 80% white, time in Display, machine name 18px/600; a foot row above a 18% white hairline with the countdown and a white «Деталі» capsule. Optional status pill (white 16%) with a mint porthole dot.
- **Notes and past rows:** ink 4% fill, 14–16px radius, muted text, stroke icon in faint.

### Inputs / Fields

- **Style:** 52px, 16px radius, white 80% with a 1px inset ink-12% ring; 17px/600 value; labels 14px/600 above, help text 13px muted below. A prefix field («@») keeps the prefix in muted.
- **Focus:** solid white with a 2px inset ink ring and a 4px ink-8% halo.
- **Error:** 2px inset danger-red ring.

### Navigation

- **Top bar:** mark and wordmark (19px/700, −0.035em) left, 40px glass avatar right; inner screens use a 44px round glass back button.
- **Tab bar:** floating glass bar (30px radius, white 62%, blur 22px) with one equal column per section: today «Пральня · Моє», later «Головна · Пральня · Дошка · Моє». No central action: each section owns its actions (the laundry page has the black «Записатися»). The current section sits on one white gloss pill (its own element, so it glides between tabs on page changes); tab labels 12px/600, muted; current in ink.
- **Announcements:** the important one is the home page's largest glass card, its cover bleeding to the card's edges (16:9), a bell and «Важливе», the title, then the time in Fixel Display beside the day and place. Events are rows with a tear-off calendar leaf (graphite weekday band, day number) and a 64px rounded thumbnail when there is a picture; undated news shows a two-line excerpt and «вчора» / «3 дні тому». An announcement's pictures scroll sideways under the top bar (4:3, 22px radius, snap), the next one peeking in.
- **Our own controls, never browser widgets:** a checkbox is a 24px rounded box (white with a hairline, ink with a white tick when on) inside a soft 4% row; one-of-a-few is a row of capsules (ink when chosen, ultramarine when it is the person's own booking choice); a date is a sideways row of day tiles (weekday, number, month) running to the card's edges, «Без дати» first; the chosen tile is ink without the white top highlight, which would read as a rim. The one exception is time: the phone's own picker (the wheel on iPhone) lies invisibly over our capsule with a clock, the value and a clear button. Announcement details use a visual editor with a sticky toolbar (Ж, К, subheading, lists, link), a white field with an ink outline when focused. Each keeps a real, visually hidden input, so forms post without JavaScript. The search field has no browser clear button.
- **Asking first, in place:** destructive actions never open a browser dialog. A large button turns into the question with a red «Так, …» and a soft «Ні» on a 6% red wash; a small row button arms itself (turns red, says «Точно?») and settles back after five seconds.
- **Filter chips:** a sideways-scrolling row of glass capsules with a count; the chosen chip turns ink, like a chosen day, because a filter is not something of yours.
- **Action sheet:** in the booking flow the same floating glass shape (white 72%) shows the chosen machine and time with a primary button.

### Statuses and Progress

- **In the app today:** a proposed announcement shows «На розгляді» as the amber ring pill and a rejected one «Відхилено» as a neutral outline; the deciders' queue count is an amber pill. The board and complaints below are still mockup-only.

- **Status pill:** one capsule shape, five states. «Нове / Надіслано» on ink 7%; «На розгляді» as an amber ring with a hollow dot; «В роботі» amber on amber 16%; «Готово / Вирішено» slate with a white check; «Відхилено» a neutral outline, never red.
- **Progress track:** steps joined by a 2px line; done steps slate with a check, the current step an amber dot whose ring breathes (stops under reduced motion), later steps hollow. The same track sits on a public task and inside the resident's own complaint card.
- **Complaint card:** the resident's own complaint uses the ticket's ultramarine document card (porthole included), because it is theirs; the track inside it turns white and amber.
- **Anonymous plate:** the one graphite tile in the product, used only where the resident is absent (anonymous complaint form).

### Day Strip (signature)

Each machine's day (06–24) as a capsule track: teal-tinted free fill; opaque grey booked segments (6px radius); hatched buffer flanks; your booking as an ultramarine segment; time already past veiled in pale grey; a 2px coral now-line with a dot. Height 26px full, 20px in compact rows; tabular 11.5px scale beneath.

### Machine State

- **Porthole dot:** 22px ring with a filled centre in teal (free) or booked-port grey (busy).
- **State pill:** capsule, 13.5px/600, a 7px dot in current colour; free on teal 13% wash, busy on ink 7%.

### Machine Timeline

Hours down the left in faint tabular labels with dashed 8% hairlines. Other people's bookings are white glass blocks (time, name, room and Telegram username); yours is an ultramarine block; free windows are dashed teal outlines with a round teal plus; buffers are hatched; now is a coral line with a coral time pill.

## Do's and Don'ts

### Do:

- **Do** keep ultramarine (mine) for the resident's own booking and own current choice only.
- **Do** show free in teal (free) text and teal-tinted fills, booked as opaque grey (booked), and now in coral (now).
- **Do** set times and duration numerals in Fixel Display Black with tabular figures; everything else in Fixel Text.
- **Do** build surfaces as white glass tiles (26px radius) with the glass shadow over the pastel field, and provide the opaque fallback for reduced transparency.
- **Do** make every interactive target at least 44px, and primary actions 52px black capsules.
- **Do** use hatching for the 5-minute buffer flanks.
- **Do** carry the porthole motif in the ticket rings and machine state dots, and use the facade mark (the one ultramarine window is the only colour in it).
- **Do** write plain Ukrainian with no loanwords, and keep the developer credit to one modest line in faint text.

### Don't:

- **Don't** use ultramarine for other people's bookings, headings, links or decoration.
- **Don't** use hatching for anything other than buffers.
- **Don't** draw time as a grey ruled admin calendar grid or dress it up as a paper notebook.
- **Don't** use state symbols (тризуб, national emblem), the Дія name or marks, or anything that implies a government or university service.
- **Don't** add a dark theme; the product is light only.
- **Don't** use square corners or hard offset shadows, and don't outline surfaces with borders (the dashed outline belongs to free timeline windows).
- **Don't** set uppercase labels or put Fixel Display on words.
- **Don't** carry the mockup canvas (phone bezels, captions, jump navigation) into the product.
