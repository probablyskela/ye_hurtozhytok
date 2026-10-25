# Agent Guide

## Project Purpose

єГуртожиток is a web app for the residents of dormitory №14, used mostly from
phones as an installed PWA. Version 1 does one thing: book a washing machine
for a specific time instead of writing into paper notebooks. Three machines:
one on the 4th floor, two on the 6th (№1 and №2). Later: announcements, a
transparent student-council task board, online payment for laundry.

Residents sign in through a Telegram bot; there is no approval step.

## Source Of Truth

- `README.md`: overview.
- `docs/VISION.md`: product behavior, booking rules, roles.
- `docs/system/README.md`: architecture, data model, auth, notifications.
- `CONTEXT.md`: product glossary only.

When behavior, permissions, data model or setup change, update the relevant
docs in the same change.

## Language

- All user-facing text is plain Ukrainian, no English loanwords or slang:
  «запис», not «бронь» or «слот»; «мешканець», not «юзер».
- Code identifiers, commits and this file stay in English.

## Architecture Rules

- Stack: React Router v7 framework mode on a Cloudflare Worker, D1, Drizzle,
  Tailwind v4. D1 is the only database.
- Bookings store a Kyiv calendar date (`YYYY-MM-DD`) plus `start_min`/`end_min`
  (minutes from Kyiv midnight). Event timestamps are UTC milliseconds shown in
  Kyiv time through `app/lib/time.ts`. Never use the server's local time.
- Booking insert must check overlap (with buffer) and the per-person limit in
  the same SQL statement as the insert.
- Every permission decision goes through `app/lib/permissions.ts`, and every
  action re-checks permissions on the server.
- Write an `activity_log` entry for every change people make.
- Forms must work without JavaScript (React Router `<Form>`); JavaScript only
  enhances them. Offline mode is read-only.

## Testing And Checks

- Unit tests live next to the code as `*.test.ts` (Vitest).
- Cover time conversion, booking rules and free-time search, permissions.

## Git Hygiene

- Commit after every completed change with a Conventional Commit message.
- Never commit `.dev.vars` or Cloudflare / Telegram / VAPID secrets.
