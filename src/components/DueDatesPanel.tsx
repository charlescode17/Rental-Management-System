import { useMemo } from "react";
import Swal from "sweetalert2";
import { BellRing } from "lucide-react";
import type { Room, Tenant, Payment } from "../data";
import {
  computeNextDueDate,
  formatDaysLabel,
  formatDateReadable,
} from "../lib/dueDates";

function roomLabelFor(tenant: Tenant, rooms: Room[]): string {
  const room = rooms.find((r) => r.id === tenant.roomId);
  if (!room) return "—";
  return `${room.buildingName ? room.buildingName + " · " : ""}${room.floor} · ${room.number}`;
}

export default function DueDatesPanel({
  rooms,
  tenants,
  payments,
}: {
  rooms: Room[];
  tenants: Tenant[];
  payments: Payment[];
}) {
  const rows = useMemo(() => {
    return tenants
      .map((t) => ({ tenant: t, status: computeNextDueDate(t, payments) }))
      .sort((a, b) => a.status.daysUntilDue - b.status.daysUntilDue);
  }, [tenants, payments]);

  function handleCheckReminders() {
    const overdue = rows.filter((r) => r.status.isOverdue);
    const dueSoon = rows.filter(
      (r) => !r.status.isOverdue && r.status.daysUntilDue <= 5,
    );

    if (overdue.length === 0 && dueSoon.length === 0) {
      Swal.fire({
        icon: "success",
        title: "All Clear",
        text: "No tenants are overdue or due soon.",
        confirmButtonText: "OK",
        confirmButtonColor: "#2F6F5E",
      });
      return;
    }

    const section = (title: string, color: string, items: typeof rows) =>
      items.length === 0
        ? ""
        : `<div style="text-align:left;margin-bottom:12px;">
            <strong style="color:${color};">${title} (${items.length})</strong>
            <ul style="margin:6px 0 0;padding-left:18px;">
              ${items.map((r) => `<li>${r.tenant.name} — ${formatDaysLabel(r.status.daysUntilDue)}</li>`).join("")}
            </ul>
          </div>`;

    Swal.fire({
      icon: "warning",
      title: "Rent Reminders",
      html:
        section("Overdue", "#DC2626", overdue) +
        section("Due Soon", "#D97706", dueSoon),
      confirmButtonText: "Got it",
      confirmButtonColor: "#2F6F5E",
    });
  }

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        overflow: "hidden",
        marginTop: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "18px 20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BellRing size={17} />
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 650,
              color: "var(--text)",
            }}
          >
            Next Due Dates
          </h2>
        </div>
        <button
          type="button"
          onClick={handleCheckReminders}
          style={{
            padding: "7px 14px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "var(--accent)",
            color: "var(--accent-fg)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Check Reminders
        </button>
      </div>

      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {rows.length === 0 ? (
          <div
            style={{
              padding: "28px 20px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No tenants registered yet.
          </div>
        ) : (
          rows.map(({ tenant, status }) => (
            <div
              key={tenant.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "12px 20px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 13,
                    color: "var(--text)",
                  }}
                >
                  {tenant.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  {roomLabelFor(tenant, rooms)} · Due{" "}
                  {formatDateReadable(status.nextDueDate)}
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: status.isOverdue
                    ? "var(--status-overdue)"
                    : "var(--status-paid)",
                  whiteSpace: "nowrap",
                }}
              >
                {formatDaysLabel(status.daysUntilDue)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
