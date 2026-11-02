import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Props = { name?: string; service?: string; date?: string; time?: string; address?: string; frequency?: string; cleaner?: string; url?: string };
function BookingConfirmation({ name, service, date, time, address, frequency, cleaner, url }: Props) {
  return <Html lang="en"><Head /><Preview>Your cleaning appointment is confirmed{date ? ` for ${date}` : ""}.</Preview><Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#183b35" }}><Container style={{ padding: "32px 24px", maxWidth: "560px" }}>
    <Text style={{ fontWeight: "bold", color: "#00594c" }}>HousekeepingBooking.com</Text>
    <Heading>Your cleaning is confirmed</Heading>
    <Text>Hi {name || "there"},</Text><Text>Here are your appointment details:</Text>
    <Text><strong>Service:</strong> {service || "Housekeeping"}<br /><strong>Date:</strong> {date || "See your booking"}<br /><strong>Arrival:</strong> {time || "See your booking"}<br /><strong>Address:</strong> {address || "See your booking"}<br /><strong>Frequency:</strong> {frequency || "One-time"}<br /><strong>Cleaner:</strong> {cleaner || "Assignment pending"}</Text>
    <Text>No upfront charge. Payment is collected after each cleaning.</Text>
    <Button href={url || "https://housekeepingbooking.com/booking-status"} style={{ backgroundColor: "#00594c", color: "#ffffff", padding: "12px 20px", borderRadius: "6px" }}>View booking</Button>
  </Container></Body></Html>;
}
export const template = {
  component: BookingConfirmation,
  subject: "Your cleaning is confirmed | HousekeepingBooking.com",
  displayName: "Booking confirmation",
  previewData: { name: "Customer", service: "Standard Housekeeping", date: "Monday, November 9, 2026", time: "Morning (8am–12pm)", address: "Your home address", frequency: "One-time", cleaner: "Assignment pending" },
} satisfies TemplateEntry;