import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mapLink } from "@/lib/time-clock";

/** Shows the housekeeper's live location to the customer while they're clocked in for this visit. */
export function CleanerLocation({ bookingId }: { bookingId: string }) {
  const loc = useQuery({
    queryKey: ["cleaner-location", bookingId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("booking_cleaner_location", { _booking: bookingId });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  if (!loc.data || loc.data.lat == null || loc.data.lng == null) return null;
  return (
    <a href={mapLink(loc.data.lat, loc.data.lng)} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
      <MapPin className="h-4 w-4" />Your housekeeper is on the clock — see where they are
      <span className="ml-auto text-xs font-normal">updated {new Date(loc.data.seen_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
    </a>
  );
}
