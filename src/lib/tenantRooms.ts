import type { Room, Tenant } from "../data";

// Every room a tenant occupies — the main one plus any merged extras.
export function tenantRoomIds(
  t: Pick<Tenant, "roomId"> & { extraRoomIds?: string[] },
): string[] {
  return [t.roomId, ...(t.extraRoomIds ?? [])].filter(Boolean);
}

// A room counts as occupied if it's the tenant's main room OR a merged extra.
export function getTenantForRoomMulti(
  roomId: string,
  tenants: Array<Tenant & { extraRoomIds?: string[] }>,
): (Tenant & { extraRoomIds?: string[] }) | null {
  return tenants.find((t) => tenantRoomIds(t).includes(roomId)) ?? null;
}

// Adds up the rent of every selected room.
export function combinedRentForRooms(roomIds: string[], rooms: Room[]): number {
  return roomIds.reduce(
    (sum, id) => sum + (rooms.find((r) => r.id === id)?.baseRent ?? 0),
    0,
  );
}
