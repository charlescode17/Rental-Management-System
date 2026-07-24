import type { Room } from "../data";

function fmtRWF(n: number) {
  return `RWF ${n.toLocaleString("en-US")}`;
}

// Turns "Les Moulins Building Complex" into "LMBC" — short label so the
// checklist stays readable even with long building names.
function buildingAbbrev(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]?.toUpperCase()).join("");
}

export default function MultiRoomPicker({
  vacantRooms,
  selectedRoomIds,
  onToggle,
  buildings,
}: {
  vacantRooms: Room[];
  selectedRoomIds: string[];
  onToggle: (roomId: string) => void;
  buildings?: Array<{ id: string; name: string }>;
}) {
  // Group vacant rooms by floor, in the order they first appear.
  const floors: string[] = [];
  const roomsByFloor: Record<string, Room[]> = {};
  for (const room of vacantRooms) {
    if (!roomsByFloor[room.floor]) {
      roomsByFloor[room.floor] = [];
      floors.push(room.floor);
    }
    roomsByFloor[room.floor].push(room);
  }

  return (
    <div>
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
        Rooms (select one or more to merge)
      </div>
      <div
        className="multi-room-picker-list"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxHeight: 240,
          overflowY: "auto",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: 8,
        }}
      >
        {vacantRooms.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 6 }}>
            No vacant rooms available.
          </div>
        )}

        {floors.map((floor) => (
          <div key={floor} style={{ marginBottom: 4 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                padding: "6px 8px 2px",
              }}
            >
              {floor}
            </div>
            {roomsByFloor[floor].map((room) => {
              const checked = selectedRoomIds.includes(room.id);
              const buildingName =
                room.buildingName ??
                buildings?.find((b) => b.id === room.buildingId)?.name ??
                "";
              const abbrev = buildingAbbrev(buildingName);
              return (
                <label
                  key={room.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                    backgroundColor: checked
                      ? "var(--nav-active-bg)"
                      : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(room.id)}
                  />
                  <span style={{ fontSize: 13, color: "var(--text)" }}>
                    {abbrev ? `${abbrev} · ` : ""}
                    {room.number} — {fmtRWF(room.baseRent)}/mo
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
      {selectedRoomIds.length > 1 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {selectedRoomIds.length} rooms selected — rent combines automatically.
        </div>
      )}
    </div>
  );
}
