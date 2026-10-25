/**
 * Gives a signed-up resident student-council rights.
 *   npm run council:add -- --email someone@lpnu.ua            (local database)
 *   npm run council:add -- --email someone@lpnu.ua --remote   (production)
 * The person must have signed in at least once.
 */
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const email = args[args.indexOf("--email") + 1]?.trim().toLowerCase();
if (!email || !/^[a-z0-9._%+-]+@lpnu\.ua$/.test(email)) {
  console.error("Вкажіть пошту: --email імʼя@lpnu.ua");
  process.exit(1);
}
const where = args.includes("--remote") ? "--remote" : "--local";
const sql = `UPDATE residents SET role = 'council', updated_at = ${Date.now()} WHERE email = '${email.replace(/'/g, "''")}';`;
execFileSync(
  "npx",
  ["wrangler", "d1", "execute", "ehurtozhytok", where, "--command", sql],
  {
    stdio: "inherit",
  },
);
console.log(
  `Готово: ${email} тепер у студраді (якщо вже входив у застосунок).`,
);
