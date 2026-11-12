import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { BookingCard, type BookingRow } from "@/components/BookingCard";
import { AppointmentWork } from "@/components/AppointmentWork";
import { AppointmentClock } from "@/components/AppointmentClock";
import { AppointmentNotes } from "@/components/AppointmentNotes";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { earningsCents } from "@/lib/cleaner-work";
import { SERVICE_MINUTES, ROOM_MINUTES } from "@/lib/pricing";
const appointmentOptions = (id: string, userId: string) => queryOptions({ queryKey: ["cleaner-appointment", id, userId], queryFn: async () => {
 const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", id).eq("cleaner_id", userId).maybeSingle();
 if (error || !booking) throw new Error("This appointment is not assigned to you.");
 const { data: settings, error: rateError } = await supabase.from("cleaner_settings").select("hourly_rate_cents").eq("user_id", userId).maybeSingle();
 if (rateError) throw rateError;
 return { booking: booking as BookingRow, rate: settings?.hourly_rate_cents ?? 0 };
}, refetchInterval: 15000 });
export const Route = createFileRoute("/_authenticated/appointment/$id")({ loader: async ({ context, params }) => {
 const { data, error } = await supabase.auth.getUser(); if (error || !data.user) throw new Error("Sign in required.");
 await context.queryClient.ensureQueryData(appointmentOptions(params.id, data.user.id)); return { userId: data.user.id };
}, head: () => ({ meta: [{ title: "Client Appointment | HousekeepingBooking.com" }, { name: "description", content: "Manage your assigned cleaning appointment, room checklist, notes and earnings." }, { property: "og:title", content: "Client Appointment | HousekeepingBooking.com" }, { property: "og:description", content: "Your assigned appointment work and time clock." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), errorComponent: () => <div><AppHeader /><main className="p-6"><h1 className="text-xl font-bold">Appointment unavailable</h1><Button asChild className="mt-4"><Link to="/cleaner">Back to my jobs</Link></Button></main></div>, component: AppointmentPage });
function AppointmentPage() {
 const { userId } = Route.useLoaderData(); const { id } = Route.useParams(); const { data: { booking, rate } } = useSuspenseQuery(appointmentOptions(id, userId));
 const minutes = (SERVICE_MINUTES[booking.service] ?? 120) + Math.max(0, booking.bedrooms - 2) * ROOM_MINUTES + Math.max(0, booking.bathrooms - 1) * ROOM_MINUTES;
 return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-4xl px-4 py-8 sm:px-6"><Button asChild variant="outline"><Link to="/cleaner"><ArrowLeft />My jobs</Link></Button><h1 className="mt-6 break-words text-3xl font-bold">{booking.customer_name}’s appointment</h1><div className="mt-5"><BookingCard b={booking} showCustomer cleanerPayment /></div><section className="py-6"><h2 className="text-xl font-bold">Your job earnings</h2><p className="mt-2 text-3xl font-bold text-primary">${(earningsCents(minutes, rate) / 100).toFixed(2)} estimated</p><p className="mt-2 text-sm text-muted-foreground">${(rate / 100).toFixed(2)}/hour · final earnings use submitted hours, separate from customer charges and tips.</p></section><AppointmentClock bookingId={id} userId={userId} active={booking.status === "confirmed"} /><AppointmentWork booking={booking} userId={userId} rate={rate} /><AppointmentNotes booking={booking} /></main></div>;
}
