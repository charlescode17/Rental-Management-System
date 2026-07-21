import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to figma-make-app
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage your tenants, track payments, and stay on top of your rentals —
          all in one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href="/sign-in"
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
          >
            Log In
          </Link>
          <Link
            href="/sign-up"
            className="px-6 py-3 rounded-lg border border-border font-medium hover:bg-muted transition"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
