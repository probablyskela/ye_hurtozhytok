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
  display-duration:
    fontFamily: "Fixel Display, Fixel Text, -apple-system, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.03em"
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
  chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.mine}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
  duration-option:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.display-duration}"
    rounded: "{rounded.row}"
    height: "72px"
  duration-option-selected:
    backgroundColor: "{colors.mine}"
    textColor: "{colors.white}"
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

Density is phone-first and generous: 16px screen margins, 44px minimum targets, one idea per glass tile. Language is clarity and craft in the spirit of Ukrainian state-services apps, without borrowing any of their identity: no state symbols, no Дія name or marks, nothing that suggests a government or university service. The UI is light only, Ukrainian only, with plain words and no loanwords («сповіщення», not «пуші»; «ім’я користувача в Telegram», not «нік»; «запис», not «бронь»). Campaign credit is a single modest, honest line in faint small text, never a banner.

The direction rejected the grey admin calendar grid and the paper-notebook costume; time is shown as capsule ribbons and soft blocks, not ruled cells.

Scope note: the presentation canvas in `design/mockup/index.html` (phone bezels, status bar, captions under each phone, the page heading and the jump navigation) is mockup chrome, not part of the product system. Do not carry its styles into the app.

**Key Characteristics:**

- White liquid-glass tiles (26px radius, rim light, long soft shadow) over a drifting pastel field.
- One saturated object per screen: the ultramarine booking card, or the selected duration and start.
- Black capsule primary buttons; everything is a pill or a generously rounded tile.
- Fixel Display Black only for times and duration numerals; Fixel Text for everything else.
- The day strip: each machine's day as a capsule ribbon with booked segments, hatched buffers and a coral now-marker.
- The time scrubber: the day slides under a fixed ultramarine frame the size of the booking (18px per 15 minutes, native momentum scroll with snap points); the frame turns red on busy time and glides to the nearest free start when released.
- Motion: view transitions between screens (the ticket morphs from home to its detail), tiles rise once on first appearance, the ticket catches light once, a ripple spreads from the porthole after booking, a busy machine's drum turns and a free one breathes, the now-marker pulses. Everything stops under reduced motion.
- The porthole motif: ticket rings and machine state dots.
- The facade mark: a black squircle holding a 3×3 grid of rounded windows — three lit white, five dim, one ultramarine («твоє вікно»).

## Colors

A cool pastel field under white glass, graphite ink, and exactly three signal colours that each mean one thing.

### Primary

- **Ultramarine "Yours"** (mine): reserved for what belongs to the signed-in resident — the booking card, your segment in a day strip, your block in the machine timeline, the selected duration and the selected start. Also the focus outline, caret and text selection.
- **Deep Ultramarine** (mine-deep): the dark end of the ticket gradient and the text colour of the white button on the ticket.
- **Pale Ultramarine** (mine-soft): the icon well for "your other booking" rows.

### Secondary

- **Pool Teal "Free"** (free): free state text, the free porthole dot, the plus button on a free timeline window, and the "on" state of switches. The lighter **Aqua tint** (free-tint) is used only as low-alpha fills and strokes (13% track fill, 6% window fill, dashed outline) — never as text.

### Tertiary

- **Coral Now** (now): the now-marker only — the vertical line and dot on day strips, the horizontal line and time pill on the timeline.

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

**The Three Signals Rule.** Ultramarine means yours, teal means free, coral means now. No colour takes a second job, and no fourth signal colour is added. Danger red appears only on destructive actions.

**The Ultramarine Is Yours Rule.** Never use ultramarine for other people's bookings, for general accents, for headings or for decorative fills. If it is not the resident's own booking or own current choice, it is not ultramarine.

**The Opaque Booked Rule.** Booked time is an opaque grey (booked) segment, not a translucent tint; free time is the teal-tinted track it sits on.

## Typography

**Display Font:** Fixel Display Black 900 (with Fixel Text, system-ui)
**Body Font:** Fixel Text 400/500/600/700 (with -apple-system, Segoe UI, system-ui)

