import { useState, useEffect, useMemo, useRef } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Wallet,
  FileBarChart,
  Building2,
  Menu,
  X,
  Sun,
  Moon,
  Plus,
  Edit2,
  Trash2,
  Check,
  Settings,
  List,
  LayoutGrid,
  ArrowRight,
  BellRing,
  CalendarDays,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import WelcomePage from "./WelcomePage";
import UserMenu from "./UserMenu";
import { FLOORS, FLOOR_LABELS } from "./data";
import type { Room, Tenant, Payment, Floor, PaymentTag } from "./data";

type TenantWithTin = Tenant & { tinNumber?: string };
import {
  fetchBuildings,
  addBuilding,
  updateBuilding,
  deleteBuilding,
  fetchRooms,
  fetchTenants,
  fetchPayments,
  addTenant,
  addPayment,
  addRoom,
  updateRoom,
  deleteRoom,
  updateTenant,
  deleteTenant,
} from "./lib/queries";
import {
  exportPaymentsToExcel,
  exportPaymentsToPDF,
} from "./lib/exportReports";

// ─── Utilities ───────────────────────────────────────────────────────────────

function fmtRWF(n: number) {
  return `RWF ${n.toLocaleString("en-US")}`;
}

function getTag(daysOffset: number): PaymentTag {
  if (daysOffset < 0) return "early";
  if (daysOffset === 0) return "on-time";
  return "late";
}

function tagLabel(daysOffset: number): string {
  const tag = getTag(daysOffset);
  const d = Math.abs(daysOffset);
  if (tag === "early") return `${d}d early`;
  if (tag === "on-time") return "On time";
  return `${d}d late`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function roomLocation(
  room: Room | undefined,
  buildings?: Array<{ id: string; name: string }>,
) {
  if (!room) return "—";
  const buildingName =
    room.buildingName ??
    buildings?.find((building) => building.id === room.buildingId)?.name;
  const floorAndRoom = `${floorLabel(room.floor)} · ${room.number}`;
  return buildingName ? `${buildingName} · ${floorAndRoom}` : floorAndRoom;
}

function paidThisMonth(tenantId: string, payments: Payment[]) {
  return payments.some(
    (p) => p.tenantId === tenantId && p.periodStart === "2026-07",
  );
}

// Today = 2026-07-19, day 19
const TODAY_DAY = 19;

interface ReminderRow {
  tenant: Tenant;
  room: Room;
  daysOverdue: number;
  daysUntilDue: number;
  status: "overdue" | "due-soon";
}

function buildReminders(
  tenants: Tenant[],
  rooms: Room[],
  payments: Payment[],
): ReminderRow[] {
  const rows: ReminderRow[] = [];
  for (const t of tenants) {
    if (paidThisMonth(t.id, payments)) continue;
    const room = rooms.find((r) => r.id === t.roomId);
    if (!room) continue;
    if (t.dueDay < TODAY_DAY) {
      rows.push({
        tenant: t,
        room,
        daysOverdue: TODAY_DAY - t.dueDay,
        daysUntilDue: 0,
        status: "overdue",
      });
    } else if (t.dueDay >= TODAY_DAY && t.dueDay - TODAY_DAY <= 5) {
      rows.push({
        tenant: t,
        room,
        daysOverdue: 0,
        daysUntilDue: t.dueDay - TODAY_DAY,
        status: "due-soon",
      });
    }
  }
  rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return rows;
}

function collectThisMonth(payments: Payment[]) {
  return payments
    .filter((p) => p.periodStart === "2026-07")
    .reduce((s, p) => s + p.amount, 0);
}

function uniqueId() {
  return Math.random().toString(36).slice(2);
}

function getTenantForRoom(roomId: string, tenants: Tenant[]) {
  return tenants.find((tenant) => tenant.roomId === roomId) ?? null;
}

function floorLabel(floor: string): string {
  return (FLOOR_LABELS as Record<string, string>)[floor] ?? floor;
}

// ─── Per-building custom floors (persisted via localStorage) ────────────────
// Your current data model has one global FLOORS list. Buildings don't all
// have the same floors, so each building can now define its own floor list,
// managed from Settings > Configure Floors, stored per building id.
function getBuildingFloors(buildingId: string): string[] {
  if (!buildingId || typeof window === "undefined") return [...FLOORS];
  try {
    const raw = localStorage.getItem(`rm:floors:${buildingId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fall through to default
  }
  return [...FLOORS];
}

function setBuildingFloorsStorage(buildingId: string, floors: string[]) {
  if (typeof window === "undefined" || !buildingId) return;
  localStorage.setItem(`rm:floors:${buildingId}`, JSON.stringify(floors));
}

// ─── Global responsive / visual polish styles ────────────────────────────────
const GLOBAL_CSS = `
* { box-sizing: border-box; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 8px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.main-content > div { animation: fadeInUp 0.28s ease; }

.section-title { font-size: clamp(19px, 4.2vw, 22px); }

.main-content { padding: 24px; }
@media (max-width: 768px) {
  .main-content { padding: 72px 14px 28px; }
}

/* Dashboard stat cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px) { .stats-grid { grid-template-columns: 1fr; } }

.stat-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md, 0 10px 30px rgba(0,0,0,0.10)); }
@media (max-width: 540px) { .stat-card { padding: 18px !important; } }

/* Two-column pages (Tenants, Payments) stack on tablet/mobile */
@media (max-width: 900px) {
  .page-grid-two { grid-template-columns: 1fr !important; }
}

/* Reports filter bar stacks on mobile */
@media (max-width: 640px) {
  .report-filters { flex-direction: column !important; align-items: stretch !important; }
  .report-filters > * { width: 100% !important; }
}

/* Reports summary cards stack on small phones */
@media (max-width: 480px) {
  .summary-grid { grid-template-columns: 1fr !important; }
}

/* Room card grid tightens on small phones */
@media (max-width: 420px) {
  .room-card-grid { grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)) !important; gap: 8px !important; }
}
.room-card { transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
.room-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md, 0 8px 22px rgba(0,0,0,0.08)); }
.room-view-toolbar { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: -12px; color: var(--text-muted); font-size: 12px; }
.room-view-toggle { display: inline-flex; gap: 3px; padding: 3px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); box-shadow: var(--shadow); }
.room-view-toggle button { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer; }
.room-view-toggle button:hover, .room-view-toggle button.is-active { background: var(--nav-active-bg); color: var(--accent); }
.room-list { overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
.room-list-row { display: grid; grid-template-columns: 110px minmax(0, 1fr) auto 82px; gap: 16px; align-items: center; padding: 13px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background-color .15s ease; }
.room-list-row:last-child { border-bottom: 0; }
.room-list-row:hover, .room-list-row:focus-visible { background: var(--nav-hover-bg); outline: none; }
.room-list-number { color: var(--text); font-size: 14px; font-weight: 650; }
.room-list-tenant { display: flex; flex-direction: column; min-width: 0; gap: 3px; }
.room-list-tenant strong { overflow: hidden; color: var(--text); font-size: 13px; font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
.room-list-tenant span { color: var(--text-muted); font-size: 11px; }
.room-list-actions { display: flex; justify-content: flex-end; gap: 4px; }
.room-list-actions button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; }
.room-list-actions button:hover { background: var(--surface2); color: var(--text); }
@media (max-width: 540px) {
  .room-view-toolbar { justify-content: space-between; margin-top: -8px; }
  .room-list-row { grid-template-columns: 70px minmax(0, 1fr) auto; gap: 10px; padding: 12px; }
  .room-list-actions { grid-column: 1 / -1; justify-content: flex-start; border-top: 1px solid var(--border); padding-top: 8px; }
}

.tenant-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.tenant-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md, 0 8px 22px rgba(0,0,0,0.08)); }
@media (max-width: 420px) {
  .tenant-card-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) !important; gap: 8px !important; }
}

