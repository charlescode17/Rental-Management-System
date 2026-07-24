import { Link } from "react-router-dom";
import {
  Building2,
  Wallet,
  BellRing,
  FileBarChart,
  ArrowRight,
} from "lucide-react";

const WP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Newsreader:ital@1&display=swap');

.wp {
  --wp-bg: #F5F6F0;
  --wp-ink: #182420;
  --wp-muted: #5E6B63;
  --wp-line: #DEDFD3;
  --wp-stamp: #9C3B2E;
  --wp-surface: var(--surface);
  min-height: 100vh;
  background: var(--wp-bg);
  color: var(--wp-ink);
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
.dark .wp {
  --wp-bg: var(--bg);
  --wp-ink: var(--text);
  --wp-muted: var(--text-muted);
  --wp-line: var(--border);
}

.wp-nav {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px;
  background: color-mix(in srgb, var(--wp-bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--wp-line);
  flex-wrap: wrap; gap: 12px;
}
.wp-logo { display: flex; align-items: center; gap: 10px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; }
.wp-logo-mark { width: 32px; height: 32px; border-radius: 8px; background: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.wp-nav-links { display: flex; gap: 10px; }
.wp-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; border-radius: 8px; font-weight: 600; font-size: 13.5px;
  text-decoration: none; transition: transform .15s ease, box-shadow .15s ease, background-color .15s ease;
  border: 1px solid transparent;
}
.wp-btn-ghost { color: var(--wp-ink); border-color: var(--wp-line); background: transparent; }
.wp-btn-ghost:hover { background: color-mix(in srgb, var(--wp-ink) 6%, transparent); }
.wp-btn-primary { background: var(--accent); color: var(--accent-fg); }
.wp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 20px color-mix(in srgb, var(--accent) 35%, transparent); }

.wp-hero {
  display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items: center;
  padding: 88px 24px 96px; max-width: 1160px; margin: 0 auto;
}
@media (max-width: 900px) { .wp-hero { grid-template-columns: 1fr; padding: 56px 20px 64px; gap: 40px; } }

.wp-eyebrow {
  font-family: 'Newsreader', serif; font-style: italic; font-size: 15px;
  color: var(--wp-stamp); margin: 0 0 16px;
}
.wp-h1 {
  font-family: 'Space Grotesk', sans-serif; font-weight: 700;
  font-size: clamp(32px, 4.6vw, 52px); line-height: 1.06; letter-spacing: -0.02em;
  margin: 0 0 20px; color: var(--wp-ink);
}
.wp-sub { font-size: 16.5px; line-height: 1.65; color: var(--wp-muted); max-width: 460px; margin: 0 0 28px; }
.wp-cta-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
.wp-cta-note { font-size: 12.5px; color: var(--wp-muted); }

.wp-ledger {
  background: var(--wp-surface);
  border: 1px solid var(--wp-line);
  border-radius: 16px;
  box-shadow: 0 24px 60px -20px rgba(20, 30, 25, 0.18);
  padding: 20px;
  position: relative;
  overflow: hidden;
}
.wp-ledger-head {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed var(--wp-line);
}
.wp-ledger-title { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--wp-muted); }
.wp-ledger-tag { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--wp-muted); }

.wp-row {
  display: grid; grid-template-columns: 56px 1fr auto auto; gap: 10px; align-items: center;
  padding: 10px 4px; border-bottom: 1px solid color-mix(in srgb, var(--wp-line) 70%, transparent);
  opacity: 0; transform: translateY(6px);
  animation: wpRowIn 0.5s ease forwards;
}
.wp-row:last-child { border-bottom: none; }
.wp-row:nth-child(1) { animation-delay: 0.15s; }
.wp-row:nth-child(2) { animation-delay: 0.3s; }
.wp-row:nth-child(3) { animation-delay: 0.45s; }
.wp-row:nth-child(4) { animation-delay: 0.6s; }
@keyframes wpRowIn { to { opacity: 1; transform: translateY(0); } }

.wp-row-room { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--wp-muted); }
.wp-row-tenant { font-size: 13px; font-weight: 500; color: var(--wp-ink); min-width: 0; }
.wp-row-tenant span { display: block; font-size: 11px; color: var(--wp-muted); font-weight: 400; }
.wp-row-amount { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; color: var(--wp-ink); text-align: right; white-space: nowrap; }
.wp-pill { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 99px; font-size: 10.5px; font-weight: 600; white-space: nowrap; }
.wp-pill-paid { background: var(--status-paid-bg); color: var(--status-paid); }
.wp-pill-due { background: var(--status-due-bg); color: var(--status-due); }
.wp-pill-overdue { background: var(--status-overdue-bg); color: var(--status-overdue); }

