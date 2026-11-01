/**
 * Grants a role by email; works before the person's first sign-in. Used to
 * appoint the first site manager, who then hands out roles in the app.
 *   npm run role:grant -- --email someone@lpnu.ua --role site_manager            (local)
 *   npm run role:grant -- --email someone@lpnu.ua --role site_manager --remote   (production)
 * Roles: council, council_head, squad, squad_head, site_manager.
 */
import { execFileSync } from "node:child_process";

// Same list as ROLES in app/lib/db/schema.ts (scripts build separately).
const ROLES = [
  "council",
  "council_head",
  "squad",
  "squad_head",
  "site_manager",
] as const;

const args = process.argv.slice(2);
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1]?.trim() : undefined;
};
const email = value("--email")?.toLowerCase();
const role = value("--role");
if (!email || !/^[a-z0-9._%+-]+@lpnu\.ua$/.test(email)) {
  console.error("Вкажіть пошту: --email імʼя@lpnu.ua");
  process.exit(1);
}
if (!role || !(ROLES as readonly string[]).includes(role)) {
  console.error(`Вкажіть роль: --role ${ROLES.join(" | ")}`);
  process.exit(1);
}
const where = args.includes("--remote") ? "--remote" : "--local";
const sql = `INSERT OR IGNORE INTO role_grants (email, role, granted_by, created_at) VALUES ('${email}', '${role}', NULL, ${Date.now()});`;
execFileSync(
  "npx",
  ["wrangler", "d1", "execute", "ehurtozhytok", where, "--command", sql],
  { stdio: "inherit" },
);
console.log(`Готово: ${email} має роль ${role}.`);
