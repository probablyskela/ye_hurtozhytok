# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React Router v7 (framework mode) on a Cloudflare Worker, D1, Drizzle, Tailwind CSS v4. Installed as a PWA; same stack as the team's earlier app Оперета. Details in `docs/system/README.md`.

## Users

Residents of dormitory №14, several hundred students, Ukrainian-speaking. They open the app on their phones, usually in a hallway, in their room, or standing next to a washing machine, often one-handed and in a hurry. Their job in v1: find a free time on one of three washing machines, book it, get reminded, and cancel or free it early when plans change.

Secondary: members of the student council, who can cancel any booking and block people.

## Product Purpose

Replace two paper notebooks (an append-only queue of name, room and Telegram nick) with booking a specific machine for a specific time. Success: residents stop writing in the notebooks because the app is faster and they know in advance when they will wash, without watching a queue.

Later modules: announcements, a transparent student-council task board, online payment for laundry.

## Positioning

The app is built by the team of Софія Полупан, a candidate for head of the student council, ahead of the council elections. It is the team's argument in the campaign: instead of promising, it shows working, useful software for the dorm. Its persuasive power comes from being genuinely better than the notebook, not from campaign messaging.

## Operating Context

- Three Samsung machines: «4 поверх», «6 поверх, №1», «6 поверх, №2» (numbered stickers on the machines). Anyone may use any machine.
- Booking: 15-minute start grid, 30 min to 2.5 h, 15-minute buffer between bookings, up to 3 unfinished bookings per person, up to 7 days ahead. The resident picks one of five lengths (30 min, 1, 1.5, 2, 2.5 h); the interface does not talk about machine programs.
- Sign-in with the university Google account (@lpnu.ua); the user rejected Telegram sign-in. Telegram nicks are how residents contact each other today, so a nick stays an optional profile field.
- QR stickers on machines lead to that machine's page.
- Reminders via Web Push in the installed PWA, with email to the @lpnu.ua address as fallback.

## Capabilities and Constraints

- Ukrainian only, plain language, no English loanwords or slang («запис», not «бронь/слот»).
- Phone first; installed-PWA use on iPhone and Android is the main case. Forms work without JavaScript; offline is read-only.
- Open: allowed laundry hours; how prominent the campaign credit is in the interface.

## Brand Commitments

- Name: «єГуртожиток». No existing logo, colors or channel; identity is created from scratch.
- Visual references named by the user: their own redesign of Кривда (telegram_monitor) and the design language of Ukrainian state apps such as Дія. These are references for clarity and craft, not identities to copy: no state symbols (тризуб, national emblem), no Дія name or marks, nothing that suggests the app is a government or university service — especially sensitive in an election context.

## Evidence on Hand

- Photos of the machines and the notebooks (shared in conversation, not in the repo).
- Program durations from Samsung's WW…T user manual; machine displays showed ≈1:40 for everyday programs.
- No users, testimonials, usage numbers or endorsements exist yet; do not invent them.

## Product Principles

1. Faster than the notebook: booking a time takes fewer taps than finding a pen.
2. Show, don't campaign: usefulness is the message; campaign credit stays modest and honest.
3. Trust through clarity: always obvious what is free, what is yours, and what happens next.
4. One hand, one glance: every key action reachable by thumb, every state readable at a glance near the machine.
5. Fair by default: limits and buffers are visible rules, not hidden surprises.

## Accessibility & Inclusion

WCAG 2.2 AA; touch targets at least 44px; must stay usable on low-end Android phones and small screens (360px wide).
