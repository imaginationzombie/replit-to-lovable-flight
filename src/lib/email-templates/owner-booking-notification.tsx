import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Props = { name?: string; email?: string; phone?: string; service?: string; date?: string; time?: string; address?: string; frequency?: string; cleaner?: string; amount?: string; test?: boolean };
function OwnerBookingNotification({ name, email, phone, service, date, time, address, frequency, cleaner, amount, test }: Props) {
  return <Html lang="en"><Head /><Preview>{test ? "Test booking alert — no appointment was created." : `${name || "A customer"} booked a cleaning appointment.`}</Preview><Body style={main}><Container style={container}>
    <Text style={brand}>HousekeepingBooking.com</Text>
    <Heading>{test ? "Test booking alert" : "New cleaning appointment"}</Heading>
    {test && <Text>This is a test of your booking alerts. No appointment was created and no payment was made.</Text>}
    <Text><strong>Customer:</strong> {name || "See staff dashboard"}<br /><strong>Email:</strong> {email || "Not provided"}<br /><strong>Phone:</strong> {phone || "Not provided"}</Text>
    <Text><strong>Service:</strong> {service || "Housekeeping"}<br /><strong>Date:</strong> {date || "See staff dashboard"}<br /><strong>Arrival:</strong> {time || "See staff dashboard"}<br /><strong>Address:</strong> {address || "See staff dashboard"}<br /><strong>Frequency:</strong> {frequency || "One-time"}<br /><strong>Cleaner:</strong> {cleaner || "Assignment pending"}<br /><strong>Visit total:</strong> {amount || "See staff dashboard"}</Text>
    <Text>This alert confirms the appointment, not a customer payment or a cleaner payout.</Text>
    <Button href="https://housekeepingbooking.com/staff-dashboard" style={button}>View staff dashboard</Button>
  </Container></Body></Html>;
}
export const template = {
  component: OwnerBookingNotification,
  subject: (data: Record<string, unknown>) => `${data['test'] ? "Test booking alert" : "New cleaning appointment"} | HousekeepingBooking.com`,
  displayName: "Owner booking alert",
  to: "chelsealawhead88@gmail.com",
  previewData: { name: "Example customer", service: "Standard Housekeeping", date: "Monday, November 9, 2026", time: "Morning (8am–12pm)", cleaner: "Assignment pending", amount: "$95.00" },
} satisfies TemplateEntry;
const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#183b35" };
const container = { padding: "32px 24px", maxWidth: "560px" };
const brand = { fontWeight: "bold", color: "#00594c" };
const button = { backgroundColor: "#00594c", color: "#ffffff", padding: "12px 20px", borderRadius: "6px" };