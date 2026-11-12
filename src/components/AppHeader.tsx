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
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] items-center gap-3 px-4 py-4 sm:flex sm:flex-wrap sm:justify-between sm:px-6">
        <a href="/index.html" aria-label="HousekeepingBooking.com home" className="min-w-0 shrink-0"><img src="/logo.png" alt="HousekeepingBooking.com" className="h-auto w-60 max-w-full sm:h-10 sm:w-auto" width={628} height={160} /></a>
        <nav aria-label="Account navigation" className="grid min-w-0 max-w-full grid-cols-2 items-center gap-x-3 gap-y-3 sm:flex sm:flex-wrap sm:gap-4 [&>*]:min-w-0 [&>*]:break-words">
          <Link to="/booking-assistant" className={link}>AI Assistant</Link>
          <Link to="/book" className={link}>Book</Link>
          <Link to="/office-quote" className={link}>Office quote</Link>
          <Link to="/moving-quote" className={link}>Moving quote</Link>
          <Link to="/gift-certificates" className={link}>Gift certificates</Link>
          {user ? <Link to="/apply" className={link}>{isCleaner ? "Join our team" : "Application & hiring"}</Link> : <Link to="/auth" search={{ next: "/apply" }} className={link}>Apply as a housekeeper</Link>}
          {!loading && user && (
            <>
              <Link to="/account" className={link}>My account</Link>
              <Link to="/booking-status" className={link}>Booking status</Link>
              <Link to="/booking-history" className={link}>Payments & history</Link>
              <Link to="/disputes" className={link}>Disputes</Link>
              <Link to="/messages" className={link}>Messages</Link>
              {isCleaner && <Link to="/my-page" className={link}>Edit my page</Link>}
              {isCleaner && <Link to="/cleaner" className={link}>My jobs</Link>}
              {isCleaner && <Link to="/cleaner-schedule" className={link}>My schedule</Link>}
              {isCleaner && <Link to="/availability" className={link}>Appointment slots</Link>}
              {isCleaner && <Link to="/waiting-list" className={link}>Waiting list</Link>}
              {isCleaner && <Link to="/timesheets" className={link}>Timesheets & payments</Link>}
              {(isCleaner || isAdmin) && <Link to="/time-clock" className={link}>Time clock</Link>}
              {(isCleaner || isAdmin) && <Link to="/phone-booking" className={link}>Phone bookings</Link>}
              {(isCleaner || isAdmin) && <Link to="/staff-dashboard" search={{ from: "", to: "", cleaner: "all", view: "all" }} className={link}>Staff dashboard</Link>}
              {isAdmin && <Link to="/admin" className={link}>Admin</Link>}
              {isAdmin && <Link to="/housekeeper-income" className={link}>Housekeeper income</Link>}
              {isAdmin && <Link to="/admin-paypal" search={{ view: "all" }} className={link}>PayPal</Link>}
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
