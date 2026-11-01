import { and, asc, eq, sql } from "drizzle-orm";

import { activity, getDb } from "./db";
import { residents, roleGrants, type Role } from "./db/schema";
import { canManageRoles, canRevokeRole, type Actor } from "./permissions";
import { isRole, normalizeEmail, sortRoles } from "./roles";

/** The roles granted to this email address. */
export async function rolesFor(env: Env, email: string): Promise<Role[]> {
  const rows = await getDb(env)
    .select({ role: roleGrants.role })
    .from(roleGrants)
    .where(eq(roleGrants.email, email.toLowerCase()))
    .all();
  return sortRoles(rows.map((r) => r.role));
}

/** Every grant with the person's name if they have signed in already. */
export async function listGrants(env: Env) {
  return getDb(env)
    .select({
      id: roleGrants.id,
      email: roleGrants.email,
      role: roleGrants.role,
      createdAt: roleGrants.createdAt,
      residentId: residents.id,
      name: residents.name,
      room: residents.room,
    })
    .from(roleGrants)
    .leftJoin(residents, sql`lower(${residents.email}) = ${roleGrants.email}`)
    .orderBy(asc(roleGrants.role), asc(roleGrants.email))
    .all();
}

export type GrantResult =
  | { ok: true; email: string; role: Role; pending: boolean }
  | { ok: false; error: string };

export async function grantRole(
  env: Env,
  actor: Actor,
  form: FormData,
): Promise<GrantResult> {
  if (!canManageRoles(actor))
    return { ok: false, error: "Ролі видає лише розпорядник." };
  const email = normalizeEmail(form.get("email"));
  if (!email)
    return { ok: false, error: "Вкажіть пошту Політехніки: імʼя@lpnu.ua." };
  const role = form.get("role");
  if (!isRole(role)) return { ok: false, error: "Оберіть роль." };

  const db = getDb(env);
  const existing = await db
    .select({ id: roleGrants.id })
    .from(roleGrants)
    .where(and(eq(roleGrants.email, email), eq(roleGrants.role, role)))
    .get();
  if (existing) return { ok: false, error: "Ця роль у людини вже є." };

  const row = await db
    .insert(roleGrants)
    .values({ email, role, grantedBy: actor.id, createdAt: Date.now() })
    .returning({ id: roleGrants.id })
    .get();
  await activity(db, {
    actorId: actor.id,
    action: "role.granted",
    entity: "role_grant",
    entityId: row.id,
    details: { email, role },
  });
  const person = await db
    .select({ id: residents.id })
    .from(residents)
    .where(sql`lower(${residents.email}) = ${email}`)
    .get();
  return { ok: true, email, role, pending: !person };
}

export async function revokeRole(
  env: Env,
  actor: Actor & { email: string },
  grantId: number,
): Promise<boolean> {
  const db = getDb(env);
  const grant = await db
    .select()
    .from(roleGrants)
    .where(eq(roleGrants.id, grantId))
    .get();
  if (!grant || !canRevokeRole(actor, grant)) return false;
  await db.delete(roleGrants).where(eq(roleGrants.id, grantId));
  await activity(db, {
    actorId: actor.id,
    action: "role.revoked",
    entity: "role_grant",
    entityId: grant.id,
    details: { email: grant.email, role: grant.role },
  });
  return true;
}
