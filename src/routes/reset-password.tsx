import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password | HousekeepingBooking.com" },
      { name: "description", content: "Choose a new password for your account." },
      { property: "og:title", content: "Set a new password | HousekeepingBooking.com" },
      { property: "og:description", content: "Choose a new password for your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(error.message);
    navigate({ to: "/account" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <h1 className="text-2xl font-extrabold text-foreground">Set a new password</h1>
        <input required type="password" minLength={8} placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground" />
        {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">Save password</button>
      </form>
    </div>
  );
}
