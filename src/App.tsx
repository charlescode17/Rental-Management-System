import { useState, useEffect, useRef } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { Navigate, Route, Routes } from "react-router-dom";
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
} from "lucide-react";
import WelcomePage from "./WelcomePage";
import UserMenu from "./UserMenu";
import { FLOORS, FLOOR_LABELS } from "./data";
import type { Room, Tenant, Payment, Floor, PaymentTag } from "./data";
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
} from "./lib/queries";

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

function StatusBadge({ status }: { status: "paid" | "due-soon" | "overdue" }) {
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
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
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
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
        }}
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

function DashboardPage({
  rooms,
  tenants,
  payments,
}: {
  rooms: Room[];
  tenants: Tenant[];
  payments: Payment[];
}) {
  const occupied = rooms.filter((r) => r.occupied).length;
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

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <Card style={{ padding: 24 }}>
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
                width: `${(occupied / total) * 100}%`,
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

        <Card style={{ padding: 24 }}>
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

        <Card style={{ padding: 24 }}>
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

      {/* Reminders */}
      <Card>
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Reminders
          </div>
          <div
            style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}
          >
            Tenants requiring follow-up as of today
          </div>
        </div>
        {reminders.length === 0 ? (
          <div
            style={{
              padding: "40px 24px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            All tenants are up to date.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 130px 110px",
                gap: 12,
                padding: "10px 24px",
                backgroundColor: "var(--surface2)",
                borderBottom: "1px solid var(--border)",
                minWidth: "480px",
              }}
            >
              {["Tenant", "Location", "Due status", "Status"].map((h) => (
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
            {reminders.map((row, i) => (
              <div
                key={row.tenant.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 140px 130px 110px",
                  gap: 12,
                  padding: "14px 24px",
                  alignItems: "center",
                  borderBottom:
                    i < reminders.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                  backgroundColor: "transparent",
                  minWidth: "480px",
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
                    {row.tenant.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    Due on the {row.tenant.dueDay}
                    {["st", "nd", "rd"][row.tenant.dueDay - 1] || "th"}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {row.room.floor === "Ground" ? "GF" : row.room.floor} · Room{" "}
                  {row.room.number}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 12,
                    color:
                      row.status === "overdue"
                        ? "var(--status-overdue)"
                        : "var(--status-due)",
                  }}
                >
                  {row.status === "overdue"
                    ? `${row.daysOverdue} day${row.daysOverdue !== 1 ? "s" : ""} overdue`
                    : row.daysUntilDue === 0
                      ? "Due today"
                      : `Due in ${row.daysUntilDue} day${row.daysUntilDue !== 1 ? "s" : ""}`}
                </div>
                <div>
                  <StatusBadge
                    status={row.status === "overdue" ? "overdue" : "due-soon"}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Page: Tenants ────────────────────────────────────────────────────────────

function TenantsPage({
  rooms,
  tenants,
  onAddTenant,
}: {
  rooms: Room[];
  tenants: Tenant[];
  onAddTenant: (t: Tenant, r: Room) => void;
}) {
  const [form, setForm] = useState({
    roomId: "",
    name: "",
    phone: "",
    rent: "",
    dueDay: "5",
  });
  const [submitted, setSubmitted] = useState(false);

  const vacantRooms = rooms.filter((r) => !r.occupied);

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
    const newTenant: Tenant = {
      id: "t" + uniqueId(),
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      roomId: form.roomId,
      monthlyRent: parseInt(form.rent),
      dueDay: parseInt(form.dueDay),
      startDate: "2026-07-19",
    };
    onAddTenant(newTenant, room);
    setForm({ roomId: "", name: "", phone: "", rent: "", dueDay: "5" });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

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
        {/* Tenant list */}
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
              Active Tenants
            </div>
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--text-muted)" }}
            >
              {tenants.length} total
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 90px 110px",
                gap: 12,
                padding: "10px 20px",
                backgroundColor: "var(--surface2)",
                borderBottom: "1px solid var(--border)",
                minWidth: "400px",
              }}
            >
              {["Name", "Floor", "Room", "Monthly Rent"].map((h) => (
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
            {tenants.map((t, i) => {
              const room = rooms.find((r) => r.id === t.roomId);
              return (
                <div
                  key={t.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 90px 110px",
                    gap: 12,
                    padding: "13px 20px",
                    alignItems: "center",
                    borderBottom:
                      i < tenants.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    minWidth: "400px",
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
                    {t.phone && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 1,
                        }}
                      >
                        {t.phone}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {room?.floor ?? "—"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {room?.number ?? "—"}
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      className="mono"
                      style={{ fontSize: 13, color: "var(--text)" }}
                    >
                      {fmtRWF(t.monthlyRent)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
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
                  {r.floor} · {r.number} — {fmtRWF(r.baseRent)}/mo
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
    </div>
  );
}

// ─── Page: Payments ───────────────────────────────────────────────────────────

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
            {/* Live search */}
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
                              {r.floor} · {r.number} · {fmtRWF(t.monthlyRent)}
                              /mo
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Read-only tenant info */}
            {selectedTenant && selectedRoom && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div>
                  <Label>Floor</Label>
                  <input
                    disabled
                    value={selectedRoom.floor}
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

            {/* Total */}
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

        {/* Recent payments */}
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
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--text-muted)" }}
            >
              {payments.length} total
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 90px 100px",
                gap: 12,
                padding: "10px 20px",
                backgroundColor: "var(--surface2)",
                borderBottom: "1px solid var(--border)",
                minWidth: "420px",
              }}
            >
              {["Tenant", "Months", "Tag", "Amount"].map((h) => (
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
            {recentPayments.map((p, i) => {
              const t = tenants.find((t) => t.id === p.tenantId);
              const r = t ? rooms.find((rm) => rm.id === t.roomId) : null;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 90px 100px",
                    gap: 12,
                    padding: "13px 20px",
                    alignItems: "center",
                    borderBottom:
                      i < recentPayments.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    minWidth: "420px",
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
                      {t?.name ?? "—"}
                    </div>
                    {r && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 1,
                        }}
                      >
                        {r.floor} · {r.number}
                      </div>
                    )}
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
            })}
          </div>
        </Card>
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

      {/* Tab selector */}
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

      {/* Filter controls */}
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
          {/* Summary bar */}
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

          {/* Results list */}
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
                        {r ? `${r.floor} · ${r.number}` : "—"}
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
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Page: Buildings ──────────────────────────────────────────────────────────

function BuildingsPage({
  rooms,
  tenants,
  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
}: {
  rooms: Room[];
  tenants: Tenant[];
  onAddRoom: (room: Partial<Room>) => void;
  onUpdateRoom: (room: Room) => void;
  onDeleteRoom: (roomId: string) => void;
}) {
  const [form, setForm] = useState(() => ({
    floor:
      (typeof window !== "undefined" &&
        (localStorage.getItem("rm:activeFloor") as Floor)) ||
      ("Ground" as Floor),
    number: "",
    baseRent: "",
  }));
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [buildingId, setBuildingId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<{
    floor: Floor;
    number: string;
    baseRent: string;
    buildingId: string;
  }>({
    floor: "Ground",
    number: "",
    baseRent: "",
    buildingId: "",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadBuildings() {
      try {
        const rows = await fetchBuildings();
        if (!isMounted) return;
        setBuildings(rows);

        // Prefer saved active building from settings if it exists
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
    setForm({ floor: "Ground", number: "", baseRent: "" });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div>
      <SectionHeader
        title="Buildings"
        subtitle="Floor-by-floor room availability"
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
            Add a new room to the selected building.
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
              {FLOORS.map((floor) => (
                <option key={floor} value={floor}>
                  {FLOOR_LABELS[floor]}
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

        {FLOORS.map((floor) => {
          const floorRooms = rooms.filter((r) => r.floor === floor);
          const vacantCount = floorRooms.filter((r) => !r.occupied).length;

          return (
            <div key={floor}>
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
                  {FLOOR_LABELS[floor]}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <span className="mono">
                    {floorRooms.length - vacantCount}
                  </span>
                  /{floorRooms.length} occupied
                  {vacantCount > 0 && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "var(--status-paid)",
                        fontWeight: 500,
                      }}
                    >
                      · {vacantCount} vacant
                    </span>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 12,
                }}
                className="room-card-grid"
              >
                {floorRooms.map((room) => {
                  const tenant = room.tenantId
                    ? tenants.find((t) => t.id === room.tenantId)
                    : null;
                  const vacant = !room.occupied;
                  return (
                    <div
                      key={room.id}
                      style={{
                        padding: "16px 18px",
                        backgroundColor: vacant
                          ? "var(--status-paid-bg)"
                          : "var(--surface)",
                        border: `1.5px solid ${vacant ? "var(--status-paid)" : "var(--border)"}`,
                        borderRadius: "var(--radius)",
                        position: "relative",
                        transition: "box-shadow 0.12s",
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
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--text)",
                          }}
                        >
                          {room.number}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => {
                              setEditingRoomId(room.id);
                              setEditingRoom({
                                floor: room.floor,
                                number: room.number,
                                baseRent: room.baseRent.toString(),
                                buildingId: room.buildingId || "",
                              });
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-muted)",
                              padding: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title="Edit room"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Are you sure you want to delete this room?",
                                )
                              ) {
                                onDeleteRoom(room.id);
                              }
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-muted)",
                              padding: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title="Delete room"
                          >
                            <Trash2 size={14} />
                          </button>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: vacant
                                ? "var(--status-paid)"
                                : "var(--text-muted)",
                              marginTop: 2,
                              boxShadow: vacant
                                ? "0 0 0 3px var(--status-paid-bg)"
                                : "none",
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        {vacant ? (
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--status-paid)",
                              letterSpacing: "0.04em",
                            }}
                          >
                            VACANT
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {tenant?.name}
                          </div>
                        )}
                        <div
                          className="mono"
                          style={{
                            fontSize: 11,
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
            </div>
          );
        })}
      </div>
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
  | "settings";

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

        {/* Nav */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <nav style={{ padding: "12px 10px" }}>
            {NAV_ITEMS.map((item) => {
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  // ISSUE 2 FIX: Navigation ONLY - never modifies collapsed state.
                  // Sidebar collapse/expand is controlled exclusively by toggle button + fixed hamburger.
                  onClick={() => setPage(item.id)}
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

        {/* Bottom: user + theme toggle */}
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
      } catch (err) {
        console.error(err);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

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

  return (
    <div>
      <SectionHeader
        title="Settings"
        subtitle="Manage buildings and configure active workspace"
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

          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <Input
              label="New building name"
              value={newBuildingName}
              onChange={(e) => setNewBuildingName(e.target.value)}
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
                }}
              >
                <div>
                  {editingId === b.id ? (
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
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

        <Card style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
            Active management
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
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
            <div style={{ width: 180 }}>
              <Select
                label="Floor"
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value as Floor)}
              >
                {FLOORS.map((f) => (
                  <option key={f} value={f}>
                    {FLOOR_LABELS[f]}
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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

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

  async function handleAddTenant(newTenant: Tenant, room: Room) {
    try {
      const savedTenant = await addTenant({
        ...newTenant,
        room_id: room.id,
      });
      setTenants((ts) => [...ts, savedTenant as Tenant]);
      setRooms((rs) => rs.map((r) => (r.id === room.id ? { ...r } : r)));
    } catch (err) {
      console.error("Failed to add tenant", err);
      setError("Failed to add tenant");
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

  function DashboardShell() {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          backgroundColor: "var(--bg)",
          overflow: "hidden",
        }}
      >
        {/* Fixed mobile hamburger button (Issue 1) */}
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
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 20,
            minHeight: "100vh",
          }}
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
              {page === "dashboard" && (
                <DashboardPage
                  rooms={rooms}
                  tenants={tenants}
                  payments={payments}
                />
              )}
              {page === "tenants" && (
                <TenantsPage
                  rooms={rooms}
                  tenants={tenants}
                  onAddTenant={handleAddTenant}
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
        </main>
      </div>
    );
  }

  return (
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
                  card: {
                    border: "1px solid #E4E7EC",
                    boxShadow: "none",
                  },
                  formButtonPrimary: {
                    backgroundColor: "#2F6F5E",
                    color: "#FFFFFF",
                    "&:hover": {
                      opacity: 0.9,
                    },
                  },
                  formFieldInput: {
                    borderColor: "#E4E7EC",
                  },
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
                  card: {
                    border: "1px solid #E4E7EC",
                    boxShadow: "none",
                  },
                  formButtonPrimary: {
                    backgroundColor: "#2F6F5E",
                    color: "#FFFFFF",
                    "&:hover": {
                      opacity: 0.9,
                    },
                  },
                  formFieldInput: {
                    borderColor: "#E4E7EC",
                  },
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
            <SettingsPage />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
