import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter, useNavigate } from "react-router-dom";
import App from "./App";
import "./index.css";

const publishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  "";
const clerkConfigured = Boolean(publishableKey && publishableKey !== "");

function ClerkProviderWithRoutes({
  publishableKey,
  children,
}: {
  publishableKey: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

function MissingKeyScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Configuration error</h1>
        <p style={{ color: "#666", maxWidth: 420 }}>
          VITE_CLERK_PUBLISHABLE_KEY is missing. Add it in Vercel → Settings →
          Environment Variables, then redeploy.
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      {clerkConfigured ? (
        <ClerkProviderWithRoutes publishableKey={publishableKey}>
          <App />
        </ClerkProviderWithRoutes>
      ) : (
        <MissingKeyScreen />
      )}
    </BrowserRouter>
  </React.StrictMode>,
);