Both families are self-hosted (`design/mockup/fonts`).

**Character:** A Ukrainian-made grotesque used plainly — tight negative tracking on headings, sentence case everywhere — with the Black display cut kept as a stamp for numbers you need to read across a room.

### Hierarchy

- **Display — time** (900, 46px; 42px compact, 48px large; line-height 1; -0.035em; tabular): the start–end time on the booking card. The en dash between times drops to Fixel Text 400 at 0.6em.
- **Display — duration** (900, 24px, 1.05, -0.03em): the numeral on duration options.
- **Hero** (700, 44px, 1, -0.04em): sign-in headline only.
- **Headline** (700, 28px, 1.1, -0.035em): screen titles; machine-day title steps down to 24px.
- **Title** (700, 18px, -0.02em): section headings; tile and machine names at 17px.
- **Body** (400, 15px, 1.5): running copy; ledes in muted.
- **Label** (600, 13.5px): state pills, sublabels, helper text; scale ticks at 11.5–12px in faint.

### Named Rules

**The Display Is For Numbers Rule.** Fixel Display Black sets times and duration numerals only — never headings, names or sentences.

**The Tabular Times Rule.** Times, dates in pickers, strip scales and chip times use tabular figures (`font-feature-settings: "tnum"`) so they do not jitter.

**The Sentence Case Rule.** No uppercase labels and no tracked-out small caps; hierarchy comes from size and weight.

## Layout

Single column on a phone (designed at 390px, must hold at 360px). Screen content sits in 16px side margins, with 54px top padding under the status area and 120px bottom padding to clear the floating tab bar or action sheet. Sections are separated by 26px above a title row (title left, a 44px text link right). Inside lists and rows the gap is 8–12px; tile padding is 16px (14–18px by density).

Horizontal choice rows (chips, days) scroll sideways with hidden scrollbars rather than wrapping. Duration options sit in a five-column equal grid. The tab bar and the booking action sheet float 12px from the sides and 14px from the bottom; on small screens they become sticky.

