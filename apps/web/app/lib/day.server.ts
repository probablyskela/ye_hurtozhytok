import { bookingsOn, listMachines, type BookingRow } from "./bookings.server";
import type { Machine } from "./db/schema";

export type MachineDay = {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  working: boolean;
  bookings: BookingRow[];
};

/** Every machine with its active bookings on one date. */
export async function machinesOn(
  env: Env,
  date: string,
): Promise<MachineDay[]> {
  const [machines, rows] = await Promise.all([
    listMachines(env),
    bookingsOn(env, [date]),
  ]);
  return machines.map((m: Machine) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    shortName: m.shortName,
    working: m.status === "working",
    bookings: rows.filter((b) => b.machineId === m.id),
  }));
}
