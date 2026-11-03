import { useEffect, useState } from "react";
import { format, parseISO, startOfDay } from "date-fns";
import { Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { TIME_WINDOWS } from "@/lib/pricing";
import { dateKey } from "@/lib/scheduling";

type Props = {
  date: string;
  timeWindow: string;
  onChange: (date: string, timeWindow: string) => void;
};

export function AppointmentCalendar({ date, timeWindow, onChange }: Props) {
  const [today, setToday] = useState<Date>();
  useEffect(() => { setToday(startOfDay(new Date())); }, []);
  const selected = date ? parseISO(date) : undefined;

  return (
    <section aria-labelledby="appointment-heading" className="min-w-0 border-y border-border py-5">
      <h2 id="appointment-heading" className="text-lg font-bold text-foreground">Appointment</h2>
      <div className="mt-3 grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {today ? <Calendar
            mode="single"
            required
            selected={selected}
            defaultMonth={selected ?? today}
            startMonth={today}
            disabled={{ before: today }}
            onSelect={(day) => { if (day) onChange(dateKey(day), timeWindow); }}
            className="w-full p-0 [--cell-size:1.75rem]"
            classNames={{ root: "w-full", months: "relative flex w-full flex-col", day: "relative min-w-0 flex-1 p-0 text-center" }}
          /> : <div className="h-72 animate-pulse bg-muted" aria-label="Loading appointment calendar" />}
        </div>
        <fieldset className="min-w-0">
          <legend className="mb-3 text-sm font-semibold text-foreground">Arrival window</legend>
          <div className="grid gap-2">
            {TIME_WINDOWS.map((window) => (
              <Button
                key={window}
                type="button"
                variant={timeWindow === window ? "default" : "outline"}
                aria-pressed={timeWindow === window}
                onClick={() => onChange(date, window)}
                className="h-auto min-h-11 w-full justify-start whitespace-normal px-3 py-3 text-left"
              >
                <Clock aria-hidden="true" />
                <span>{window}</span>
              </Button>
            ))}
          </div>
        </fieldset>
      </div>
      <p aria-live="polite" className="mt-4 break-words text-sm font-semibold text-primary">
        {selected ? `${format(selected, "EEEE, MMMM d, yyyy")} · ${timeWindow}` : "No appointment date selected"}
      </p>
    </section>
  );
}