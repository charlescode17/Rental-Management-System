import { supabase } from "./supabaseClient";
import type { Room, Tenant, Payment } from "../data";

export interface Building {
  id: string;
  name: string;
}

export async function fetchBuildings() {
  const { data, error } = await supabase
    .from("buildings")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
  })) as Building[];
}

export async function addBuilding(building: { id?: string; name: string }) {
  const { data, error } = await supabase
    .from("buildings")
    .insert({ id: building.id, name: building.name })
    .select()
    .single();

  if (error) throw error;
  return { id: data.id, name: data.name } as Building;
}

export async function updateBuilding(id: string, updates: { name: string }) {
  const { data, error } = await supabase
    .from("buildings")
    .update({ name: updates.name })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return { id: data.id, name: data.name } as Building;
}

export async function deleteBuilding(id: string) {
  const { error } = await supabase.from("buildings").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function fetchFloors(buildingId: string) {
  const { data, error } = await supabase
    .from("floors")
    .select("id, building_id, name")
    .eq("building_id", buildingId)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
  })) as Array<{ id: string; name: string }>;
}

export async function addFloor(buildingId: string, name: string) {
  const { data, error } = await supabase
    .from("floors")
    .insert({
      id: `floor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      building_id: buildingId,
      name,
    })
    .select("id, building_id, name")
    .single();

  if (error) throw error;
  return { id: data.id, name: data.name } as { id: string; name: string };
}

export async function deleteFloor(floorId: string) {
  const { error } = await supabase.from("floors").delete().eq("id", floorId);
  if (error) throw error;
  return true;
}

export async function fetchRooms() {
  // FIX: this used to join buildings with `buildings!inner(name)`. An
  // INNER join silently DROPS any room whose building_id doesn't resolve
  // to a real building row (deleted building, bad data, etc) — meaning
  // that room would vanish from every page (Dashboard occupancy counts,
  // Buildings page, Tenants page) with no error or warning. Switched to a
  // regular (left) join so every room always comes back; buildingName is
  // just empty for the rare orphaned one, and the Buildings page already
  // has an "Unassigned Rooms" section to surface those.
  const { data, error } = await supabase
    .from("rooms")
    .select(
      `
      id,
      floor,
      number,
      base_rent,
      building_id,
      buildings(name)
    `,
    )
    .order("number", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    floor: row.floor,
    number: row.number,
    baseRent: row.base_rent,
    occupied: false,
    tenantId: undefined,
    buildingId: row.building_id,
    buildingName: row.buildings?.name ?? "",
  })) as Room[] & { buildingName?: string; buildingId?: string }[];
}

export async function fetchTenants() {
  // FIX: same issue as fetchRooms — this used to inner-join rooms (and
  // buildings within rooms). If a tenant's room was ever deleted or
  // pointed at a building that no longer exists, that tenant would
  // silently disappear from every list (Tenants page, Dashboard occupancy,
  // "Needs Attention" reminders) with no indication anything was wrong.
  // Left joins mean a tenant always shows up even if their room/building
  // link is broken; roomNumber/roomFloor/buildingName just come back empty.
  const { data, error } = await supabase
    .from("tenants")
    .select(
      `
      id,
      name,
      phone,
      tin_number,
      room_id,
      monthly_rent,
      due_day,
      start_date,
      rooms(id, number, floor, building_id, buildings(name))
    `,
    )
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    tinNumber: row.tin_number ?? undefined,
    roomId: row.room_id,
    monthlyRent: Number(row.monthly_rent ?? row.monthlyRent ?? 0),
    dueDay: row.due_day,
    startDate: row.start_date,
    roomNumber: row.rooms?.number ?? "",
    roomFloor: row.rooms?.floor ?? "",
    buildingName: row.rooms?.buildings?.name ?? "",
  })) as Tenant[] &
    {
      roomNumber?: string;
      roomFloor?: string;
      buildingName?: string;
    }[];
}

export async function fetchPayments() {
  // FIX: same issue again — an inner join on tenants meant a payment whose
  // tenant was ever deleted would silently vanish from "Collected This
  // Month", Reports, and everywhere else. Left join keeps every payment.
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
      id,
      tenant_id,
      months_covered,
      period_start,
      recorded_date,
      amount,
      days_offset,
      tenants(name)
    `,
    )
    .order("recorded_date", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    monthsCovered: row.months_covered,
    periodStart: row.period_start,
    recordedDate: row.recorded_date,
    amount: row.amount,
    daysOffset: row.days_offset,
    tenantName: row.tenants?.name ?? "",
  })) as Payment[] & { tenantName?: string }[];
}

export async function addTenant(
  tenant: Partial<Tenant> & { room_id?: string },
) {
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      id: tenant.id,
      name: tenant.name,
      phone: tenant.phone ?? null,
      tin_number: tenant.tinNumber ?? null,
      room_id: tenant.room_id ?? tenant.roomId,
      monthly_rent: tenant.monthlyRent,
      due_day: tenant.dueDay,
      start_date: tenant.startDate,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    phone: data.phone ?? undefined,
    tinNumber: data.tin_number ?? undefined,
    roomId: data.room_id,
    monthlyRent: Number(data.monthly_rent ?? data.monthlyRent ?? 0),
    dueDay: data.due_day,
    startDate: data.start_date,
  } as Tenant;
}

