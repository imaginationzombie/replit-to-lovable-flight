import { createFileRoute, useNavigate, useHydrated } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { safeAuthDestination as safeNext } from "@/lib/auth-destination";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ next: z.string().optional() }),
  head: ({ match }) => ({
    meta: [
      { title: match.search.next === "/cleaner" ? "Housekeeper Sign In | HousekeepingBooking.com" : "Sign in | HousekeepingBooking.com" },
      { name: "description", content: "Sign in or create your HousekeepingBooking.com account." },
      { property: "og:title", content: "Sign in | HousekeepingBooking.com" },
      { property: "og:description", content: "Sign in or create your HousekeepingBooking.com account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(next === "/apply" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const dest = safeNext(next);
  const housekeeperLogin = dest === "/cleaner";

  useEffect(() => {
    if (next) sessionStorage.setItem("hkb-auth-next", dest);
    const go = () => {
      const target = sessionStorage.getItem("hkb-auth-next") ?? dest;
      sessionStorage.removeItem("hkb-auth-next");
      if (safeNext(target) === "/cleaner") navigate({ to: "/cleaner", replace: true });
      else navigate({ to: safeNext(target) as "/account", replace: true });
    };
    supabase.auth.getUser().then(({ data }) => data.user && go());
    const { data: sub } = supabase.auth.onAuthStateChange((e) => e === "SIGNED_IN" && go());
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(dest)}`, data: { full_name: name } },
        });
        if (error) throw error;
        setMsg({ type: "ok", text: "Check your email to confirm your account, then sign in." });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMsg({ type: "ok", text: "If that email has an account, a reset link is on its way." });
      }
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    sessionStorage.setItem("hkb-auth-next", dest);
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setMsg({ type: "err", text: r.error.message ?? "Sign-in failed." });
  }

  const field = "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <div className="min-w-0 py-4">
          <h1 className="text-2xl font-extrabold text-foreground">
            {mode === "signin" ? housekeeperLogin ? "Housekeeper sign in" : "Welcome back" : mode === "signup" ? dest === "/apply" || housekeeperLogin ? "Create your housekeeper account" : "Create your account" : "Reset your password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{housekeeperLogin ? "Your account · your appointments, earnings and schedule." : dest === "/apply" ? "Housekeeper applications · create an account or sign in to apply." : "For customers, cleaners and staff."}</p>
          {housekeeperLogin && mode === "signup" && <p className="mt-3 text-sm text-muted-foreground">New housekeepers complete an application before staff access is approved.</p>}

          {mode !== "forgot" && (
            <div className="mt-6 space-y-3">
              <Button type="button" variant="outline" onClick={() => social("google")} className="w-full">
                Continue with Google
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => social("lovable")}>Continue with Lovable</Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
            </div>
          )}

          <form onSubmit={submit} className="mt-4 space-y-4">
            {mode === "signup" && (
              <label className="block text-sm font-semibold text-foreground">Full name
                <input required maxLength={100} className={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
            )}
            <label className="block text-sm font-semibold text-foreground">Email
                <input required type="email" autoComplete="username" maxLength={255} className={field} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            {mode !== "forgot" && (
              <label className="block text-sm font-semibold text-foreground">Password
                <input required type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} className={field} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            )}
            {msg && <p role="alert" className={`rounded-lg p-3 text-sm ${msg.type === "ok" ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
            <Button disabled={busy || !hydrated} className="w-full" type="submit">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
            {mode === "signin" ? (
              <>
                <Button variant="link" className="px-0" onClick={() => { setMode("signup"); setMsg(null); }}>Create an account</Button>
                <Button variant="link" className="px-0" onClick={() => { setMode("forgot"); setMsg(null); }}>Forgot password?</Button>
              </>
            ) : (
              <Button variant="link" className="px-0" onClick={() => { setMode("signin"); setMsg(null); }}>{mode === "signup" ? "Already have an account? Sign in" : "Back to sign in"}</Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
