# єГуртожиток

Вебзастосунок для мешканців гуртожитку №14. Головне — зручно працювати з
телефона: застосунок встановлюється на початковий екран як PWA.

Перша версія вміє одне: **записатися на пралку** замість паперового зошита.
Працює на https://ehurtozhytok.pages.dev.

- Три пралки: одна на 4 поверсі, дві на 6-му (№1 і №2).
- Обираєш, скільки прати (30 хв – 2,5 год, кроком 5 хвилин), і бачиш вільний час на кожній
  пралці на 7 днів; на головній найближчий вільний час записує одним натисканням.
- Вхід через університетську пошту @lpnu.ua, нагадування за 15 хвилин до початку.

Далі будуть оголошення, прозора дошка завдань студради та онлайн-оплата прання.

## Стек

Cloudflare Workers, D1 (SQLite), React Router v7 у режимі фреймворку,
Drizzle ORM, Tailwind CSS v4. Той самий стек, що й в Опереті.

## Запуск

```bash
npm install
cp -n apps/web/.dev.vars.example apps/web/.dev.vars
npm run db:migrate:local
npm run dev
```

Подробиці, перевірки й публікація — у [docs/run-project.md](docs/run-project.md).

## Документи

- [docs/VISION.md](docs/VISION.md) — що й навіщо робимо, правила запису.
- [docs/system/README.md](docs/system/README.md) — архітектура, дані, вхід.
- [CONTEXT.md](CONTEXT.md) — словник продукту.
- [docs/launch-plan.md](docs/launch-plan.md) — план запуску першої версії.
- [docs/run-project.md](docs/run-project.md) — запуск, публікація, вхід через Google.
- [DESIGN.md](DESIGN.md), [PRODUCT.md](PRODUCT.md) — дизайн-система й контекст продукту.
