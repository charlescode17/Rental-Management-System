import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <SignUp routing="path" />
    </main>
  );
}
