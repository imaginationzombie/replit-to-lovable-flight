import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, isAdmin, isCleaner, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const link = "text-sm font-semibold text-muted-foreground hover:text-primary";
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <a href="/index.html" aria-label="HousekeepingBooking.com home"><img src="/logo.png" alt="HousekeepingBooking.com" className="h-10 w-auto" width={628} height={160} /></a>
        <nav className="flex flex-wrap items-center gap-4">
          <Link to="/booking-assistant" className={link}>AI Assistant</Link>
          <Link to="/book" className={link}>Book</Link>
          <Link to="/apply" className={link}>Join our team</Link>
          {!loading && user && (
            <>
              <Link to="/account" className={link}>My account</Link>
              <Link to="/booking-status" className={link}>Booking status</Link>
              <Link to="/booking-history" className={link}>Payments & history</Link>
              <Link to="/messages" className={link}>Messages</Link>
              {isCleaner && <Link to="/my-page" className={link}>My public page</Link>}
              {isCleaner && <Link to="/cleaner" className={link}>My jobs</Link>}
              {isCleaner && <Link to="/cleaner-schedule" className={link}>My schedule</Link>}
              {isCleaner && <Link to="/waiting-list" className={link}>Waiting list</Link>}
              {isCleaner && <Link to="/timesheets" className={link}>Timesheets & payments</Link>}
              {isAdmin && <Link to="/admin" className={link}>Admin</Link>}
              <Button onClick={signOut} variant="outline" size="sm">Sign out</Button>
            </>
          )}
          {!loading && !user && (
            <Link to="/auth" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