.reminder-widget { overflow: hidden; }
.reminder-widget-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 24px 18px; border-bottom: 1px solid var(--border); }
.reminder-widget-title-row { display: flex; align-items: center; gap: 8px; color: var(--text); }
.reminder-widget-title-row h2 { margin: 0; font-size: 15px; font-weight: 650; }
.reminder-widget-header p { margin: 5px 0 0 25px; color: var(--text-muted); font-size: 12px; }
.reminder-count, .notifications-count { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 22px; padding: 0 7px; border-radius: 999px; background: var(--nav-active-bg); color: var(--accent); font-size: 11px; font-weight: 700; }
.reminder-view-all, .back-link { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--accent); font-size: 12px; font-weight: 650; cursor: pointer; padding: 5px 0; white-space: nowrap; }
.reminder-view-all:hover, .back-link:hover { color: var(--accent-hover); }
.reminder-list { max-height: 390px; overflow-y: auto; padding: 6px 10px; }
.reminder-item { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 14px; border-radius: 10px; transition: background-color .16s ease, transform .16s ease; }
.reminder-item:hover { background: var(--nav-hover-bg); transform: translateX(2px); }
.reminder-avatar { display: grid; place-items: center; flex: 0 0 38px; width: 38px; height: 38px; border-radius: 50%; background: var(--nav-active-bg); color: var(--accent); font-size: 12px; font-weight: 700; }
.reminder-avatar.is-overdue { background: var(--status-overdue-bg); color: var(--status-overdue); }
.reminder-main { min-width: 0; flex: 1; }
.reminder-name-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.reminder-name-row strong { overflow: hidden; color: var(--text); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.reminder-name-row .status-badge { flex: 0 0 auto; }
.reminder-meta { margin-top: 3px; overflow: hidden; color: var(--text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.reminder-status { display: flex; flex: 0 0 auto; flex-direction: column; align-items: flex-end; gap: 3px; color: var(--status-due); font-size: 11px; text-align: right; }
.reminder-status.is-overdue { color: var(--status-overdue); }
.reminder-status strong { color: var(--text-muted); font-size: 11px; font-weight: 500; }
.reminder-empty, .notifications-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; min-height: 190px; padding: 28px 20px; text-align: center; }
.reminder-empty strong, .notifications-empty strong { color: var(--text); font-size: 14px; }
.reminder-empty span, .notifications-empty span { color: var(--text-muted); font-size: 12px; }
.reminder-empty-icon { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 4px; border-radius: 50%; background: var(--nav-active-bg); color: var(--accent); }
.notifications-page { width: 100%; max-width: 1040px; margin: 0 auto; }
.notifications-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 24px; }
.notifications-header .section-title { margin-top: 4px; }
.notifications-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); box-shadow: var(--shadow); }
.notification-search, .notification-sort { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 0 11px; border: 1px solid var(--input-border); border-radius: 7px; background: var(--input-bg); color: var(--text-muted); }
.notification-search { flex: 1 1 210px; }
.notification-search input { width: 100%; border: 0; outline: 0; background: transparent; color: var(--text); }
.notification-sort { flex: 0 1 160px; }
.notification-sort select { width: 100%; border: 0; outline: 0; background: transparent; color: var(--text); cursor: pointer; }
.notification-filters { display: flex; gap: 3px; padding: 3px; border-radius: 8px; background: var(--surface2); }
.notification-filters button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer; }
.notification-filters button:hover, .notification-filters button.is-active { background: var(--surface); color: var(--text); box-shadow: var(--shadow); }
.notifications-list { display: grid; gap: 10px; }
.notification-card { display: flex; align-items: center; gap: 2px; overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); box-shadow: var(--shadow); transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
.notification-card:hover { border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.notification-card .reminder-item { flex: 1; }
.notification-icon { display: grid; place-items: center; flex: 0 0 42px; height: 42px; margin-left: 14px; border-radius: 9px; background: var(--surface2); color: var(--text-muted); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 640px) {
  .reminder-widget-header { padding: 18px 16px 15px; }
  .reminder-list { padding: 4px 6px; }
  .reminder-item { padding: 12px 8px; }
  .reminder-status { max-width: 112px; font-size: 10px; }
  .reminder-status strong { font-size: 10px; }
  .notifications-header { align-items: flex-start; flex-direction: column; margin-bottom: 18px; }
  .notifications-toolbar { align-items: stretch; flex-direction: column; }
  .notification-search, .notification-sort { flex-basis: auto; width: 100%; }
  .notification-filters { justify-content: stretch; }
  .notification-filters button { flex: 1; padding: 0 7px; }
  .notification-card { align-items: flex-start; }
  .notification-icon { margin: 14px 0 0 10px; }
}

/* Generic hoverable data rows */
.table-row { transition: background-color 0.12s ease; }
.table-row:hover { background-color: var(--nav-hover-bg); }

/* Tenants list: fully responsive columns, no forced horizontal scroll */
.tbl-tenants {
  display: grid;
  grid-template-columns: 1fr 90px 90px 100px 56px;
  gap: 12px;
  align-items: center;
}
@media (max-width: 640px) {
  .tbl-tenants { grid-template-columns: 1fr 100px 56px; }
  .tenant-col-floor, .tenant-col-room { display: none; }
}

/* Payments recent list: fully responsive columns, no forced horizontal scroll */
.tbl-payments {
  display: grid;
  grid-template-columns: 1fr 70px 90px 100px;
  gap: 12px;
  align-items: center;
}
.payment-header-actions { display: flex; align-items: center; gap: 14px; }
.payment-view-toggle { display: inline-flex; gap: 3px; padding: 3px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.payment-view-toggle button { display: inline-flex; align-items: center; gap: 5px; min-height: 29px; padding: 0 8px; border: 0; border-radius: 5px; background: transparent; color: var(--text-muted); font-size: 11px; font-weight: 600; cursor: pointer; }
.payment-view-toggle button:hover, .payment-view-toggle button.is-active { background: var(--nav-active-bg); color: var(--accent); }
.payment-table-header { padding: 10px 20px; background: var(--surface2); border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.payment-row { cursor: pointer; }
.payment-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.payment-tenant-name { color: var(--text); font-size: 13px; font-weight: 500; }
.payment-tenant-meta { margin-top: 1px; overflow: hidden; color: var(--text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.payment-muted-cell { color: var(--text-muted); font-size: 13px; }
.payment-amount { color: var(--text); font-size: 13px; font-weight: 500; }
.payment-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; padding: 16px; }
.payment-card { display: flex; flex-direction: column; align-items: flex-start; min-height: 172px; padding: 15px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
.payment-card:hover, .payment-card:focus-visible { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow-md); outline: none; }
.payment-card-topline { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 15px; }
.payment-card-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 7px; background: var(--nav-active-bg); color: var(--accent); }
.payment-card strong { overflow: hidden; max-width: 100%; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.payment-card-location, .payment-card-meta { margin-top: 4px; overflow: hidden; max-width: 100%; color: var(--text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.payment-card-amount { margin-top: auto; padding-top: 16px; font-size: 17px; font-weight: 650; }
.payment-empty { padding: 38px 20px; color: var(--text-muted); font-size: 13px; text-align: center; }
.payment-detail-backdrop { position: fixed; inset: 0; z-index: 120; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(15, 23, 42, .35); }
.payment-detail-panel { width: min(470px, 100%); padding: 22px; }
.payment-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.payment-detail-eyebrow { color: var(--text-muted); font-size: 11px; }
.payment-detail-header h2 { margin: 4px 0 0; color: var(--text); font-size: 18px; }
.payment-detail-close { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; }
.payment-detail-close:hover { background: var(--surface2); color: var(--text); }
.payment-detail-status { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 0; }
.payment-detail-status strong { color: var(--text); font-size: 20px; }
.payment-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.payment-detail-grid > div { display: flex; flex-direction: column; gap: 3px; padding: 11px 12px; border-radius: var(--radius-sm); background: var(--surface2); }
.payment-detail-grid span { color: var(--text-muted); font-size: 11px; }
.payment-detail-grid strong { color: var(--text); font-size: 12px; font-weight: 600; }
@media (max-width: 640px) {
  .tbl-payments { grid-template-columns: 1fr 100px; }
  .payment-col-months, .payment-col-tag { display: none; }
  .payment-header-actions { gap: 8px; }
  .payment-header-actions > .mono { display: none; }
  .payment-detail-grid { grid-template-columns: 1fr; }
}

.tenants-toolbar { flex-wrap: wrap; }

/* Settings page responsive layout */
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

/* Accessible focus rings */
button:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
`;

function GlobalStyles() {
  return <style>{GLOBAL_CSS}</style>;
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const Icon = {
  dashboard: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  tenants: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  payments: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  reports: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  buildings: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  sun: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  moon: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  search: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  check: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  alert: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  clock: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  chevronDown: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  menu: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  close: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// ─── Shared UI Components ────────────────────────────────────────────────────

function StatusBadge({
  status,
}: {
  status: "paid" | "due-soon" | "overdue" | "occupied" | "vacant";
}) {
  const cfg = {
    paid: {
      bg: "var(--status-paid-bg)",
      color: "var(--status-paid)",
      label: "Paid",
      icon: Icon.check,
    },
    "due-soon": {
      bg: "var(--status-due-bg)",
      color: "var(--status-due)",
      label: "Due soon",
      icon: Icon.clock,
    },
    overdue: {
      bg: "var(--status-overdue-bg)",
      color: "var(--status-overdue)",
      label: "Overdue",
      icon: Icon.alert,
    },
    occupied: {
      bg: "var(--status-paid-bg)",
      color: "var(--status-paid)",
      label: "Occupied",
      icon: Icon.check,
    },
    vacant: {
      bg: "var(--surface2)",
      color: "var(--text-muted)",
      label: "Vacant",
      icon: Icon.check,
    },
  }[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "3px 8px",
        borderRadius: 99,
      }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

function PaymentTagBadge({ daysOffset }: { daysOffset: number }) {
  const tag = getTag(daysOffset);
  const cfg = {
    early: { bg: "var(--status-paid-bg)", color: "var(--status-paid)" },
    "on-time": { bg: "var(--status-paid-bg)", color: "var(--status-paid)" },
    late: { bg: "var(--status-overdue-bg)", color: "var(--status-overdue)" },
  }[tag];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "3px 8px",
        borderRadius: 99,
      }}
    >
      {tagLabel(daysOffset)}
    </span>
  );
}

function Card({
  children,
  style,
  className,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Input({
  label,
  style,
  ...props
}: { label?: string } & React.InputHTMLAttributes<HTMLInputElement> & {
    style?: React.CSSProperties;
  }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={style}>
      {label && <Label>{label}</Label>}
      <input
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={{
          width: "100%",
          padding: "8px 12px",
          backgroundColor: "var(--input-bg)",
          border: `1px solid ${focused ? "var(--input-focus)" : "var(--input-border)"}`,
          borderRadius: "var(--radius-sm)",
          color: props.disabled ? "var(--text-muted)" : "var(--text)",
          outline: "none",
          transition: "border-color 0.12s",
          opacity: props.disabled ? 0.7 : 1,
        }}
      />
    </div>
  );
}

function Select({
  label,
  children,
  style,
  ...props
}: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement> & {
    style?: React.CSSProperties;
  }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={style}>
      {label && <Label>{label}</Label>}
      <div style={{ position: "relative" }}>
        <select
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={{
            width: "100%",
            padding: "8px 32px 8px 12px",
            backgroundColor: "var(--input-bg)",
            border: `1px solid ${focused ? "var(--input-focus)" : "var(--input-border)"}`,
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            outline: "none",
            appearance: "none",
            cursor: "pointer",
            transition: "border-color 0.12s",
          }}
        >
          {children}
        </select>
        <span
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "var(--text-muted)",
          }}
        >
          {Icon.chevronDown}
        </span>
      </div>
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  style,
  ...props
}: {
  variant?: "primary" | "secondary";
} & React.ButtonHTMLAttributes<HTMLButtonElement> & {
    style?: React.CSSProperties;
  }) {
  const [hovered, setHovered] = useState(false);
  const isPrimary = variant === "primary";
  return (
    <button
      {...props}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "9px 18px",
        borderRadius: "var(--radius-sm)",
        fontWeight: 600,
        fontSize: 14,
        cursor: props.disabled ? "not-allowed" : "pointer",
        border: isPrimary ? "none" : "1px solid var(--border)",
        backgroundColor: isPrimary
          ? hovered
            ? "var(--accent-hover)"
            : "var(--accent)"
          : hovered
            ? "var(--surface2)"
            : "var(--surface)",
        color: isPrimary ? "var(--accent-fg)" : "var(--text)",
        transition: "background-color 0.12s",
        opacity: props.disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1
        className="section-title"
        style={{ margin: 0, fontWeight: 700, color: "var(--text)" }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            margin: "4px 0 0",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        backgroundColor: "var(--border)",
        margin: "0 0 20px",
      }}
    />
  );
}

// ─── Page: Dashboard ─────────────────────────────────────────────────────────

function ReminderItem({ row }: { row: ReminderRow }) {
  const overdue = row.status === "overdue";
  const statusText = overdue
    ? `${row.daysOverdue} day${row.daysOverdue !== 1 ? "s" : ""} overdue`
    : row.daysUntilDue === 0
      ? "Due today"
      : `Due in ${row.daysUntilDue} day${row.daysUntilDue !== 1 ? "s" : ""}`;

  return (
    <div className="reminder-item">
      <div className={`reminder-avatar ${overdue ? "is-overdue" : ""}`}>
        {initials(row.tenant.name)}
      </div>
      <div className="reminder-main">
        <div className="reminder-name-row">
          <strong>{row.tenant.name}</strong>
          <StatusBadge status={overdue ? "overdue" : "due-soon"} />
        </div>
        <div className="reminder-meta">
          {roomLocation(row.room)} · Due on the {row.tenant.dueDay}
          {row.tenant.dueDay === 1
            ? "st"
            : row.tenant.dueDay === 2
              ? "nd"
              : row.tenant.dueDay === 3
                ? "rd"
                : "th"}
        </div>
      </div>
      <div className={`reminder-status ${overdue ? "is-overdue" : ""}`}>
        <span>{statusText}</span>
        {row.tenant.monthlyRent ? (
          <strong className="mono">{fmtRWF(row.tenant.monthlyRent)}</strong>
        ) : null}
      </div>
    </div>
  );
}

function ReminderWidget({ reminders }: { reminders: ReminderRow[] }) {
  const navigate = useNavigate();

  return (
    <Card className="reminder-widget">
      <div className="reminder-widget-header">
        <div>
          <div className="reminder-widget-title-row">
            <BellRing size={17} aria-hidden="true" />
            <h2>Rent Reminders</h2>
            <span
              className="reminder-count"
              aria-label={`${reminders.length} reminders`}
            >
              {reminders.length}
            </span>
          </div>
          <p>Tenants requiring follow-up as of today</p>
        </div>
        <button
          type="button"
          className="reminder-view-all"
          onClick={() => navigate("/notifications")}
          aria-label="View all rent reminders"
        >
          View All <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      {reminders.length === 0 ? (
        <div className="reminder-empty">
          <div className="reminder-empty-icon">
            <BellRing size={20} />
          </div>
          <strong>No pending reminders</strong>
          <span>All tenants are up to date with their rent payments.</span>
        </div>
      ) : (
        <div className="reminder-list" aria-label="Rent reminders">
          {reminders.map((row) => (
            <ReminderItem key={row.tenant.id} row={row} />
          ))}
        </div>
      )}
    </Card>
  );
}

function NotificationsPage({
  rooms,
  tenants,
  payments,
}: {
  rooms: Room[];
  tenants: Tenant[];
  payments: Payment[];
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "due-soon">("all");
  const [sort, setSort] = useState<"overdue" | "today" | "soon">("overdue");
  const reminders = useMemo(
    () => buildReminders(tenants, rooms, payments),
    [tenants, rooms, payments],
  );
  const filteredReminders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return reminders
      .filter((row) => filter === "all" || row.status === filter)
      .filter(
        (row) =>
          !normalizedQuery ||
          row.tenant.name.toLowerCase().includes(normalizedQuery),
      )
      .sort((a, b) => {
        if (sort === "today") {
          return (
            (a.status === "due-soon" ? a.daysUntilDue : 99) -
            (b.status === "due-soon" ? b.daysUntilDue : 99)
          );
        }
        if (sort === "soon") {
          const days = (row: ReminderRow) =>
            row.status === "overdue" ? row.daysOverdue + 100 : row.daysUntilDue;
          return days(a) - days(b);
        }
        return (
          (b.status === "overdue" ? b.daysOverdue : -1) -
          (a.status === "overdue" ? a.daysOverdue : -1)
        );
      });
  }, [filter, query, reminders, sort]);

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div>
          <button
            type="button"
            className="back-link"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowRight size={15} style={{ transform: "rotate(180deg)" }} />{" "}
            Dashboard
          </button>
          <SectionHeader
            title="Notifications"
            subtitle="Stay updated with overdue and upcoming rent payments."
          />
        </div>
        <span className="notifications-count">
          {reminders.length} notifications
        </span>
      </div>

      <div className="notifications-toolbar" role="search">
        <label className="notification-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search tenants</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tenants"
          />
        </label>
        <div className="notification-filters" aria-label="Filter notifications">
          {(["all", "overdue", "due-soon"] as const).map((value) => (
            <button
              type="button"
              key={value}
              className={filter === value ? "is-active" : ""}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {value === "all"
                ? "All"
                : value === "overdue"
                  ? "Overdue"
                  : "Due Soon"}
            </button>
          ))}
        </div>
        <label className="notification-sort">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span className="sr-only">Sort notifications</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="overdue">Most overdue</option>
            <option value="today">Due today</option>
            <option value="soon">Due soon</option>
          </select>
        </label>
      </div>

      {filteredReminders.length === 0 ? (
        <div className="notifications-empty">
          <div className="reminder-empty-icon">
            <BellRing size={22} />
          </div>
          <strong>No pending reminders</strong>
          <span>All tenants are up to date with their rent payments.</span>
        </div>
      ) : (
        <div className="notifications-list">
          {filteredReminders.map((row) => (
            <div className="notification-card" key={row.tenant.id}>
              <div className="notification-icon">
                <CalendarDays size={18} />
              </div>
              <ReminderItem row={row} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardPage({
  rooms,
  tenants,
  payments,
}: {
  rooms: Room[];
  tenants: Tenant[];
  payments: Payment[];
}) {
  // FIX: occupancy is now derived from actual tenant→room assignments
  // instead of the (previously stale) room.occupied flag, so this always
  // reflects the real, current state of your buildings.
  const occupied = rooms.filter(
    (r) => !!getTenantForRoom(r.id, tenants),
  ).length;
  const total = rooms.length;
  const collected = collectThisMonth(payments);
  const reminders = buildReminders(tenants, rooms, payments);
  const needsAttention = reminders.length;

  return (
    <div>
      <SectionHeader
        title="Dashboard"
        subtitle="July 2026 · Kigali rental overview"
      />

      <div className="stats-grid" style={{ marginBottom: 32 }}>
        <Card className="stat-card" style={{ padding: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            Rooms Occupied
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span
              className="mono"
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: "var(--text)",
                lineHeight: 1,
              }}
            >
              {occupied}
            </span>
            <span
              className="mono"
              style={{ fontSize: 16, color: "var(--text-muted)" }}
            >
              / {total}
            </span>
          </div>
          <div
            style={{
              marginTop: 12,
              height: 4,
              borderRadius: 99,
              backgroundColor: "var(--surface2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${total > 0 ? (occupied / total) * 100 : 0}%`,
                backgroundColor: "var(--accent)",
                borderRadius: 99,
                transition: "width 0.3s",
              }}
            />
          </div>
          <div
            style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}
          >
            {total - occupied} room{total - occupied !== 1 ? "s" : ""} vacant
          </div>
        </Card>

        <Card className="stat-card" style={{ padding: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            Collected This Month
          </div>
          <div
            className="mono"
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: "var(--text)",
              lineHeight: 1.2,
            }}
          >
            {fmtRWF(collected)}
          </div>
          <div
            style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}
          >
            {payments.filter((p) => p.periodStart === "2026-07").length}{" "}
            payments recorded
          </div>
        </Card>

        <Card className="stat-card" style={{ padding: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            Needs Attention
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              className="mono"
              style={{
                fontSize: 32,
                fontWeight: 600,
                color:
                  needsAttention > 0
                    ? "var(--status-overdue)"
                    : "var(--status-paid)",
                lineHeight: 1,
              }}
            >
              {needsAttention}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              tenant{needsAttention !== 1 ? "s" : ""}
            </span>
          </div>
          <div
            style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}
          >
            {reminders.filter((r) => r.status === "overdue").length} overdue ·{" "}
            {reminders.filter((r) => r.status === "due-soon").length} due soon
          </div>
        </Card>
      </div>

      <ReminderWidget reminders={reminders} />
    </div>
  );
}

// ─── Page: Tenants ────────────────────────────────────────────────────────────

function TenantsPage({
  rooms,
  tenants,
  onAddTenant,
  onUpdateTenant,
  onDeleteTenant,
}: {
  rooms: Room[];
  tenants: TenantWithTin[];
  onAddTenant: (t: TenantWithTin, r: Room) => void;
  onUpdateTenant: (t: TenantWithTin) => void;
  onDeleteTenant: (tenantId: string) => void;
}) {
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [form, setForm] = useState({
    roomId: "",
    name: "",
    phone: "",
    tinNumber: "",
    rent: "",
    dueDay: "5",
  });
  const [submitted, setSubmitted] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");

  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editingTenant, setEditingTenant] = useState({
    roomId: "",
    name: "",
    phone: "",
    tinNumber: "",
    rent: "",
    dueDay: "5",
  });

  useEffect(() => {
    let mounted = true;
    fetchBuildings()
      .then((rows) => {
        if (mounted) setBuildings(rows);
      })
      .catch((err) => console.error("Failed to load buildings", err));
    return () => {
      mounted = false;
    };
  }, []);

  const vacantRooms = rooms.filter(
    (room) => !getTenantForRoom(room.id, tenants),
  );

  const selectedRoom = rooms.find((r) => r.id === form.roomId);

  useEffect(() => {
    if (selectedRoom) {
      setForm((f) => ({ ...f, rent: String(selectedRoom.baseRent) }));
    }
  }, [form.roomId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.roomId || !form.name.trim() || !form.rent || !form.dueDay) return;
    const room = rooms.find((r) => r.id === form.roomId)!;
    const newTenant: TenantWithTin = {
      id: "t" + uniqueId(),
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      tinNumber: form.tinNumber.trim() || undefined,
      roomId: form.roomId,
      monthlyRent: parseInt(form.rent),
      dueDay: parseInt(form.dueDay),
      startDate: "2026-07-19",
    };
    onAddTenant(newTenant, room);
    setForm({
      roomId: "",
      name: "",
      phone: "",
      tinNumber: "",
      rent: "",
      dueDay: "5",
    });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  function startEdit(t: TenantWithTin) {
    setEditingTenantId(t.id);
    setEditingTenant({
      roomId: t.roomId,
      name: t.name,
      phone: t.phone || "",
      tinNumber: t.tinNumber || "",
      rent: String(t.monthlyRent),
      dueDay: String(t.dueDay),
    });
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTenantId) return;
    const existing = tenants.find((t) => t.id === editingTenantId);
    if (!existing) return;
    onUpdateTenant({
      ...existing,
      name: editingTenant.name.trim(),
      phone: editingTenant.phone.trim() || undefined,
      tinNumber: editingTenant.tinNumber.trim() || undefined,
      roomId: editingTenant.roomId,
      monthlyRent: parseInt(editingTenant.rent) || existing.monthlyRent,
      dueDay: parseInt(editingTenant.dueDay) || existing.dueDay,
    });
    setEditingTenantId(null);
  }

  function handleDelete(t: TenantWithTin) {
    if (window.confirm(`Remove ${t.name} and free up their room?`)) {
      onDeleteTenant(t.id);
    }
  }

  const filteredTenants = query.trim()
    ? tenants.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : tenants;

  const editableRooms = rooms.filter(
    (room) =>
      !getTenantForRoom(room.id, tenants) || room.id === editingTenant.roomId,
  );

  return (
    <div>
      <SectionHeader
        title="Tenants"
        subtitle="All active tenants and room registrations"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 24,
          alignItems: "start",
        }}
        className="page-grid-two"
      >
        {/* Tenant list / grid */}
        <Card>
          <div
            className="tenants-toolbar"
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}
              >
                Active Tenants
              </div>
              <div
                className="mono"
                style={{ fontSize: 12, color: "var(--text-muted)" }}
              >
                {tenants.length} total
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                type="search"
                placeholder="Search tenants…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--input-border)",
                  backgroundColor: "var(--input-bg)",
                  color: "var(--text)",
                  fontSize: 13,
                  outline: "none",
                  minWidth: 140,
                }}
              />
              <div
                style={{
                  display: "flex",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setViewMode("list")}
                  title="List view"
                  style={{
                    padding: "6px 9px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor:
                      viewMode === "list"
                        ? "var(--nav-active-bg)"
                        : "var(--surface)",
                    color:
                      viewMode === "list"
                        ? "var(--nav-active-text)"
                        : "var(--text-muted)",
                    display: "flex",
                  }}
                >
                  <List size={15} />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                  style={{
                    padding: "6px 9px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor:
                      viewMode === "grid"
                        ? "var(--nav-active-bg)"
                        : "var(--surface)",
                    color:
                      viewMode === "grid"
                        ? "var(--nav-active-text)"
                        : "var(--text-muted)",
                    display: "flex",
                  }}
                >
                  <LayoutGrid size={15} />
                </button>
              </div>
            </div>
          </div>

          {filteredTenants.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              No tenants match your search.
            </div>
          ) : viewMode === "grid" ? (
            <div
              className="tenant-card-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 12,
                padding: 16,
              }}
            >
              {filteredTenants.map((t) => {
                const room = rooms.find((r) => r.id === t.roomId);
                return (
                  <div
                    key={t.id}
                    className="tenant-card"
                    style={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "var(--text)",
                        }}
                      >
                        {t.name}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => startEdit(t)}
                          title="Edit tenant"
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          title="Remove tenant"
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {t.phone && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginBottom: 4,
                        }}
                      >
                        {t.phone}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginBottom: 4,
                      }}
                    >
                      {roomLocation(room, buildings)}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      {fmtRWF(t.monthlyRent)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      Due day {t.dueDay}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div
                className="tbl-tenants"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "var(--surface2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Name
                </div>
                <div
                  className="tenant-col-floor"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Floor
                </div>
                <div
                  className="tenant-col-room"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Room
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Rent
                </div>
                <div />
              </div>
              {filteredTenants.map((t, i) => {
                const room = rooms.find((r) => r.id === t.roomId);
                return (
                  <div
                    key={t.id}
                    className="table-row tbl-tenants"
                    style={{
                      padding: "13px 20px",
                      borderBottom:
                        i < filteredTenants.length - 1
                          ? "1px solid var(--border)"
                          : "none",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 500,
                          color: "var(--text)",
                          fontSize: 13,
                        }}
                      >
                        {t.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 1,
                        }}
                      >
                        {t.phone ? `${t.phone} · ` : ""}
                        {roomLocation(room, buildings)}
                      </div>
                    </div>
                    <div
                      className="tenant-col-floor"
                      style={{ fontSize: 13, color: "var(--text-muted)" }}
                    >
                      {room ? floorLabel(room.floor) : "—"}
                    </div>
                    <div
                      className="tenant-col-room"
                      style={{ fontSize: 13, color: "var(--text-muted)" }}
                    >
                      {room?.number ?? "—"}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 13, color: "var(--text)" }}
                    >
                      {fmtRWF(t.monthlyRent)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        onClick={() => startEdit(t)}
                        title="Edit"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        title="Delete"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Register form */}
        <Card style={{ padding: 20 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Register a Tenant
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 20,
            }}
          >
            Assign a tenant to a vacant room
          </div>
          <Divider />
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <Select
              label="Vacant Room"
              value={form.roomId}
              onChange={(e) =>
                setForm((f) => ({ ...f, roomId: e.target.value }))
              }
              required
            >
              <option value="">Select a room…</option>
              {vacantRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {floorLabel(r.floor)} · {r.number} — {fmtRWF(r.baseRent)}/mo
                </option>
              ))}
            </Select>

            <Input
              label="Full Name"
              placeholder="e.g. Uwimana Marie"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Input
              label="Phone (optional)"
              placeholder="+250 7XX XXX XXX"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
            <Input
              label="TIN Number (optional)"
              placeholder="e.g. 123456789"
              value={form.tinNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, tinNumber: e.target.value }))
              }
            />
            <Input
              label="Monthly Rent (RWF)"
              type="number"
              placeholder="e.g. 70000"
              value={form.rent}
              onChange={(e) => setForm((f) => ({ ...f, rent: e.target.value }))}
              required
            />
            <Input
              label="Due Day of Month (1–31)"
              type="number"
              min={1}
              max={31}
              placeholder="e.g. 5"
              value={form.dueDay}
              onChange={(e) =>
                setForm((f) => ({ ...f, dueDay: e.target.value }))
              }
              required
            />

            <Button type="submit" style={{ marginTop: 4 }}>
              Register Tenant
            </Button>

            {submitted && (
              <div
                style={{
                  padding: "10px 14px",
                  backgroundColor: "var(--status-paid-bg)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--status-paid)",
                  fontSize: 13,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {Icon.check} Tenant registered successfully.
              </div>
            )}
          </form>
        </Card>
      </div>

      {/* Edit tenant modal */}
      {editingTenantId && (
        <div
          onClick={() => setEditingTenantId(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15,23,42,0.35)",
            zIndex: 130,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
              padding: 20,
              maxHeight: "calc(100vh - 40px)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                marginBottom: 16,
                color: "var(--text)",
              }}
            >
              Edit Tenant
            </div>
            <form
              onSubmit={submitEdit}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <Select
                label="Room"
                value={editingTenant.roomId}
                onChange={(e) =>
                  setEditingTenant((t) => ({ ...t, roomId: e.target.value }))
                }
                required
              >
                {editableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {floorLabel(r.floor)} · {r.number} — {fmtRWF(r.baseRent)}/mo
                  </option>
                ))}
              </Select>
              <Input
                label="Full Name"
                value={editingTenant.name}
                onChange={(e) =>
                  setEditingTenant((t) => ({ ...t, name: e.target.value }))
                }
                required
              />
              <Input
                label="Phone (optional)"
                value={editingTenant.phone}
                onChange={(e) =>
                  setEditingTenant((t) => ({ ...t, phone: e.target.value }))
                }
              />
              <Input
                label="TIN Number (optional)"
                value={editingTenant.tinNumber}
                onChange={(e) =>
                  setEditingTenant((t) => ({ ...t, tinNumber: e.target.value }))
                }
              />
              <Input
                label="Monthly Rent (RWF)"
                type="number"
                value={editingTenant.rent}
                onChange={(e) =>
                  setEditingTenant((t) => ({ ...t, rent: e.target.value }))
                }
                required
              />
              <Input
                label="Due Day (1–31)"
                type="number"
                min={1}
                max={31}
                value={editingTenant.dueDay}
                onChange={(e) =>
                  setEditingTenant((t) => ({ ...t, dueDay: e.target.value }))
                }
                required
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="submit" style={{ flex: 1 }}>
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingTenantId(null)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Page: Payments ───────────────────────────────────────────────────────────

function PaymentList({
  payments,
  tenants,
  rooms,
  onSelect,
}: {
  payments: Payment[];
  tenants: Tenant[];
  rooms: Room[];
  onSelect: (payment: Payment) => void;
}) {
  return (
    <div className="payment-table-wrap">
      <div className="tbl-payments payment-table-header">
        <div>Tenant</div>
        <div className="payment-col-months">Months</div>
        <div className="payment-col-tag">Tag</div>
        <div>Amount</div>
      </div>
      {payments.map((payment, index) => {
        const tenant = tenants.find((item) => item.id === payment.tenantId);
        const room = tenant
          ? rooms.find((item) => item.id === tenant.roomId)
          : undefined;
        return (
          <div
            key={payment.id}
            className="table-row tbl-payments payment-row"
            onClick={() => onSelect(payment)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(payment);
              }
            }}
            style={{
              padding: "13px 20px",
              borderBottom:
                index < payments.length - 1
                  ? "1px solid var(--border)"
                  : "none",
            }}
          >
            <div>
              <div className="payment-tenant-name">{tenant?.name ?? "—"}</div>
              <div className="payment-tenant-meta">
                {room ? `${roomLocation(room)} · ` : ""}
                {payment.monthsCovered} mo · {tagLabel(payment.daysOffset)}
              </div>
            </div>
            <div className="payment-col-months mono payment-muted-cell">
              {payment.monthsCovered} mo
            </div>
            <div className="payment-col-tag">
              <PaymentTagBadge daysOffset={payment.daysOffset} />
            </div>
            <div className="mono payment-amount">{fmtRWF(payment.amount)}</div>
          </div>
        );
      })}
    </div>
  );
}

