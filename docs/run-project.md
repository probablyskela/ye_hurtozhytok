# Запуск і публікація

## Вимоги

Node 20.19 або новіший, npm.

## Локально

Усі команди — з кореня репозиторію (`ye-hurtozhytok/`), не з `apps/web`.

```bash
npm install
cp -n apps/web/.dev.vars.example apps/web/.dev.vars   # якщо файлу ще немає; впиши SESSION_SECRET
npm run db:migrate:local                               # на питання відповісти Y
npm run dev                                            # адресу показує в терміналі
```

Якщо змінився `database_id` у `wrangler.jsonc`, локальна база створюється
заново й міграції треба застосувати ще раз (вона буде порожня, лише пралки).

Поки `GOOGLE_CLIENT_ID` порожній, а `DEV_LOGIN=1`, на `/login` (адресу показує `npm run dev`)
є форма входу без Google: будь-яке імʼя й адреса `@lpnu.ua`. Ця форма працює
лише на localhost і зникає, щойно задано Google-клієнт.

Ключі для нагадувань локально: `npm run vapid:keys --workspace @ehurtozhytok/web`,
обидва значення в `.dev.vars`.

Роль видає скрипт; людині не обовʼязково вже входити. Далі ролі роздає
розпорядник у застосунку («Моє → Ролі»):

```bash
npm run role:grant -- --email імʼя@lpnu.ua --role site_manager
```

## Перевірки

```bash
npm run format
npm run typecheck
npm test
npm run build
```

## Публікація на Cloudflare

Застосунок працює на https://ehurtozhytok.pages.dev: Pages-проєкт
`ehurtozhytok` (`apps/gateway`) пересилає всі запити Worker'у `ehurtozhytok`
(`apps/web`). Продакшен-база D1 уже створена, її `database_id` і публічний
ключ VAPID записані в `apps/web/wrangler.jsonc`.

### Автоматично з GitHub

Кожен push і PR у [serpanchyk/ye_hurtozhytok](https://github.com/serpanchyk/ye_hurtozhytok)
проходить перевірки (`.github/workflows/ci.yml`). Push у `main` після перевірок
застосовує міграції D1, публікує Worker, а Pages-шлюз — лише якщо змінився
`apps/gateway`. Для цього в репозиторії потрібен секрет
`CLOUDFLARE_API_TOKEN` (Settings → Secrets and variables → Actions) з правами
Workers Scripts, D1 і Cloudflare Pages на редагування. Без секрету деплой
пропускається з попередженням, перевірки все одно йдуть.

### Вручну

```bash
cd apps/web
npx wrangler login
npx wrangler secret list                  # що вже задано
npx wrangler secret put SESSION_SECRET    # довгий випадковий рядок
npx wrangler secret put VAPID_PRIVATE_KEY # пара до vars.VAPID_PUBLIC_KEY
npm run db:migrate:remote                 # міграції — перед деплоєм
npm run deploy
cd ../gateway && npm run deploy           # лише коли змінився шлюз
```

Нова пара ключів VAPID (`npm run vapid:keys`) робить недійсними всі наявні
підписки на сповіщення: публічний ключ іде у `vars.VAPID_PUBLIC_KEY`, приватний
— у секрет. Першого розпорядника в продакшені призначає
`npm run role:grant -- --email імʼя@lpnu.ua --role site_manager --remote`
(з кореня).

Якщо потрібна нова база: `npx wrangler d1 create ehurtozhytok`, `id` з
відповіді — у `database_id` у `wrangler.jsonc`.

## Вхід через Google (@lpnu.ua)

1. Зайди в [Google Cloud Console](https://console.cloud.google.com/) **акаунтом
   @lpnu.ua** і створи проєкт «єГуртожиток».
2. «APIs & Services» → «OAuth consent screen»: тип **Internal**, якщо доступний
   (тоді увійти зможуть лише акаунти Політехніки). Якщо ні — **External**,
   дозволи лише `openid`, `email`, `profile`, статус «In production».
3. «Credentials» → «Create credentials» → «OAuth client ID» → «Web application».
   - Authorized JavaScript origins: `https://ehurtozhytok.pages.dev`
   - Authorized redirect URIs: `https://ehurtozhytok.pages.dev/auth/callback`
4. Збережи Client ID і Client secret як секрети:

   ```bash
   cd apps/web
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```

   Форма входу без Google зникає сама: вона працює лише на localhost.

5. Перевір вхід з телефона. Якщо Google пише, що застосунок заблоковано
   адміністратором, університет забороняє сторонні застосунки — тоді
   переходимо на одноразовий код на пошту (див. `docs/launch-plan.md`).

Сервер у будь-якому разі пропускає лише токени з `hd = lpnu.ua` і підтвердженою
поштою.