The background field drifts slowly (26s, alternate). All motion collapses under `prefers-reduced-motion`; all glass becomes opaque near-white (#fbfcfd) under `prefers-reduced-transparency`.

## Elevation & Depth

Depth is glass, not stacking. Tiles and bars are translucent white with backdrop blur (18–22px, saturate 170–180%) and a layered shadow that combines an inner rim light along the top edge, an inner glow near the bottom, and one long, soft, cool-tinted drop. Small controls (chips, day and duration options, avatars, icon buttons) use a lighter gloss shadow. The booking card carries its own ultramarine-tinted drop. There are no hard offset shadows and no borders around surfaces.

### Shadow Vocabulary

- **Glass** (`inset 0 1px 1px rgb(255 255 255 / .95), inset 0 -1px 1px rgb(255 255 255 / .35), inset 0 -22px 34px -26px rgb(255 255 255 / .8), 0 1px 2px rgb(16 18 23 / .05), 0 20px 40px -24px rgb(31 45 90 / .28)`): tiles, tab bar, action sheet.
- **Gloss** (`inset 0 1px 0 #fff, 0 1px 2px rgb(16 18 23 / .08), 0 6px 16px -6px rgb(16 18 23 / .2)`): chips, options, avatars, icon buttons, the segmented-control thumb, other people's timeline blocks.
- **Ticket** (`inset 0 1px 1px rgb(255 255 255 / .35), inset 0 -30px 50px -40px rgb(160 180 255 / .7), 0 26px 44px -22px rgb(27 35 163 / .6)`): the booking card.
- **Capsule** (`inset 0 1px 0 rgb(255 255 255 / .16), 0 10px 22px -10px rgb(16 18 23 / .6)`): black primary buttons and the central tab.

### Named Rules

**The One Solid Object Rule.** Everything floats as glass; only the resident's booking is solid and saturated.

## Shapes

Soft and continuous: no square corners anywhere in the product. Glass tiles 26px, the booking card and action sheet 28px, the tab bar 30px, rows and day/duration options 18–20px, inputs 16px, timeline blocks 16px, segments inside a strip 6px. Every button, chip, state pill, segmented control and strip track is a full capsule (999px). The mark is the facade: a 30px graphite squircle (23% radius) with a 3×3 grid of 4.5-radius windows — three white, five at 16% white, one ultramarine for «твоє вікно». It stays legible down to 32px; at 16px use it only with the wordmark beside it.

Circles carry the porthole motif: the concentric rings with a water line drawn into the top-right of the booking card (white strokes at 30% opacity), and the ringed state dot before each machine name.

Hatching (−45° diagonal ink lines at 7–10% alpha) marks the 15-minute buffer on either side of a booking, in strips and on the timeline. Free windows on the timeline use a dashed teal outline.

## Components

### Buttons

Tactile capsules that compress slightly when pressed.

- **Shape:** full capsule, 52px tall, 22px side padding, 16px/600 label.
- **Primary:** graphite gradient (#2b2f38 → #0d0f14) with white text and the capsule shadow; brightens 15% on hover; scales to 0.97 on press. Disabled: ink at 18% with 45% ink text, no shadow.
- **Soft:** strong glass with gloss shadow and ink text; becomes solid white on hover.
- **Ghost danger:** transparent with danger-red text; a 7% red wash on hover.
- **On the ticket:** a white 94% capsule, 44px, deep-ultramarine text.
- **Focus:** 2px ultramarine outline with 2px offset across all controls.

### Chips

- **Style:** strong glass capsule, 44px, 16px padding, 15px/600 time label with optional muted small text.
- **State:** selected (`aria-pressed`) turns solid ultramarine with white text and an ultramarine glow — a selected start is "yours". Press scales to 0.96.

### Duration and Day Options

- **Duration:** five equal tiles, 72px tall, 20px radius; Fixel Display numeral over a 12.5px muted unit. Selected turns ultramarine.
- **Day:** 66×64px tiles, 18px radius; weekday in small muted text over the date. Selected turns graphite ink, not ultramarine — the day is a filter, not your booking.
- **Segmented control:** capsule track at ink 7% with a white gliding thumb (0.42s); selected label in ink 600.

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
- **Tab bar:** floating glass bar (30px radius, white 62%, blur 22px) with three columns: «Головна», a central black capsule «Записатися» with a plus icon, «Мої записи». Tab labels 12px/600, muted; current page in ink.
- **Action sheet:** in the booking flow the same floating glass shape (white 72%) shows the chosen machine and time with a primary button.

### Day Strip (signature)

Each machine's day (08–22) as a capsule track: teal-tinted free fill; opaque grey booked segments (6px radius); hatched buffer flanks; your booking as an ultramarine segment; time already past veiled in pale grey; a 2px coral now-line with a dot. Height 26px full, 20px in compact rows; tabular 11.5px scale beneath. Choosing a start makes your segment glide into place (0.5s, scale-in from the left).

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
- **Do** use hatching for the 15-minute buffer flanks.
- **Do** carry the porthole motif in the ticket rings and machine state dots, and use the facade mark (the one ultramarine window is the only colour in it).
- **Do** write plain Ukrainian with no loanwords, and keep the campaign credit to one modest, honest line in faint text.

### Don't:

- **Don't** use ultramarine for other people's bookings, headings, links or decoration.
- **Don't** use hatching for anything other than buffers.
- **Don't** draw time as a grey ruled admin calendar grid or dress it up as a paper notebook.
- **Don't** use state symbols (тризуб, national emblem), the Дія name or marks, or anything that implies a government or university service.
- **Don't** add a dark theme; the product is light only.
- **Don't** use square corners or hard offset shadows, and don't outline surfaces with borders (the dashed outline belongs to free timeline windows).
- **Don't** set uppercase labels or put Fixel Display on words.
- **Don't** carry the mockup canvas (phone bezels, captions, jump navigation) into the product.