function PaymentGrid({
  payments,
  tenants,
  rooms,
  onSelect,
}: {
  payments: Payment[];
  tenants: Tenant[];
  rooms: Room[];
  onSelect: (payment: Payment) => void;
}) {
  return (
    <div className="payment-card-grid">
      {payments.map((payment) => {
        const tenant = tenants.find((item) => item.id === payment.tenantId);
        const room = tenant
          ? rooms.find((item) => item.id === tenant.roomId)
          : undefined;
        return (
          <button
            type="button"
            key={payment.id}
            className="payment-card"
            onClick={() => onSelect(payment)}
            aria-label={`View payment details for ${tenant?.name ?? "unknown tenant"}`}
          >
            <div className="payment-card-topline">
              <span className="payment-card-icon">
                <Wallet size={16} />
              </span>
              <PaymentTagBadge daysOffset={payment.daysOffset} />
            </div>
            <strong>{tenant?.name ?? "Unknown tenant"}</strong>
            <span className="payment-card-location">{roomLocation(room)}</span>
            <span className="mono payment-card-amount">
              {fmtRWF(payment.amount)}
            </span>
            <span className="payment-card-meta">
              {payment.monthsCovered} month
              {payment.monthsCovered !== 1 ? "s" : ""} · {payment.recordedDate}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PaymentsPage({
  rooms,
  tenants,
  payments,
  onAddPayment,
}: {
  rooms: Room[];
  tenants: Tenant[];
  payments: Payment[];
  onAddPayment: (p: Payment) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [months, setMonths] = useState("1");
  const [periodStart, setPeriodStart] = useState("2026-07");
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [paymentViewMode, setPaymentViewMode] = useState<"list" | "grid">(
    "list",
  );
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const matchedTenants =
    search.trim().length > 0
      ? tenants.filter((t) =>
          t.name.toLowerCase().includes(search.toLowerCase()),
        )
      : [];

  const selectedRoom = selectedTenant
    ? rooms.find((r) => r.id === selectedTenant.roomId)
    : null;

  const numMonths = parseInt(months) || 1;
  const total = selectedTenant ? selectedTenant.monthlyRent * numMonths : 0;

  function selectTenant(t: Tenant) {
    setSelectedTenant(t);
    setSearch(t.name);
    setShowDropdown(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenant) return;
    const payment: Payment = {
      id: "p" + uniqueId(),
      tenantId: selectedTenant.id,
      monthsCovered: numMonths,
      periodStart,
      recordedDate: "2026-07-19",
      amount: total,
      daysOffset: 0,
    };
    onAddPayment(payment);
    setSearch("");
    setSelectedTenant(null);
    setMonths("1");
    setPeriodStart("2026-07");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  const recentPayments = [...payments].reverse().slice(0, 15);

  return (
    <div>
      <SectionHeader
        title="Payments"
        subtitle="Record and review payment transactions"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: 24,
          alignItems: "start",
        }}
        className="page-grid-two"
      >
        {/* Record payment form */}
        <Card style={{ padding: 20 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Record a Payment
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 20,
            }}
          >
            Search tenant and confirm receipt
          </div>
          <Divider />

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div>
              <Label>Tenant Name</Label>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                  }}
                >
                  {Icon.search}
                </div>
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowDropdown(true);
                    if (!e.target.value) setSelectedTenant(null);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 32px",
                    backgroundColor: "var(--input-bg)",
                    border: "1px solid var(--input-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
                {showDropdown && matchedTenants.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      boxShadow: "var(--shadow-md)",
                      marginTop: 4,
                      overflow: "hidden",
                    }}
                  >
                    {matchedTenants.map((t) => {
                      const r = rooms.find((rm) => rm.id === t.roomId);
                      return (
                        <button
                          type="button"
                          key={t.id}
                          onMouseDown={() => selectTenant(t)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 14px",
                            backgroundColor: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text)",
                            borderBottom: "1px solid var(--border)",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "var(--nav-hover-bg)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          <div style={{ fontWeight: 500, fontSize: 13 }}>
                            {t.name}
                          </div>
                          {r && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                marginTop: 2,
                              }}
                            >
                              {roomLocation(r)} · {fmtRWF(t.monthlyRent)}/mo
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {selectedTenant && selectedRoom && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                  gap: 10,
                }}
              >
                <div>
                  <Label>Floor</Label>
                  <input
                    disabled
                    value={floorLabel(selectedRoom.floor)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-muted)",
                      fontFamily: "inherit",
                      fontSize: 14,
                    }}
                    readOnly
                  />
                </div>
                <div>
                  <Label>Room</Label>
                  <input
                    disabled
                    value={selectedRoom.number}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-muted)",
                      fontFamily: "inherit",
                      fontSize: 14,
                    }}
                    readOnly
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Label>Monthly Rent</Label>
                  <input
                    disabled
                    value={fmtRWF(selectedTenant.monthlyRent)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-muted)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                    }}
                    readOnly
                  />
                </div>
              </div>
            )}

            <Input
              label="Number of Months"
              type="number"
              min={1}
              max={12}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              required
            />

            <div>
              <Label>Period Start (YYYY-MM)</Label>
              <input
                type="month"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: "var(--input-bg)",
                  border: "1px solid var(--input-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text)",
                  outline: "none",
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              />
            </div>

            {selectedTenant && (
              <div
                style={{
                  padding: "14px 16px",
                  backgroundColor: "var(--nav-active-bg)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--accent)20",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                    marginBottom: 4,
                  }}
                >
                  Total to Record
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  {fmtRWF(total)}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 4,
                  }}
                >
                  {numMonths} month{numMonths !== 1 ? "s" : ""} ×{" "}
                  {fmtRWF(selectedTenant.monthlyRent)}
                </div>
              </div>
            )}

            <Button type="submit" disabled={!selectedTenant}>
              Confirm Payment
            </Button>

            {submitted && (
              <div
                style={{
                  padding: "10px 14px",
                  backgroundColor: "var(--status-paid-bg)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--status-paid)",
                  fontSize: 13,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {Icon.check} Payment recorded successfully.
              </div>
            )}
          </form>
        </Card>

        {/* Recent payments — fully responsive, no forced horizontal scroll */}
        <Card>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}
            >
              Recent Payments
            </div>
            <div className="payment-header-actions">
              <div
                className="mono"
                style={{ fontSize: 12, color: "var(--text-muted)" }}
              >
                {payments.length} total
              </div>
              <div
                className="payment-view-toggle"
                role="group"
                aria-label="Choose payment view"
              >
                <button
                  type="button"
                  className={paymentViewMode === "list" ? "is-active" : ""}
                  onClick={() => setPaymentViewMode("list")}
                  aria-pressed={paymentViewMode === "list"}
                  title="List view"
                >
                  <List size={15} /> List
                </button>
                <button
                  type="button"
                  className={paymentViewMode === "grid" ? "is-active" : ""}
                  onClick={() => setPaymentViewMode("grid")}
                  aria-pressed={paymentViewMode === "grid"}
                  title="Grid view"
                >
                  <LayoutGrid size={15} /> Grid
                </button>
              </div>
            </div>
          </div>
          {recentPayments.length === 0 ? (
            <div className="payment-empty">No payments recorded yet.</div>
          ) : paymentViewMode === "list" ? (
            <PaymentList
              payments={recentPayments}
              tenants={tenants}
              rooms={rooms}
              onSelect={setSelectedPayment}
            />
          ) : (
            <PaymentGrid
              payments={recentPayments}
              tenants={tenants}
              rooms={rooms}
              onSelect={setSelectedPayment}
            />
          )}
        </Card>

        {selectedPayment &&
          (() => {
            const paymentTenant = tenants.find(
              (tenant) => tenant.id === selectedPayment.tenantId,
            );
            const paymentRoom = paymentTenant
              ? rooms.find((room) => room.id === paymentTenant.roomId)
              : undefined;
            return (
              <div
                className="payment-detail-backdrop"
                onClick={() => setSelectedPayment(null)}
              >
                <Card
                  className="payment-detail-panel"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="payment-detail-header">
                    <div>
                      <span className="payment-detail-eyebrow">
                        Payment information
                      </span>
                      <h2>{paymentTenant?.name ?? "Unknown tenant"}</h2>
                    </div>
                    <button
                      type="button"
                      className="payment-detail-close"
                      onClick={() => setSelectedPayment(null)}
                      aria-label="Close payment details"
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <div className="payment-detail-status">
                    <PaymentTagBadge daysOffset={selectedPayment.daysOffset} />
                    <strong className="mono">
                      {fmtRWF(selectedPayment.amount)}
                    </strong>
                  </div>
                  <div className="payment-detail-grid">
                    <div>
                      <span>Building and room</span>
                      <strong>{roomLocation(paymentRoom)}</strong>
                    </div>
                    <div>
                      <span>Payment date</span>
                      <strong>{selectedPayment.recordedDate}</strong>
                    </div>
                    <div>
                      <span>Period start</span>
                      <strong>{selectedPayment.periodStart}</strong>
                    </div>
                    <div>
                      <span>Months covered</span>
                      <strong>{selectedPayment.monthsCovered}</strong>
                    </div>
                    <div>
                      <span>Timing</span>
                      <strong>{tagLabel(selectedPayment.daysOffset)}</strong>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })()}
      </div>
    </div>
  );
}