.wp-ledger-foot {
  margin-top: 8px; padding-top: 12px; border-top: 1px dashed var(--wp-line);
  display: flex; justify-content: space-between; align-items: baseline;
}
.wp-ledger-total { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 15px; }
.wp-ledger-total-label { font-size: 11px; color: var(--wp-muted); text-transform: uppercase; letter-spacing: 0.06em; }

.wp-stamp {
  position: absolute; top: 30px; right: 26px;
  width: 92px; height: 92px; border-radius: 50%;
  border: 3px solid var(--wp-stamp); color: var(--wp-stamp);
  display: flex; align-items: center; justify-content: center; flex-direction: column;
  font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 0.05em;
  transform: rotate(-10deg) scale(2.4); opacity: 0;
  animation: wpStampIn 0.5s cubic-bezier(.2,1.4,.4,1) forwards;
  animation-delay: 0.95s;
  pointer-events: none;
  mix-blend-mode: multiply;
}
.wp-stamp::before {
  content: ""; position: absolute; inset: 6px; border: 1px solid var(--wp-stamp); border-radius: 50%;
}
@keyframes wpStampIn { to { opacity: 0.88; transform: rotate(-10deg) scale(1); } }

@media (prefers-reduced-motion: reduce) {
  .wp-row { animation: none; opacity: 1; transform: none; }
  .wp-stamp { animation: none; opacity: 0.88; transform: rotate(-10deg) scale(1); }
}
@media (max-width: 480px) {
  .wp-stamp { width: 72px; height: 72px; font-size: 11px; top: 22px; right: 18px; }
}

.wp-section { padding: 72px 24px; max-width: 1160px; margin: 0 auto; }
.wp-section-head { text-align: center; max-width: 560px; margin: 0 auto 44px; }
.wp-section-eyebrow { font-family: 'Newsreader', serif; font-style: italic; color: var(--wp-stamp); font-size: 14px; margin-bottom: 8px; }
.wp-section-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: clamp(24px, 3vw, 32px); letter-spacing: -0.01em; margin: 0 0 10px; }
.wp-section-sub { color: var(--wp-muted); font-size: 15px; line-height: 1.6; }

.wp-features { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 900px) { .wp-features { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .wp-features { grid-template-columns: 1fr; } }
.wp-feature {
  padding: 24px 20px; border: 1px solid var(--wp-line); border-radius: 14px;
  background: var(--wp-surface);
  transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
}
.wp-feature:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -12px rgba(20,30,25,0.16); border-color: color-mix(in srgb, var(--accent) 35%, var(--wp-line)); }
.wp-feature-icon {
  width: 38px; height: 38px; border-radius: 10px; margin-bottom: 16px;
  background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
}
.wp-feature h3 { font-family: 'Space Grotesk', sans-serif; font-size: 15.5px; font-weight: 600; margin: 0 0 8px; }
.wp-feature p { font-size: 13.5px; line-height: 1.55; color: var(--wp-muted); margin: 0; }

.wp-steps { display: flex; flex-direction: column; max-width: 620px; margin: 0 auto; }
.wp-step { display: flex; gap: 20px; padding: 20px 0; border-bottom: 1px solid var(--wp-line); }
.wp-step:last-child { border-bottom: none; }
.wp-step-no { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; color: var(--wp-stamp); flex-shrink: 0; padding-top: 2px; }
.wp-step-label { font-size: 15.5px; color: var(--wp-ink); font-weight: 500; line-height: 1.5; }

.wp-cta-band {
  margin: 24px; border-radius: 20px; padding: 56px 32px; text-align: center;
  background: color-mix(in srgb, var(--accent) 10%, var(--wp-bg));
  border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--wp-line));
}
.wp-cta-band h2 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: clamp(22px, 3vw, 30px); margin: 0 0 12px; }
.wp-cta-band p { color: var(--wp-muted); margin: 0 0 24px; font-size: 15px; }

.wp-footer { border-top: 1px solid var(--wp-line); padding: 28px 24px; text-align: center; font-size: 13px; color: var(--wp-muted); }

button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;

function WPStyles() {
  return <style>{WP_CSS}</style>;
}

const ledgerRows: Array<{
  room: string;
  tenant: string;
  note: string;
  status: "paid" | "due" | "overdue";
  amount: string;
}> = [
  {
    room: "L1 · 14",
    tenant: "Uwimana M.",
    note: "12 months prepaid",
    status: "paid",
    amount: "70,000",
  },
  {
    room: "L1 · 15",
    tenant: "Habimana J.",
    note: "Due in 3 days",
    status: "due",
    amount: "65,000",
  },
  {
    room: "GR · 02",
    tenant: "Mukamana A.",
    note: "9 days overdue",
    status: "overdue",
    amount: "50,000",
  },
  {
    room: "L2 · 21",
    tenant: "Iradukunda P.",
    note: "Paid on time",
    status: "paid",
    amount: "80,000",
  },
];

