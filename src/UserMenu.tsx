import { useState, useRef, useEffect } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

export default function UserMenu({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isLoaded || !user) return null;

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.primaryEmailAddress?.emailAddress ||
    "Account";

  const email = user.primaryEmailAddress?.emailAddress;

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  }

  return (
    // FIX: this wrapper (and the button below) now carry width: "100%" +
    // minWidth: 0. Without minWidth: 0, a flex item defaults to
    // min-width: auto, which means it will never shrink below the width
    // of its content — so a long name/email just overflowed the 240px
    // sidebar instead of truncating. Setting minWidth: 0 lets the name
    // span's overflow/textOverflow/whiteSpace rules actually take effect.
    <div
      ref={menuRef}
      style={{ position: "relative", width: "100%", minWidth: 0 }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        title={email ? `${fullName} · ${email}` : fullName}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : 10,
          width: "100%",
          minWidth: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: collapsed ? "6px" : "6px 10px",
          borderRadius: "var(--radius-sm)",
          color: "var(--text)",
        }}
      >
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={fullName}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "var(--accent)",
              color: "var(--accent-fg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials || "U"}
          </div>
        )}
        {!collapsed ? (
          // FIX: long emails/usernames used to overflow the sidebar
          // instead of being shortened. This now truncates with an
          // ellipsis (…) once the name is wider than the available
          // space — the `title` attribute above shows the full name/email
          // on hover, and the dropdown below always shows it in full.
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              minWidth: 0,
              flex: "1 1 auto",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "left",
            }}
          >
            {fullName}
          </span>
        ) : null}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: "calc(100% + 8px)",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            minWidth: 200,
            maxWidth: 260,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {/* Full, untruncated name/email — this is the "see it in full
              somewhere" half of the fix, since the sidebar button itself
              always stays short. */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                wordBreak: "break-word",
              }}
            >
              {fullName}
            </div>
            {email && email !== fullName ? (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  wordBreak: "break-word",
                  marginTop: 2,
                }}
              >
                {email}
              </div>
            ) : null}
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