// ─── Page: Reports ────────────────────────────────────────────────────────────

type ReportTab = "monthly" | "annual" | "custom" | "per-tenant";

function ReportsPage({
  rooms,
  tenants,
  payments,
}: {
  rooms: Room[];
  tenants: Tenant[];
  payments: Payment[];
}) {
  const [tab, setTab] = useState<ReportTab>("monthly");
  const [month, setMonth] = useState("2026-07");
  const [year, setYear] = useState("2026");
  const [dateFrom, setDateFrom] = useState("2026-01-01");
  const [dateTo, setDateTo] = useState("2026-07-19");
  const [tenantId, setTenantId] = useState("");
  const [generated, setGenerated] = useState(false);
  const [results, setResults] = useState<Payment[]>([]);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  function buildReportRows() {
    return results.map((p) => {
      const t = tenants.find((tt) => tt.id === p.tenantId);
      const r = t ? rooms.find((rr) => rr.id === t.roomId) : null;
      const tenantName = t?.name ?? "—";
      const roomLabel = roomLocation(r);
      const paymentDate = p.recordedDate;
      const monthsCovered = p.monthsCovered;
      const amount = p.amount;
      const status =
        p.daysOffset < 0 ? "early" : p.daysOffset === 0 ? "on-time" : "late";
      return {
        tenantName,
        room: roomLabel,
        paymentDate,
        monthsCovered,
        amount,
        status,
      };
    });
  }

  function makeFilename(ext: string) {
    let name = "rent-report";
    if (tab === "monthly") {
      const [y, m] = month.split("-");
      const monthName = new Date(Number(y), Number(m) - 1).toLocaleString(
        "en-US",
        { month: "long" },
      );
      name += `-monthly-${monthName}-${y}`;
    } else if (tab === "annual") {
      name += `-annual-${year}`;
    } else if (tab === "custom") {
      name += `-custom-${dateFrom}-to-${dateTo}`;
    } else if (tab === "per-tenant") {
      const t = tenants.find((tt) => tt.id === tenantId);
      const tn = t ? t.name.replace(/\s+/g, "") : "tenant";
      name += `-tenant-${tn}`;
    }
    return `${name}.${ext}`;
  }

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      const rows = buildReportRows();
      const title =
        tab === "monthly"
          ? `Monthly Rent Report — ${new Date(month).toLocaleString("en-US", { month: "long", year: "numeric" })}`
          : tab === "annual"
            ? `Annual Rent Report — ${year}`
            : tab === "custom"
              ? `Custom Rent Report — ${dateFrom} to ${dateTo}`
              : `Tenant Rent Report`;
      const filename = makeFilename("xlsx");
      await exportPaymentsToExcel(rows, { title, filename });
    } catch (err) {
      console.error("Export to Excel failed", err);
      alert("Failed to generate Excel file.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleExportPDF() {
    setExportingPDF(true);
    try {
      const rows = buildReportRows();
      const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
      const title =
        tab === "monthly"
          ? `Monthly Rent Report — ${new Date(month).toLocaleString("en-US", { month: "long", year: "numeric" })}`
          : tab === "annual"
            ? `Annual Rent Report — ${year}`
            : tab === "custom"
              ? `Custom Rent Report — ${dateFrom} to ${dateTo}`
              : `Tenant Rent Report`;
      const filename = makeFilename("pdf");
      await exportPaymentsToPDF(rows, { title, filename, total });
    } catch (err) {
      console.error("Export to PDF failed", err);
      alert("Failed to generate PDF file.");
    } finally {
      setExportingPDF(false);
    }
  }

  function generate() {
    let filtered = [...payments];
    if (tab === "monthly") {
      filtered = payments.filter((p) => p.periodStart === month);
    } else if (tab === "annual") {
      filtered = payments.filter((p) => p.periodStart.startsWith(year));
    } else if (tab === "custom") {
      filtered = payments.filter(
        (p) => p.recordedDate >= dateFrom && p.recordedDate <= dateTo,
      );
    } else if (tab === "per-tenant") {
      if (tenantId) filtered = payments.filter((p) => p.tenantId === tenantId);
    }
    setResults(filtered);
    setGenerated(true);
  }

  const totalAmount = results.reduce((s, p) => s + p.amount, 0);

  const tabs: { id: ReportTab; label: string }[] = [
    { id: "monthly", label: "Monthly" },
    { id: "annual", label: "Annual" },
    { id: "custom", label: "Custom Range" },
    { id: "per-tenant", label: "Per Tenant" },
  ];

  return (
    <div>
      <SectionHeader
        title="Reports"
        subtitle="Generate payment summaries by period or tenant"
      />

      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 24,
          backgroundColor: "var(--surface2)",
          borderRadius: "var(--radius)",
          padding: 4,
          alignSelf: "flex-start",
          width: "fit-content",
          overflowX: "auto",
          maxWidth: "100%",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setGenerated(false);
            }}
            style={{
              padding: "7px 16px",
              borderRadius: "calc(var(--radius) - 2px)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              border: "none",
              whiteSpace: "nowrap",
              backgroundColor: tab === t.id ? "var(--surface)" : "transparent",
              color: tab === t.id ? "var(--text)" : "var(--text-muted)",
              boxShadow: tab === t.id ? "var(--shadow)" : "none",
              transition: "all 0.12s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
          className="report-filters"
        >
          {tab === "monthly" && (
            <div>
              <Label>Month</Label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "var(--input-bg)",
                  border: "1px solid var(--input-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text)",
                  fontSize: 14,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>
          )}
          {tab === "annual" && (
            <Input
              label="Year"
              type="number"
              placeholder="2026"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              style={{ width: "100%", minWidth: 120 }}
            />
          )}
          {tab === "custom" && (
            <>
              <div>
                <Label>From</Label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "var(--input-bg)",
                    border: "1px solid var(--input-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text)",
                    fontSize: 14,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <Label>To</Label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "var(--input-bg)",
                    border: "1px solid var(--input-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text)",
                    fontSize: 14,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
              </div>
            </>
          )}
          {tab === "per-tenant" && (
            <Select
              label="Tenant"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              style={{ width: "100%", minWidth: 260 }}
            >
              <option value="">All tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
          <Button
            onClick={generate}
            style={{ alignSelf: "flex-end", width: "100%" }}
          >
            Generate Report
          </Button>
        </div>
      </Card>

      {generated && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 20,
            }}
            className="summary-grid"
          >
            <Card
              style={{
                padding: "16px 20px",
                display: "flex",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Total Payments
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: "var(--text)",
                    marginTop: 4,
                  }}
                >
                  {results.length}
                </div>
              </div>
            </Card>
            <Card style={{ padding: "16px 20px" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Total Collected
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: "var(--text)",
                  marginTop: 4,
                }}
              >
                {fmtRWF(totalAmount)}
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 80px 90px 110px",
                  gap: 12,
                  padding: "10px 20px",
                  backgroundColor: "var(--surface2)",
                  borderBottom: "1px solid var(--border)",
                  minWidth: "480px",
                }}
              >
                {["Tenant", "Location", "Months", "Tag", "Amount"].map((h) => (
                  <div
                    key={h}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {results.length === 0 ? (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  No payments found for the selected criteria.
                </div>
              ) : (
                results.map((p, i) => {
                  const t = tenants.find((t) => t.id === p.tenantId);
                  const r = t ? rooms.find((rm) => rm.id === t.roomId) : null;
                  return (
                    <div
                      key={p.id}
                      className="table-row"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 120px 80px 90px 110px",
                        gap: 12,
                        padding: "13px 20px",
                        alignItems: "center",
                        borderBottom:
                          i < results.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                        minWidth: "480px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 500,
                          color: "var(--text)",
                          fontSize: 13,
                        }}
                      >
                        {t?.name ?? "—"}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        {roomLocation(r)}
                      </div>
                      <div
                        className="mono"
                        style={{ fontSize: 13, color: "var(--text-muted)" }}
                      >
                        {p.monthsCovered} mo
                      </div>
                      <div>
                        <PaymentTagBadge daysOffset={p.daysOffset} />
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "var(--text)",
                        }}
                      >
                        {fmtRWF(p.amount)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginBottom: 12,
                flexWrap: "wrap",
                padding: "0 4px",
              }}
            >
              <Button
                onClick={handleExportExcel}
                disabled={exportingExcel || results.length === 0}
              >
                {exportingExcel ? "Generating..." : "Export to Excel"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleExportPDF}
                disabled={exportingPDF || results.length === 0}
              >
                {exportingPDF ? "Generating..." : "Export to PDF"}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Page: Buildings ──────────────────────────────────────────────────────────

function RoomList({
  rooms,
  tenants,
  onSelect,
  onEdit,
  onDelete,
}: {
  rooms: Room[];
  tenants: TenantWithTin[];
  onSelect: (roomId: string) => void;
  onEdit: (room: Room) => void;
  onDelete: (roomId: string) => void;
}) {
  return (
    <div className="room-list" aria-label="Rooms list">
      {rooms.map((room) => {
        const tenant = getTenantForRoom(room.id, tenants);
        const occupied = Boolean(tenant);
        return (
          <div
            key={room.id}
            className="room-list-row"
            onClick={() => onSelect(room.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(room.id);
              }
            }}
          >
            <div className="room-list-number mono">{room.number}</div>
            <div className="room-list-tenant">
              <strong>{tenant?.name ?? "No tenant assigned"}</strong>
              <span>{fmtRWF(room.baseRent)}/mo</span>
            </div>
            <StatusBadge status={occupied ? "occupied" : "vacant"} />
            <div className="room-list-actions">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(room);
                }}
                title={`Edit room ${room.number}`}
                aria-label={`Edit room ${room.number}`}
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (
                    window.confirm("Are you sure you want to delete this room?")
                  ) {
                    onDelete(room.id);
                  }
                }}
                title={`Delete room ${room.number}`}
                aria-label={`Delete room ${room.number}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BuildingsPage({
  rooms,
  tenants,
  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
}: {
  rooms: Room[];
  tenants: TenantWithTin[];
  onAddRoom: (room: Partial<Room>) => void;
  onUpdateRoom: (room: Room) => void;
  onDeleteRoom: (roomId: string) => void;
}) {
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [buildingId, setBuildingId] = useState("");
  const [form, setForm] = useState(() => ({
    floor:
      (typeof window !== "undefined" &&
        (localStorage.getItem("rm:activeFloor") as Floor)) ||
      ("Ground" as Floor),
    number: "",
    baseRent: "",
  }));
  const [submitted, setSubmitted] = useState(false);
  const [roomViewMode, setRoomViewMode] = useState<"grid" | "list">("grid");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<{
    floor: Floor;
    number: string;
    baseRent: string;
    buildingId: string;
  }>({
    floor: "Ground" as Floor,
    number: "",
    baseRent: "",
    buildingId: "",
  });

  const selectedRoom = selectedRoomId
    ? (rooms.find((room) => room.id === selectedRoomId) ?? null)
    : null;
  const selectedTenant = selectedRoom
    ? getTenantForRoom(selectedRoom.id, tenants)
    : null;

  useEffect(() => {
    let isMounted = true;

    async function loadBuildings() {
      try {
        const rows = await fetchBuildings();
        if (!isMounted) return;
        setBuildings(rows);

        const stored =
          typeof window !== "undefined"
            ? localStorage.getItem("rm:activeBuilding")
            : null;
        if (stored && rows.some((r) => r.id === stored)) {
          setBuildingId(stored);
        } else if (rows.length > 0 && !buildingId) {
          setBuildingId(rows[0].id);
        }
      } catch (err) {
        console.error("Failed to load buildings", err);
      }
    }

    loadBuildings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Whenever the selected building changes, default the Floor field to
  // that building's own first configured floor.
  useEffect(() => {
    if (buildingId) {
      const floors = getBuildingFloors(buildingId);
      setForm((f) => ({ ...f, floor: (floors[0] || "Ground") as Floor }));
    }
  }, [buildingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.number.trim() || !form.baseRent.trim() || !buildingId) return;

    const newRoom: Partial<Room> = {
      id: "room-" + uniqueId(),
      floor: form.floor,
      number: form.number.trim(),
      baseRent: parseInt(form.baseRent, 10),
      occupied: false,
      buildingId,
    };

    onAddRoom(newRoom);
    setForm((f) => ({ ...f, number: "", baseRent: "" }));
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  function startEditRoom(room: Room) {
    setEditingRoomId(room.id);
    setEditingRoom({
      floor: room.floor,
      number: room.number,
      baseRent: room.baseRent.toString(),
      buildingId: room.buildingId || buildingId,
    });
  }

  function submitEditRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRoomId) return;
    const existing = rooms.find((r) => r.id === editingRoomId);
    if (!existing) return;
    onUpdateRoom({
      ...existing,
      floor: editingRoom.floor,
      number: editingRoom.number.trim(),
      baseRent: parseInt(editingRoom.baseRent, 10) || existing.baseRent,
      buildingId: editingRoom.buildingId,
    });
    setEditingRoomId(null);
  }

  const currentFloorOptions = getBuildingFloors(buildingId);
  const orphanRooms = rooms.filter(
    (r) => !buildings.some((b) => b.id === r.buildingId),
  );

  return (
    <div>
      <SectionHeader
        title="Buildings"
        subtitle="Rooms grouped by building and floor"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <Card style={{ padding: 20 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Register a Room
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 20,
            }}
          >
            Add a new room to the selected building. Need a different floor
            list? Configure it from Settings → Configure Floors.
          </div>
          <Divider />
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginTop: 16,
            }}
          >
            <Select
              label="Building"
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              required
            >
              {buildings.length === 0 ? (
                <option value="">Loading buildings…</option>
              ) : (
                buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))
              )}
            </Select>

            <Select
              label="Floor"
              value={form.floor}
              onChange={(e) =>
                setForm((f) => ({ ...f, floor: e.target.value as Floor }))
              }
              required
            >
              {currentFloorOptions.map((floor) => (
                <option key={floor} value={floor}>
                  {floorLabel(floor)}
                </option>
              ))}
            </Select>

            <Input
              label="Room number"
              value={form.number}
              onChange={(e) =>
                setForm((f) => ({ ...f, number: e.target.value }))
              }
              required
            />
            <Input
              label="Base rent (RWF)"
              type="number"
              value={form.baseRent}
              onChange={(e) =>
                setForm((f) => ({ ...f, baseRent: e.target.value }))
              }
              required
            />

            <Button type="submit" style={{ marginTop: 4 }}>
              Add Room
            </Button>

            {submitted && (
              <div
                style={{
                  padding: "10px 14px",
                  backgroundColor: "var(--status-paid-bg)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--status-paid)",
                  fontSize: 13,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {Icon.check} Room added successfully.
              </div>
            )}
          </form>
        </Card>

        <div className="room-view-toolbar" aria-label="Room view options">
          <span>Room view</span>
          <div
            className="room-view-toggle"
            role="group"
            aria-label="Choose room view"
          >
            <button
              type="button"
              className={roomViewMode === "grid" ? "is-active" : ""}
              onClick={() => setRoomViewMode("grid")}
              aria-pressed={roomViewMode === "grid"}
              title="Grid view"
            >
              <LayoutGrid size={16} /> Grid
            </button>
            <button
              type="button"
              className={roomViewMode === "list" ? "is-active" : ""}
              onClick={() => setRoomViewMode("list")}
              aria-pressed={roomViewMode === "list"}
              title="List view"
            >
              <List size={16} /> List
            </button>
          </div>
        </div>

        {/* Rooms grouped by building, then by that building's own floors */}
        {buildings.map((building) => {
          const buildingRooms = rooms.filter(
            (r) => r.buildingId === building.id,
          );
          const floorsForBuilding = getBuildingFloors(building.id);

          return (
            <div key={building.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={18} />
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: "var(--text)",
                    }}
                  >
                    {building.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {buildingRooms.length} room
                    {buildingRooms.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {buildingRooms.length === 0 ? (
                <div
                  style={{
                    padding: "16px 4px 28px",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  No rooms registered in this building yet.
                </div>
              ) : (
                floorsForBuilding.map((floor) => {
                  const floorRooms = buildingRooms.filter(
                    (r) => r.floor === floor,
                  );
                  if (floorRooms.length === 0) return null;
                  const vacantCount = floorRooms.filter(
                    (room) => !getTenantForRoom(room.id, tenants),
                  ).length;
                  const occupiedCount = floorRooms.length - vacantCount;

                  return (
                    <div key={floor} style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: 14,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 15,
                            color: "var(--text)",
                          }}
                        >
                          {floorLabel(floor)}
                        </div>
                        <div
                          style={{ fontSize: 12, color: "var(--text-muted)" }}
                        >
                          <span className="mono">{occupiedCount}</span>/
                          {floorRooms.length} occupied
                          {vacantCount > 0 && (
                            <span
                              style={{
                                marginLeft: 8,
                                color: "var(--status-paid)",
                                fontWeight: 500,
                              }}
                            >
                              {" "}
                              · {vacantCount} vacant
                            </span>
                          )}
                        </div>
                      </div>
                      {roomViewMode === "list" ? (
                        <RoomList
                          rooms={floorRooms}
                          tenants={tenants}
                          onSelect={setSelectedRoomId}
                          onEdit={startEditRoom}
                          onDelete={onDeleteRoom}
                        />
                      ) : (
                        <div
                          className="room-card-grid"
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(160px, 1fr))",
                            gap: 12,
                          }}
                        >
                          {floorRooms.map((room) => {
                            const tenant = getTenantForRoom(room.id, tenants);
                            const occupied = Boolean(tenant);
                            return (
                              <div
                                key={room.id}
                                className="room-card"
                                onClick={() => setSelectedRoomId(room.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    setSelectedRoomId(room.id);
                                  }
                                }}
                                style={{
                                  backgroundColor: occupied
                                    ? "var(--surface)"
                                    : "var(--status-paid-bg)",
                                  border: occupied
                                    ? undefined
                                    : "1.5px solid var(--status-paid)",
                                  cursor: "pointer",
                                  padding: 12,
                                  borderRadius: "var(--radius)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    marginBottom: 10,
                                  }}
                                >
                                  <div
                                    className="mono"
                                    style={{
                                      fontWeight: 600,
                                      fontSize: 14,
                                      color: "var(--text)",
                                    }}
                                  >
                                    {room.number}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      alignItems: "center",
                                    }}
                                  >
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          startEditRoom(room);
                                        }}
                                        title="Edit room"
                                        style={{
                                          background: "transparent",
                                          border: "none",
                                          cursor: "pointer",
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (
                                            window.confirm(
                                              "Are you sure you want to delete this room?",
                                            )
                                          ) {
                                            onDeleteRoom(room.id);
                                          }
                                        }}
                                        title="Delete room"
                                        style={{
                                          background: "transparent",
                                          border: "none",
                                          cursor: "pointer",
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                    <div
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        backgroundColor: occupied
                                          ? "var(--text-muted)"
                                          : "var(--status-paid)",
                                        marginTop: 2,
                                        boxShadow: occupied
                                          ? "none"
                                          : "0 0 0 3px var(--status-paid-bg)",
                                      }}
                                    />
                                  </div>
                                </div>
                                <div style={{ marginTop: 4 }}>
                                  <div style={{ marginBottom: 6 }}>
                                    <StatusBadge
                                      status={occupied ? "occupied" : "vacant"}
                                    />
                                  </div>
                                  {occupied ? (
                                    <div
                                      style={{
                                        fontSize: 13,
                                        color: "var(--text)",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {tenant?.name}
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      No tenant assigned
                                    </div>
                                  )}
                                  <div
                                    className="mono"
                                    style={{
                                      fontSize: 12,
                                      color: "var(--text-muted)",
                                      marginTop: 4,
                                    }}
                                  >
                                    {fmtRWF(room.baseRent)}/mo
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}

        {/* Rooms whose buildingId doesn't match any known building (legacy/orphan data) */}
        {orphanRooms.length > 0 && (
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                color: "var(--text)",
                marginBottom: 16,
              }}
            >
              Unassigned Rooms
            </div>
            {roomViewMode === "list" ? (
              <RoomList
                rooms={orphanRooms}
                tenants={tenants}
                onSelect={setSelectedRoomId}
                onEdit={startEditRoom}
                onDelete={onDeleteRoom}
              />
            ) : (
              <div
                className="room-card-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 12,
                }}
              >
                {orphanRooms.map((room) => {
                  const tenant = getTenantForRoom(room.id, tenants);
                  const occupied = Boolean(tenant);
                  return (
                    <div
                      key={room.id}
                      className="room-card"
                      style={{
                        padding: 12,
                        borderRadius: "var(--radius)",
                        backgroundColor: occupied
                          ? "var(--surface)"
                          : "var(--status-paid-bg)",
                      }}
                    >
                      <div
                        className="mono"
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "var(--text)",
                          marginBottom: 6,
                        }}
                      >
                        {floorLabel(room.floor)} · {room.number}
                      </div>
                      <StatusBadge status={occupied ? "occupied" : "vacant"} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Room details panel */}
      {selectedRoom && (
        <div
          onClick={() => setSelectedRoomId(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.35)",
            zIndex: 120,
            display: "flex",
            justifyContent: "flex-end",
            padding: 20,
          }}
        >
          <Card
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(430px, 100%)",
              maxHeight: "calc(100vh - 40px)",
              overflowY: "auto",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Room details
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 18,
                    color: "var(--text)",
                  }}
                >
                  {floorLabel(selectedRoom.floor)} · {selectedRoom.number}
                </div>
              </div>
              <button
                onClick={() => setSelectedRoomId(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: 14,
                }}
                aria-label="Close room details"
              >
                Close
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--surface2)",
                }}
              >
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Occupancy status
                </div>
                <StatusBadge status={selectedTenant ? "occupied" : "vacant"} />
              </div>

              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                <div style={{ marginBottom: 4 }}>Room information</div>
                <div style={{ color: "var(--text)", fontWeight: 500 }}>
                  Floor: {floorLabel(selectedRoom.floor)}
                </div>
                <div style={{ color: "var(--text)", fontWeight: 500 }}>
                  Room number: {selectedRoom.number}
                </div>
                <div style={{ color: "var(--text)", fontWeight: 500 }}>
                  Base rent: {fmtRWF(selectedRoom.baseRent)}/mo
                </div>
              </div>

              {selectedTenant ? (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: "12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface2)",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--text)" }}>
                    Tenant assigned
                  </div>
                  <div style={{ color: "var(--text)" }}>
                    <div style={{ fontWeight: 600 }}>{selectedTenant.name}</div>
                    {selectedTenant.phone ? (
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        Phone: {selectedTenant.phone}
                      </div>
                    ) : null}
                    {selectedTenant.tinNumber ? (
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        TIN number: {selectedTenant.tinNumber}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        TIN number: Not provided
                      </div>
                    )}
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      Monthly rent: {fmtRWF(selectedTenant.monthlyRent)}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      Due date: Day {selectedTenant.dueDay} of the month
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      Start date: {selectedTenant.startDate}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px dashed var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  No tenant assigned
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Edit room modal (was previously missing — CRUD is now complete) */}
      {editingRoomId && (
        <div
          onClick={() => setEditingRoomId(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15,23,42,0.35)",
            zIndex: 130,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(420px, 100%)", padding: 20 }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                marginBottom: 16,
                color: "var(--text)",
              }}
            >
              Edit Room
            </div>
            <form
              onSubmit={submitEditRoom}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <Select
                label="Building"
                value={editingRoom.buildingId}
                onChange={(e) => {
                  const bId = e.target.value;
                  const floors = getBuildingFloors(bId);
                  setEditingRoom((r) => ({
                    ...r,
                    buildingId: bId,
                    floor: (floors[0] || "Ground") as Floor,
                  }));
                }}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Floor"
                value={editingRoom.floor}
                onChange={(e) =>
                  setEditingRoom((r) => ({
                    ...r,
                    floor: e.target.value as Floor,
                  }))
                }
              >
                {getBuildingFloors(editingRoom.buildingId).map((f) => (
                  <option key={f} value={f}>
                    {floorLabel(f)}
                  </option>
                ))}
              </Select>
              <Input
                label="Room number"
                value={editingRoom.number}
                onChange={(e) =>
                  setEditingRoom((r) => ({ ...r, number: e.target.value }))
                }
                required
              />
              <Input
                label="Base rent (RWF)"
                type="number"
                value={editingRoom.baseRent}
                onChange={(e) =>
                  setEditingRoom((r) => ({ ...r, baseRent: e.target.value }))
                }
                required
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="submit" style={{ flex: 1 }}>
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingRoomId(null)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type Page =
  | "dashboard"
  | "tenants"
  | "payments"
  | "reports"
  | "buildings"
  | "settings"
  | "notifications";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "tenants", label: "Tenants", icon: <Users size={18} /> },
  { id: "payments", label: "Payments", icon: <Wallet size={18} /> },
  { id: "reports", label: "Reports", icon: <FileBarChart size={18} /> },
  { id: "buildings", label: "Buildings", icon: <Building2 size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
];

function Sidebar({
  page,
  setPage,
  darkMode,
  setDarkMode,
  collapsed,
  setCollapsed,
  isMobileView,
}: {
  page: Page;
  setPage: (p: Page) => void;
  darkMode: boolean;
  setDarkMode: (d: boolean) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean | ((v: boolean) => boolean)) => void;
  isMobileView: boolean;
}) {
  const navigate = useNavigate();

  function handleNavigate(nextPage: Page) {
    setPage(nextPage);
    const routes: Record<Page, string> = {
      dashboard: "/dashboard",
      tenants: "/tenants",
      payments: "/payments",
      reports: "/reports",
      buildings: "/buildings",
      settings: "/settings",
      notifications: "/notifications",
    };
    navigate(routes[nextPage]);
  }

  return (
    <>
      {isMobileView && !collapsed ? (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.35)",
            zIndex: 90,
          }}
        />
      ) : null}
      <aside
        style={{
          width: collapsed ? 72 : 240,
          flexShrink: 0,
          backgroundColor: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: isMobileView ? "fixed" : "sticky",
          top: 0,
          left: 0,
          zIndex: 100,
          transition:
            "width 0.25s ease, padding 0.25s ease, transform 0.25s ease",
          transform:
            isMobileView && collapsed ? "translateX(-100%)" : "translateX(0)",
          boxShadow:
            isMobileView && !collapsed
              ? "0 18px 50px rgba(0,0,0,0.18)"
              : "none",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "10px",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "flex-end",
            marginBottom: 4,
          }}
          aria-label={collapsed ? "Open navigation" : "Close navigation"}
          title={collapsed ? "Open navigation" : "Close navigation"}
        >
          {collapsed ? <Menu size={18} /> : <X size={18} />}
        </button>
        <div
          style={{
            padding: collapsed ? "10px 12px 14px" : "22px 20px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: collapsed ? 0 : 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            {!collapsed ? (
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--text)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Rent Manager
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 1,
                  }}
                >
                  Kigali · 2026
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <nav style={{ padding: "12px 10px" }}>
            {NAV_ITEMS.map((item) => {
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "flex-start",
                    gap: collapsed ? 0 : 10,
                    width: "100%",
                    padding: collapsed ? "9px 0" : "9px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    marginBottom: 2,
                    backgroundColor: active
                      ? "var(--nav-active-bg)"
                      : "transparent",
                    color: active
                      ? "var(--nav-active-text)"
                      : "var(--nav-text)",
                    fontWeight: active ? 600 : 400,
                    fontSize: 14,
                    transition: "background-color 0.1s, color 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      e.currentTarget.style.backgroundColor =
                        "var(--nav-hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      e.currentTarget.style.backgroundColor = "transparent";
                  }}
                  title={item.label}
                >
                  <span style={{ flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed ? <span>{item.label}</span> : null}
                  {active && !collapsed && (
                    <span
                      style={{
                        marginLeft: "auto",
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        backgroundColor: "var(--accent)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div
          style={{ padding: "14px 10px", borderTop: "1px solid var(--border)" }}
        >
          <div style={{ marginBottom: 8 }}>
            <UserMenu collapsed={collapsed} />
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: collapsed ? 0 : 8,
              width: "100%",
              padding: collapsed ? "8px 0" : "8px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              backgroundColor: "var(--surface2)",
              color: "var(--text-muted)",
              fontSize: 13,
              fontWeight: 500,
              transition: "background-color 0.12s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--nav-hover-bg)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--surface2)")
            }
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed ? (darkMode ? "Light mode" : "Dark mode") : null}
          </button>
        </div>
      </aside>
    </>
  );
}

function SettingsPage() {
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [newBuildingName, setNewBuildingName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string>(
    typeof window !== "undefined"
      ? (localStorage.getItem("rm:activeBuilding") ?? "")
      : "",
  );
  const [selectedFloor, setSelectedFloor] = useState<Floor>(
    (typeof window !== "undefined"
      ? (localStorage.getItem("rm:activeFloor") as Floor)
      : null) || "Ground",
  );
  const [saving, setSaving] = useState(false);

  // Per-building floor configuration
  const [floorsBuildingId, setFloorsBuildingId] = useState("");
  const [floorList, setFloorList] = useState<string[]>([...FLOORS]);
  const [newFloorName, setNewFloorName] = useState("");
  const [floorsSaved, setFloorsSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const rows = await fetchBuildings();
        if (!mounted) return;
        setBuildings(rows);
        if (!selectedBuilding && rows.length > 0) {
          setSelectedBuilding(rows[0].id);
        }
        if (!floorsBuildingId && rows.length > 0) {
          setFloorsBuildingId(rows[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (floorsBuildingId) {
      setFloorList(getBuildingFloors(floorsBuildingId));
    }
  }, [floorsBuildingId]);

  async function handleAddBuilding() {
    const name = newBuildingName.trim();
    if (!name) return;
    try {
      const b = await addBuilding({ id: "building-" + Date.now(), name });
      setBuildings((bs) => [...bs, b]);
      setSelectedBuilding(b.id);
      setNewBuildingName("");
    } catch (err) {
      console.error("Failed to add building", err);
    }
  }

  function startEdit(building: { id: string; name: string }) {
    setEditingId(building.id);
    setEditingName(building.name);
  }

  async function saveEdit() {
    if (!editingId || !editingName.trim()) return;
    try {
      await updateBuilding(editingId, { name: editingName.trim() });
      setBuildings((bs) =>
        bs.map((b) =>
          b.id === editingId ? { ...b, name: editingName.trim() } : b,
        ),
      );
      setEditingId(null);
      setEditingName("");
    } catch (err) {
      console.error("Failed to update building", err);
    }
  }

  async function handleDeleteBuilding(buildingId: string) {
    if (
      window.confirm(
        "Are you sure you want to delete this building? This action cannot be undone.",
      )
    ) {
      try {
        await deleteBuilding(buildingId);
        setBuildings((bs) => bs.filter((b) => b.id !== buildingId));
        if (selectedBuilding === buildingId && buildings.length > 1) {
          const nextBuilding = buildings.find((b) => b.id !== buildingId);
          if (nextBuilding) setSelectedBuilding(nextBuilding.id);
        }
      } catch (err) {
        console.error("Failed to delete building", err);
      }
    }
  }

  function handleSave() {
    if (!selectedBuilding) return;
    setSaving(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("rm:activeBuilding", selectedBuilding);
        localStorage.setItem("rm:activeFloor", selectedFloor);
      }
    } finally {
      setSaving(false);
      alert("Active building and floor saved.");
    }
  }

  function addFloor() {
    const name = newFloorName.trim();
    if (!name || floorList.includes(name)) return;
    setFloorList((fl) => [...fl, name]);
    setNewFloorName("");
  }

  function removeFloor(name: string) {
    setFloorList((fl) => fl.filter((f) => f !== name));
  }

  function saveFloors() {
    if (!floorsBuildingId || floorList.length === 0) return;
    setBuildingFloorsStorage(floorsBuildingId, floorList);
    setFloorsSaved(true);
    setTimeout(() => setFloorsSaved(false), 3000);
  }

  return (
    <div className="settings-page">
      <SectionHeader
        title="Settings"
        subtitle="Manage buildings, floors, and your active workspace"
      />

      <div className="settings-grid">
        <Card style={{ padding: 20 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Manage Buildings
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            Add, rename or remove buildings used in this dashboard.
          </div>
          <Divider />

          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <Input
              label="New building name"
              value={newBuildingName}
              onChange={(e) => setNewBuildingName(e.target.value)}
              style={{ flex: "1 1 200px" }}
            />
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Button
                onClick={handleAddBuilding}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <Plus size={14} /> Add
              </Button>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            {buildings.map((b) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  {editingId === b.id ? (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                      />
                      <Button
                        onClick={saveEdit}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Check size={14} /> Save
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingId(null);
                          setEditingName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: "var(--text)" }}>
                      {b.name}
                    </div>
                  )}
                </div>

                {editingId !== b.id && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => startEdit(b)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                      }}
                      title="Edit building"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteBuilding(b.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                      }}
                      title="Delete building"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* NEW: per-building floor configuration */}
        <Card style={{ padding: 20 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Configure Floors
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            Each building can have its own set of floors — they don't need to
            match.
          </div>
          <Divider />

          <Select
            label="Building"
            value={floorsBuildingId}
            onChange={(e) => setFloorsBuildingId(e.target.value)}
            style={{ marginBottom: 16, maxWidth: 320 }}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {floorList.map((f) => (
              <span
                key={f}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 99,
                  padding: "5px 10px",
                  fontSize: 13,
                  color: "var(--text)",
                }}
              >
                {floorLabel(f)}
                <button
                  onClick={() => removeFloor(f)}
                  title="Remove floor"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex",
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {floorList.length === 0 && (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                No floors configured yet.
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input
              label="New floor name"
              placeholder="e.g. Mezzanine"
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              style={{ flex: "1 1 200px" }}
            />
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <Button
                variant="secondary"
                onClick={addFloor}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={14} /> Add Floor
              </Button>
              <Button onClick={saveFloors}>Save Floors</Button>
            </div>
          </div>

          {floorsSaved && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                backgroundColor: "var(--status-paid-bg)",
                borderRadius: "var(--radius-sm)",
                color: "var(--status-paid)",
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {Icon.check} Floors saved for this building.
            </div>
          )}
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
            Active management
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 180px" }}>
              <Select
                value={selectedBuilding}
                onChange={(e) => setSelectedBuilding(e.target.value)}
                label="Building"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <Select
                label="Floor"
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value as Floor)}
              >
                {getBuildingFloors(selectedBuilding).map((f) => (
                  <option key={f} value={f}>
                    {floorLabel(f)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Button onClick={handleSave} disabled={saving}>
                Save
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

export default function App() {
  const location = useLocation();
  const [page, setPage] = useState<Page>("dashboard");
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<TenantWithTin[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const routeToPage: Record<string, Page> = {
      "/dashboard": "dashboard",
      "/tenants": "tenants",
      "/payments": "payments",
      "/reports": "reports",
      "/buildings": "buildings",
      "/settings": "settings",
      "/notifications": "notifications",
    };
    setPage(routeToPage[location.pathname] ?? "dashboard");
  }, [location.pathname]);

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobileView(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [roomRows, tenantRows, paymentRows] = await Promise.all([
          fetchRooms(),
          fetchTenants(),
          fetchPayments(),
        ]);
        setRooms(roomRows as Room[]);
        setTenants(tenantRows as Tenant[]);
        setPayments(paymentRows as Payment[]);
      } catch (err) {
        console.error("Failed to load data", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  async function handleAddTenant(newTenant: TenantWithTin, room: Room) {
    try {
      const savedTenant = await addTenant({ ...newTenant, room_id: room.id });
      setTenants((ts) => [...ts, savedTenant as TenantWithTin]);
      // FIX: actually mark the room occupied (this used to spread the room
      // without setting occupied:true, which is part of why the Dashboard
      // could show stale numbers).
      setRooms((rs) =>
        rs.map((r) => (r.id === room.id ? { ...r, occupied: true } : r)),
      );
    } catch (err) {
      console.error("Failed to add tenant", err);
      setError("Failed to add tenant");
    }
  }

  async function handleUpdateTenant(updated: TenantWithTin) {
    try {
      const saved = await updateTenant(updated.id, {
        name: updated.name,
        phone: updated.phone,
        tinNumber: updated.tinNumber,
        roomId: updated.roomId,
        monthlyRent: updated.monthlyRent,
        dueDay: updated.dueDay,
      });
      setTenants((ts) =>
        ts.map((t) =>
          t.id === updated.id ? ((saved as TenantWithTin) ?? updated) : t,
        ),
      );
      setRooms((rs) =>
        rs.map((r) => {
          if (r.id === updated.roomId) return { ...r, occupied: true };
          return r;
        }),
      );
    } catch (err) {
      console.error("Failed to update tenant", err);
      setError("Failed to update tenant");
    }
  }

  async function handleDeleteTenant(tenantId: string) {
    try {
      const tenant = tenants.find((t) => t.id === tenantId);
      await deleteTenant(tenantId);
      setTenants((ts) => ts.filter((t) => t.id !== tenantId));
      if (tenant) {
        setRooms((rs) =>
          rs.map((r) =>
            r.id === tenant.roomId ? { ...r, occupied: false } : r,
          ),
        );
      }
    } catch (err) {
      console.error("Failed to delete tenant", err);
      setError("Failed to delete tenant");
    }
  }

  async function handleAddRoom(newRoom: Partial<Room>) {
    try {
      const savedRoom = await addRoom({
        ...newRoom,
        building_id: newRoom.buildingId,
      });
      setRooms((rs) => [...rs, savedRoom]);
    } catch (err) {
      console.error("Failed to add room", err);
      setError("Failed to add room");
    }
  }

  async function handleUpdateRoom(newRoom: Room) {
    try {
      const savedRoom = await updateRoom(newRoom.id, {
        floor: newRoom.floor,
        number: newRoom.number,
        baseRent: newRoom.baseRent,
        buildingId: newRoom.buildingId || "",
      });
      setRooms((rs) =>
        rs.map((room) => (room.id === savedRoom.id ? savedRoom : room)),
      );
    } catch (err) {
      console.error("Failed to update room", err);
      setError("Failed to update room");
    }
  }

  async function handleDeleteRoom(roomId: string) {
    try {
      await deleteRoom(roomId);
      setRooms((rs) => rs.filter((room) => room.id !== roomId));
    } catch (err) {
      console.error("Failed to delete room", err);
      setError("Failed to delete room");
    }
  }

  async function handleAddPayment(payment: Payment) {
    try {
      const savedPayment = await addPayment({
        ...payment,
        tenant_id: payment.tenantId,
      });
      setPayments((ps) => [...ps, savedPayment as Payment]);
    } catch (err) {
      console.error("Failed to add payment", err);
      setError("Failed to add payment");
    }
  }

  function DashboardShell({
    notifications = false,
  }: {
    notifications?: boolean;
  }) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          backgroundColor: "var(--bg)",
          overflow: "hidden",
        }}
      >
        {isMobileView && (
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            style={{
              position: "fixed",
              top: 12,
              left: 12,
              zIndex: 101,
              width: 40,
              height: 40,
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text)",
              padding: 0,
              boxShadow: "var(--shadow)",
            }}
            aria-label="Toggle navigation menu"
            title="Toggle navigation menu"
          >
            {sidebarCollapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
        )}

        <Sidebar
          page={page}
          setPage={setPage}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          isMobileView={isMobileView}
        />

        <main
          className="main-content"
          style={{ flex: 1, overflowY: "auto", minHeight: "100vh" }}
        >
          {error ? (
            <div
              style={{
                padding: 18,
                borderRadius: "var(--radius)",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <div style={{ color: "var(--text-muted)" }}>Loading data…</div>
          ) : (
            <>
              {page === "dashboard" && !notifications && (
                <DashboardPage
                  rooms={rooms}
                  tenants={tenants}
                  payments={payments}
                />
              )}
              {notifications && (
                <NotificationsPage
                  rooms={rooms}
                  tenants={tenants}
                  payments={payments}
                />
              )}
              {!notifications && (
                <>
                  {page === "tenants" && (
                    <TenantsPage
                      rooms={rooms}
                      tenants={tenants}
                      onAddTenant={handleAddTenant}
                      onUpdateTenant={handleUpdateTenant}
                      onDeleteTenant={handleDeleteTenant}
                    />
                  )}
                  {page === "payments" && (
                    <PaymentsPage
                      rooms={rooms}
                      tenants={tenants}
                      payments={payments}
                      onAddPayment={handleAddPayment}
                    />
                  )}
                  {page === "reports" && (
                    <ReportsPage
                      rooms={rooms}
                      tenants={tenants}
                      payments={payments}
                    />
                  )}
                  {page === "buildings" && (
                    <BuildingsPage
                      rooms={rooms}
                      tenants={tenants}
                      onAddRoom={handleAddRoom}
                      onUpdateRoom={handleUpdateRoom}
                      onDeleteRoom={handleDeleteRoom}
                    />
                  )}
                  {page === "settings" && <SettingsPage />}
                </>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <>
      <GlobalStyles />
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route
          path="/sign-in"
          element={
            <div
              style={{
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
                backgroundColor: "var(--bg)",
              }}
            >
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                fallbackRedirectUrl="/dashboard"
                appearance={{
                  variables: {
                    colorPrimary: "#2F6F5E",
                    colorText: "#1A2233",
                    colorTextSecondary: "#5B6472",
                    colorBackground: "#FFFFFF",
                    colorInputBackground: "#F7F8FA",
                    colorInputText: "#1A2233",
                    borderRadius: "8px",
                    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                  },
                  elements: {
                    card: { border: "1px solid #E4E7EC", boxShadow: "none" },
                    formButtonPrimary: {
                      backgroundColor: "#2F6F5E",
                      color: "#FFFFFF",
                      "&:hover": { opacity: 0.9 },
                    },
                    formFieldInput: { borderColor: "#E4E7EC" },
                  },
                }}
              />
            </div>
          }
        />
        <Route
          path="/sign-up"
          element={
            <div
              style={{
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
                backgroundColor: "var(--bg)",
              }}
            >
              <SignUp
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                fallbackRedirectUrl="/dashboard"
                appearance={{
                  variables: {
                    colorPrimary: "#2F6F5E",
                    colorText: "#1A2233",
                    colorTextSecondary: "#5B6472",
                    colorBackground: "#FFFFFF",
                    colorInputBackground: "#F7F8FA",
                    colorInputText: "#1A2233",
                    borderRadius: "8px",
                    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                  },
                  elements: {
                    card: { border: "1px solid #E4E7EC", boxShadow: "none" },
                    formButtonPrimary: {
                      backgroundColor: "#2F6F5E",
                      color: "#FFFFFF",
                      "&:hover": { opacity: 0.9 },
                    },
                    formFieldInput: { borderColor: "#E4E7EC" },
                  },
                }}
              />
            </div>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenants"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />
        <Route
          path="/buildings"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <DashboardShell notifications />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
