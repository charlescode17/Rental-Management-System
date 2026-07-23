import type { Tenant, Payment } from "../data";

export interface DueDateStatus {
  tenantId: string;
  nextDueDate: string; // "YYYY-MM-DD"
  daysUntilDue: number; // negative = overdue by that many days
  isOverdue: boolean;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Adds `months` calendar months to a "YYYY-MM-DD" date, clamping the day
// to the target month's length (e.g. Jan 31 + 1 month -> Feb 28/29).
function addMonths(dateStr: string, months: number): Date {
  const d = new Date(dateStr);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const daysInTargetMonth = new Date(
    d.getFullYear(),
    d.getMonth() + 1,
    0,
  ).getDate();
  d.setDate(Math.min(day, daysInTargetMonth));
  return d;
}

// The furthest point any of a tenant's payments has paid rent up through
// (periodStart + monthsCovered), across ALL their payments — so someone
// who prepaid 6 months and later logs an older top-up still shows the
// correct, furthest-out coverage end.
function furthestCoverageEnd(
  tenantId: string,
  payments: Payment[],
): Date | null {
  let furthest: Date | null = null;
  for (const p of payments) {
    if (p.tenantId !== tenantId) continue;
    const months = Math.max(1, p.monthsCovered || 1);
    const end = addMonths(p.periodStart, months);
    if (!furthest || end.getTime() > furthest.getTime()) {
      furthest = end;
    }
  }
  return furthest;
}

// Computes a tenant's NEXT due date, honoring advance payments — if 6
// months were prepaid, the next due date is 6 months out, not next month.
export function computeNextDueDate(
  tenant: Tenant,
  payments: Payment[],
  today: Date = new Date(),
): DueDateStatus {
  const coverageEnd = furthestCoverageEnd(tenant.id, payments);

  let nextDue: Date;
  if (coverageEnd) {
    const daysInMonth = new Date(
      coverageEnd.getFullYear(),
      coverageEnd.getMonth() + 1,
      0,
    ).getDate();
    nextDue = new Date(
      coverageEnd.getFullYear(),
      coverageEnd.getMonth(),
      Math.min(tenant.dueDay, daysInMonth),
    );
  } else {
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();
    const thisMonthDue = new Date(
      today.getFullYear(),
      today.getMonth(),
      Math.min(tenant.dueDay, daysInMonth),
    );
    nextDue = thisMonthDue;
    if (stripTime(thisMonthDue).getTime() < stripTime(today).getTime()) {
      nextDue = addMonths(toDateKey(thisMonthDue), 1);
    }
  }

  const diffDays = Math.round(
    (stripTime(nextDue).getTime() - stripTime(today).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return {
    tenantId: tenant.id,
    nextDueDate: toDateKey(nextDue),
    daysUntilDue: diffDays,
    isOverdue: diffDays < 0,
  };
}

export function formatDaysLabel(days: number): string {
  if (days < 0) {
    const overdue = Math.abs(days);
    return `${overdue} day${overdue !== 1 ? "s" : ""} overdue`;
  }
  if (days === 0) return "Due today";
  return `${days} day${days !== 1 ? "s" : ""} left`;
}

export function formatDateReadable(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
