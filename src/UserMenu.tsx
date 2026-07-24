import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

const MENU_WIDTH = 220;
const MARGIN = 8;

export default function UserMenu({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    left: number;
    bottom: number;
  } | null>(null);

  // wrapperRef covers the button itself; menuRef covers the portal-ed
  // dropdown. Both are checked on outside-click since the dropdown no
  // longer lives inside the wrapper in the DOM tree.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // FIX: the dropdown used to be `position: absolute` inside the
  // sidebar, which has `overflow: hidden` + a permanent `transform`
  // (for the collapse/slide animation). A transformed ancestor becomes
  // the containing block for fixed-position children too, so the menu
  // was always trapped inside the sidebar's own box — it only looked
  // fine on wide screens because there happened to be enough room in
  // that box. Computing the position from the button's real on-screen
  // location and rendering through a portal (further down) escapes the
  // sidebar entirely, so it now works at any screen size.
  function updatePosition() {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    let left = rect.right - MENU_WIDTH;
    left = Math.max(
      MARGIN,
      Math.min(left, window.innerWidth - MENU_WIDTH - MARGIN),
    );
    const bottom = window.innerHeight - rect.top + 8;
    setMenuPos({ left, bottom });
  }

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) updatePosition();
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideButton = wrapperRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      if (!insideButton && !insideMenu) {
        setOpen(false);
      }
    }
    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

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
    <div
      ref={wrapperRef}
      style={{ position: "relative", width: "100%", minWidth: 0 }}
    >
      <button
        ref={btnRef}
        onClick={toggleOpen}
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

      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: menuPos.left,
              bottom: menuPos.bottom,
              width: MENU_WIDTH,
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              zIndex: 200,
              overflow: "hidden",
            }}
          >
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
              onClick={() => {
                setOpen(false);
                handleLogout();
              }}
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
          </div>,
          document.body,
        )}
    </div>
  );
}
