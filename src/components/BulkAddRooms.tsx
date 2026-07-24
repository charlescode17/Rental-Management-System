import { useState } from "react";
import type { Room } from "../data";

function uniqueId() {
  return Math.random().toString(36).slice(2);
}

export default function BulkAddRooms({
  buildingId,
  floorOptions,
  existingRooms,
  onBulkAddRooms,
}: {
  buildingId: string;
  floorOptions: string[];
  existingRooms: Room[];
  onBulkAddRooms: (rooms: Partial<Room>[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [floor, setFloor] = useState(floorOptions[0] ?? "Ground");
  const [prefix, setPrefix] = useState("");
  const [start, setStart] = useState("1");
  const [count, setCount] = useState("5");
  const [baseRent, setBaseRent] = useState("");
  const [error, setError] = useState<string | null>(null);

  function numbers(): string[] {
    const s = parseInt(start, 10);
    const c = parseInt(count, 10);
    if (Number.isNaN(s) || Number.isNaN(c) || c <= 0) return [];
    return Array.from({ length: c }, (_, i) => `${prefix}${s + i}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const rent = parseInt(baseRent, 10);

    if (!buildingId) return setError("Select a building first.");
    if (!baseRent.trim() || Number.isNaN(rent) || rent <= 0)
      return setError("Enter a valid base rent greater than 0.");

    const nums = numbers();
    if (nums.length === 0)
      return setError("Enter a valid start number and count.");

    const existing = new Set(
      existingRooms
        .filter((r) => r.buildingId === buildingId && r.floor === floor)
        .map((r) => r.number.trim().toLowerCase()),
    );
    const toCreate = nums.filter((n) => !existing.has(n.trim().toLowerCase()));
    const skipped = nums.length - toCreate.length;

    if (toCreate.length === 0) {
      return setError("All those room numbers already exist on this floor.");
    }

    const newRooms: Partial<Room>[] = toCreate.map((number) => ({
      id: "room-" + uniqueId(),
      floor,
      number,
      baseRent: rent,
      occupied: false,
      buildingId,
    }));

    await onBulkAddRooms(newRooms);
    setOpen(false);
    setBaseRent("");
    if (skipped > 0)
      alert(`Added ${toCreate.length} rooms. Skipped ${skipped} duplicates.`);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text)",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 6,
  };

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
          Bulk Add Rooms
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {open ? "Close" : "Open"}
        </button>
      </div>

      {open && (
        <>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              margin: "8px 0 16px",
            }}
          >
            Generate a whole floor of rooms at once instead of adding them one
            by one.
          </div>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div>
              <div style={labelStyle}>Floor</div>
              <select
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                style={inputStyle}
              >
                {floorOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div>
                <div style={labelStyle}>Prefix (optional)</div>
                <input
                  style={inputStyle}
                  value={prefix}
                  placeholder="e.g. A-"
                  onChange={(e) => setPrefix(e.target.value)}
                />
              </div>
              <div>
                <div style={labelStyle}>Start Number</div>
                <input
                  style={inputStyle}
                  type="number"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <div style={labelStyle}>How Many Rooms</div>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <div>
                <div style={labelStyle}>Base Rent (RWF, all rooms)</div>
                <input
                  style={inputStyle}
                  type="number"
                  value={baseRent}
                  onChange={(e) => setBaseRent(e.target.value)}
                />
              </div>
            </div>
            {numbers().length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Will create:{" "}
                <span className="mono">{numbers().join(", ")}</span>
              </div>
            )}
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  backgroundColor: "var(--status-overdue-bg)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--status-overdue)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              style={{
                padding: "9px 18px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                backgroundColor: "var(--accent)",
                color: "var(--accent-fg)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Create Rooms
            </button>
          </form>
        </>
      )}
    </div>
  );
}
