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

Члена студради призначає скрипт (людина має хоч раз увійти):

```bash
npm run council:add -- --email імʼя@lpnu.ua
```

## Перевірки

```bash
npm run format
npm run typecheck
npm test
npm run build
```

## Публікація на Cloudflare

Один раз:

```bash
cd apps/web
npx wrangler login
npx wrangler d1 create ehurtozhytok      # id з відповіді → wrangler.jsonc, database_id
npx wrangler d1 migrations apply ehurtozhytok --remote
npx wrangler secret put SESSION_SECRET    # довгий випадковий рядок
npm run vapid:keys                        # публічний → vars.VAPID_PUBLIC_KEY у wrangler.jsonc
npx wrangler secret put VAPID_PRIVATE_KEY # приватний ключ
npm run deploy
cd ../gateway && npm run deploy           # адреса https://ehurtozhytok.pages.dev
```

Після кожної зміни: `npm run deploy` у `apps/web` (міграції — перед цим).

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

5. Перевір вхід з телефона. Якщо Google пише, що застосунок заблоковано
   адміністратором, університет забороняє сторонні застосунки — тоді
   переходимо на одноразовий код на пошту (див. `docs/launch-plan.md`).

Сервер у будь-якому разі пропускає лише токени з `hd = lpnu.ua` і підтвердженою
поштою.