export async function updateTenant(
  id: string,
  updates: Partial<Tenant> & { tinNumber?: string },
) {
  const { data, error } = await supabase
    .from("tenants")
    .update({
      name: updates.name,
      phone: updates.phone ?? null,
      tin_number: updates.tinNumber ?? null,
      room_id: updates.roomId,
      monthly_rent: updates.monthlyRent,
      due_day: updates.dueDay,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    phone: data.phone ?? undefined,
    tinNumber: data.tin_number ?? undefined,
    roomId: data.room_id,
    monthlyRent: Number(data.monthly_rent ?? data.monthlyRent ?? 0),
    dueDay: data.due_day,
    startDate: data.start_date,
  } as Tenant;
}

export async function deleteTenant(id: string) {
  const { error } = await supabase.from("tenants").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function addPayment(
  payment: Partial<Payment> & { tenant_id?: string },
) {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      id: payment.id,
      tenant_id: payment.tenant_id ?? payment.tenantId,
      months_covered: payment.monthsCovered,
      period_start: payment.periodStart,
      recorded_date: payment.recordedDate,
      amount: payment.amount,
      days_offset: payment.daysOffset,
    })
    .select()
    .single();

  if (error) throw error;

  // FIX: this used to `return data;` — the raw Supabase row, still in
  // snake_case (tenant_id, period_start, months_covered, days_offset).
  // The rest of the app reads Payment objects in camelCase (tenantId,
  // periodStart, ...), so the just-added payment would silently fail
  // every `p.periodStart === month` / `p.tenantId === id` check until the
  // next full page reload re-fetched it correctly. This is what caused
  // the Dashboard (and Payments list) to show stale "Collected This
  // Month" / "Needs Attention" numbers right after recording a payment,
  // while Reports looked fine after a refresh. Mapping to the same shape
  // fetchPayments() and updatePayment() use fixes that permanently.
  return {
    id: data.id,
    tenantId: data.tenant_id,
    monthsCovered: data.months_covered,
    periodStart: data.period_start,
    recordedDate: data.recorded_date,
    amount: data.amount,
    daysOffset: data.days_offset,
  } as Payment;
}

export async function updatePayment(
  id: string,
  updates: {
    monthsCovered?: number;
    periodStart?: string;
    recordedDate?: string;
    amount?: number;
    daysOffset?: number;
  },
) {
  const { data, error } = await supabase
    .from("payments")
    .update({
      months_covered: updates.monthsCovered,
      period_start: updates.periodStart,
      recorded_date: updates.recordedDate,
      amount: updates.amount,
      days_offset: updates.daysOffset,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    tenantId: data.tenant_id,
    monthsCovered: data.months_covered,
    periodStart: data.period_start,
    recordedDate: data.recorded_date,
    amount: data.amount,
    daysOffset: data.days_offset,
  } as Payment;
}

export async function deletePayment(id: string) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function addRoom(room: Partial<Room> & { building_id?: string }) {
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      id: room.id,
      building_id: room.building_id,
      floor: room.floor,
      number: room.number,
      base_rent: room.baseRent,
    })
    .select(
      `
      id,
      floor,
      number,
      base_rent,
      building_id,
      buildings(name)
    `,
    )
    .single();

  if (error) throw error;

  const buildings = data.buildings as any;
  const buildingName = Array.isArray(buildings)
    ? (buildings[0]?.name ?? "")
    : (buildings?.name ?? "");

  return {
    id: data.id,
    floor: data.floor,
    number: data.number,
    baseRent: data.base_rent,
    occupied: false,
    tenantId: undefined,
    buildingId: data.building_id,
    buildingName,
  } as Room;
}

export async function updateRoom(
  id: string,
  updates: {
    floor: string;
    number: string;
    baseRent: number;
    buildingId: string;
  },
) {
  const { data, error } = await supabase
    .from("rooms")
    .update({
      floor: updates.floor,
      number: updates.number,
      base_rent: updates.baseRent,
      building_id: updates.buildingId,
    })
    .eq("id", id)
    .select(
      `
      id,
      floor,
      number,
      base_rent,
      building_id,
      buildings(name)
    `,
    )
    .single();

  if (error) throw error;

  const buildings = data.buildings as any;
  const buildingName = Array.isArray(buildings)
    ? (buildings[0]?.name ?? "")
    : (buildings?.name ?? "");

  return {
    id: data.id,
    floor: data.floor,
    number: data.number,
    baseRent: data.base_rent,
    occupied: false,
    tenantId: undefined,
    buildingId: data.building_id,
    buildingName,
  } as Room;
}

export async function deleteRoom(id: string) {
  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) throw error;
  return true;
}
