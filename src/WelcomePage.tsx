import { Link } from "react-router-dom";

const features = [
  {
    title: "Tenant Management",
    desc: "Register tenants by floor and room, with rent amount and due date tracked per unit.",
  },
  {
    title: "Payment Tracking",
    desc: "Record payments in seconds — floor, room, and amount auto-fill, you just confirm months paid.",
  },
  {
    title: "Reminders & Follow-ups",
    desc: "Get notified automatically when rent is unpaid or overdue, so nothing slips through.",
  },
  {
    title: "Reports & History",
    desc: "Monthly, annual, or custom-range reports — per tenant or across your whole property.",
  },
];

const steps = [
  { step: "1", label: "Add your building and rooms" },
  { step: "2", label: "Register your tenants" },
  { step: "3", label: "Track payments and reminders automatically" },
];

export default function WelcomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg)",
        color: "var(--text)",
      }}
    >
      {/* NAV */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 18 }}>Rent Manager</span>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            to="/sign-in"
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              textDecoration: "none",
              fontSize: "clamp(13px, 2vw, 14px)",
              fontWeight: 600,
            }}
          >
            Log In
          </Link>
          <Link
            to="/sign-up"
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--accent)",
              color: "var(--accent-fg)",
              textDecoration: "none",
              fontSize: "clamp(13px, 2vw, 14px)",
              fontWeight: 600,
            }}
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section
        style={{
          textAlign: "center",
          padding: "clamp(60px, 10vw, 100px) 16px clamp(50px, 8vw, 80px)",
          maxWidth: 780,
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(28px, 6vw, 44px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: 20,
            lineHeight: 1.15,
          }}
        >
          Run your rental property without the spreadsheet chaos
        </h1>
        <p
          style={{
            fontSize: "clamp(16px, 4vw, 18px)",
            lineHeight: 1.6,
            color: "var(--text-muted)",
            marginBottom: 36,
          }}
        >
          Track every tenant, every floor, every payment — and know exactly
          who's paid, who's late, and who's reliable, all in one dashboard.
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/sign-up"
            style={{
              padding: "12px 20px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--accent)",
              color: "var(--accent-fg)",
              fontWeight: 700,
              fontSize: "clamp(14px, 2vw, 16px)",
              textDecoration: "none",
            }}
          >
            Get Started
          </Link>
          <Link
            to="/sign-in"
            style={{
              padding: "12px 20px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--text)",
              fontWeight: 700,
              fontSize: "clamp(14px, 2vw, 16px)",
              textDecoration: "none",
            }}
          >
            Log In
          </Link>
        </div>
      </section>

      {/* FEATURES */}
      <section
        style={{ padding: "20px 24px 80px", maxWidth: 1000, margin: "0 auto" }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 40,
          }}
        >
          Everything you need to manage rentals
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                padding: "24px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                backgroundColor: "var(--surface)",
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "var(--text-muted)",
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        style={{
          padding: "20px 24px 90px",
          maxWidth: 800,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 36 }}>
          How it works
        </h2>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 28,
            flexWrap: "wrap",
          }}
        >
          {steps.map((s) => (
            <div key={s.step} style={{ maxWidth: 200 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-fg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  margin: "0 auto 12px",
                }}
              >
                {s.step}
              </div>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "24px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        © {new Date().getFullYear()} Rent Manager. All rights reserved.
      </footer>
    </main>
  );
}
