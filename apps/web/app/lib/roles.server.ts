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

export type Person = {
  /** The email is the key: roles are granted by email. */
  email: string;
  residentId: number | null;
  name: string | null;
  room: string | null;
  telegram: string | null;
  blocked: boolean;
  roles: Role[];
};

/**
 * Everyone who has signed in, plus emails that hold a role but have not
 * signed in yet, each with their roles.
 */
export async function listPeople(env: Env): Promise<Person[]> {
  const db = getDb(env);
  const [people, grants] = await Promise.all([
    db
      .select({
        id: residents.id,
        email: residents.email,
        name: residents.name,
        room: residents.room,
        telegram: residents.telegram,
        blocked: residents.blocked,
      })
      .from(residents)
      .orderBy(asc(residents.room), asc(residents.name))
      .all(),
    db
      .select({ email: roleGrants.email, role: roleGrants.role })
      .from(roleGrants)
      .all(),
  ]);
  const byEmail = new Map<string, Role[]>();
  for (const g of grants)
    byEmail.set(g.email, [...(byEmail.get(g.email) ?? []), g.role]);
  const known = new Set<string>();
  const list: Person[] = people.map((p) => {
    const email = p.email.toLowerCase();
    known.add(email);
    return {
      email,
      residentId: p.id,
      name: p.name,
      room: p.room,
      telegram: p.telegram,
      blocked: p.blocked,
      roles: sortRoles(byEmail.get(email) ?? []),
    };
  });
  for (const [email, roles] of byEmail)
    if (!known.has(email))
      list.push({
        email,
        residentId: null,
        name: null,
        room: null,
        telegram: null,
        blocked: false,
        roles: sortRoles(roles),
      });
  return list;
}

export type SetRolesResult =
  | { ok: true; email: string; added: Role[]; removed: Role[]; kept: Role[] }
  | { ok: false; error: string };

/**
 * Makes the person's roles exactly the checked ones. A role the actor may not
 * take away (their own site-manager role) stays and is reported in `kept`.
 */
export async function setRoles(
  env: Env,
  actor: Actor & { email: string },
  form: FormData,
): Promise<SetRolesResult> {
  if (!canManageRoles(actor))
    return { ok: false, error: "Ролі видає лише розпорядник." };
  const email = normalizeEmail(form.get("email"));
  if (!email) return { ok: false, error: "Невідома пошта." };
  const wanted = new Set(form.getAll("role").filter(isRole));

  const db = getDb(env);
  const current = await db
    .select()
    .from(roleGrants)
    .where(eq(roleGrants.email, email))
    .all();
  const have = new Set(current.map((g) => g.role));
  const added = [...wanted].filter((r) => !have.has(r));
  const kept: Role[] = [];
  const removed: Role[] = [];
  for (const g of current) {
    if (wanted.has(g.role)) continue;
    if (!canRevokeRole(actor, g)) {
      kept.push(g.role);
      continue;
    }
    await db.delete(roleGrants).where(eq(roleGrants.id, g.id));
    await activity(db, {
      actorId: actor.id,
      action: "role.revoked",
      entity: "role_grant",
      entityId: g.id,
      details: { email, role: g.role },
    });
    removed.push(g.role);
  }
  for (const role of added) {
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
  }
  return {
    ok: true,
    email,
    added: sortRoles(added),
    removed: sortRoles(removed),
    kept,
  };
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