const pillLabel: Record<string, string> = {
  paid: "Paid",
  due: "Due soon",
  overdue: "Overdue",
};

function LedgerPreview() {
  return (
    <div className="wp-ledger" aria-hidden="true">
      <div className="wp-ledger-head">
        <span className="wp-ledger-title">July 2026 · Ledger</span>
        <span className="wp-ledger-tag">Kigali</span>
      </div>
      {ledgerRows.map((row) => (
        <div className="wp-row" key={row.room}>
          <span className="wp-row-room">{row.room}</span>
          <span className="wp-row-tenant">
            {row.tenant}
            <span>{row.note}</span>
          </span>
          <span className={`wp-pill wp-pill-${row.status}`}>
            {pillLabel[row.status]}
          </span>
          <span className="wp-row-amount">RWF {row.amount}</span>
        </div>
      ))}
      <div className="wp-ledger-foot">
        <span className="wp-ledger-total-label">Collected this month</span>
        <span className="wp-ledger-total">RWF 265,000</span>
      </div>
      <div className="wp-stamp">PAID</div>
    </div>
  );
}

const features = [
  {
    icon: Building2,
    title: "Rooms & buildings",
    desc: "Register every building, floor, and room — merge two or more rooms under one tenant when they rent extra space.",
  },
  {
    icon: Wallet,
    title: "Payments in seconds",
    desc: "Search a tenant, confirm the months paid, and the amount, due date, and status work themselves out.",
  },
  {
    icon: BellRing,
    title: "Never miss a due date",
    desc: "Overdue and due-soon tenants surface on their own, sorted by how many days behind they are.",
  },
  {
    icon: FileBarChart,
    title: "Reports you can hand over",
    desc: "Pull monthly, annual, or per-tenant reports and export straight to Excel or PDF.",
  },
];

const steps = [
  { no: "01", label: "Add your building and its floors" },
  { no: "02", label: "Register tenants to their rooms" },
  {
    no: "03",
    label:
      "Record payments as they come in — reminders and reports take care of themselves",
  },
];

export default function WelcomePage() {
  return (
    <div className="wp">
      <WPStyles />

      <header className="wp-nav">
        <div className="wp-logo">
          <span className="wp-logo-mark">
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
          </span>
          Rent Manager
        </div>
        <div className="wp-nav-links">
          <Link to="/sign-in" className="wp-btn wp-btn-ghost">
            Log In
          </Link>
          <Link to="/sign-up" className="wp-btn wp-btn-primary">
            Sign Up
          </Link>
        </div>
      </header>

      <section className="wp-hero">
        <div>
          <p className="wp-eyebrow">
            for landlords managing rooms, not headaches
          </p>
          <h1 className="wp-h1">
            Every room. Every tenant.
            <br />
            Every franc, accounted for.
          </h1>
          <p className="wp-sub">
            Rent Manager keeps your buildings, floors, and tenants in one ledger
            — so you always know who's paid, who's late, and what's coming due.
          </p>
          <div className="wp-cta-row">
            <Link to="/sign-up" className="wp-btn wp-btn-primary">
              Get Started <ArrowRight size={15} />
            </Link>
            <Link to="/sign-in" className="wp-btn wp-btn-ghost">
              Log In
            </Link>
          </div>
          <p className="wp-cta-note">Add your first building in minutes.</p>
        </div>
        <LedgerPreview />
      </section>

      <section className="wp-section">
        <div className="wp-section-head">
          <p className="wp-section-eyebrow">what's inside</p>
          <h2 className="wp-section-title">
            Everything you need to manage rentals
          </h2>
          <p className="wp-section-sub">
            No spreadsheets, no notebooks — just one dashboard for every
            building you manage.
          </p>
        </div>
        <div className="wp-features">
          {features.map((f) => {
            const FeatureIcon = f.icon;
            return (
              <div className="wp-feature" key={f.title}>
                <div className="wp-feature-icon">
                  <FeatureIcon size={19} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="wp-section">
        <div className="wp-section-head">
          <p className="wp-section-eyebrow">getting set up</p>
          <h2 className="wp-section-title">How it works</h2>
        </div>
        <div className="wp-steps">
          {steps.map((s) => (
            <div className="wp-step" key={s.no}>
              <span className="wp-step-no">{s.no}</span>
              <span className="wp-step-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="wp-cta-band">
        <h2>Stop tracking rent in a notebook.</h2>
        <p>Set up your buildings and start logging payments today.</p>
        <Link to="/sign-up" className="wp-btn wp-btn-primary">
          Get Started <ArrowRight size={15} />
        </Link>
      </div>

      <footer className="wp-footer">
        © {new Date().getFullYear()} Rent Manager. All rights reserved.
      </footer>
    </div>
  );
}
