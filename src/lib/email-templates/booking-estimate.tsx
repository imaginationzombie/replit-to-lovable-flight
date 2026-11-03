import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
type Props = { name?: string; service?: string; level?: string; date?: string; time?: string; address?: string; frequency?: string; home?: string; addOns?: string; amount?: string; url?: string };
function BookingEstimate(p: Props) {
  return <Html lang="en"><Head /><Preview>Your requested cleaning estimate from HousekeepingBooking.com.</Preview>
    <Body style={{ backgroundColor: "#ffffff", color: "#183b35", fontFamily: "Arial, sans-serif" }}><Container style={{ padding: "32px 24px", maxWidth: "560px" }}>
      <Text style={{ fontWeight: "bold", color: "#00594c" }}>HousekeepingBooking.com</Text><Heading>Your cleaning estimate</Heading>
      <Text>Hi {p.name || "there"},</Text><Text>Here is the estimate you requested during your call.</Text>
      <Text><strong>Estimated price per visit:</strong> {p.amount || "See your estimate"}<br /><strong>Service:</strong> {p.service}<br /><strong>Cleaning level:</strong> {p.level}<br /><strong>Home:</strong> {p.home}<br /><strong>Frequency:</strong> {p.frequency}<br /><strong>Requested date:</strong> {p.date}<br /><strong>Arrival window:</strong> {p.time}<br /><strong>Address:</strong> {p.address}</Text>
      {p.addOns && <Text><strong>Add-ons:</strong> {p.addOns}</Text>}
      <Text>This is an estimate, not a confirmed appointment. Review your details and approve your PayPal payment method to finish booking. Nothing is charged upfront; payment is collected after each cleaning.</Text>
      <Button href={p.url || "https://housekeepingbooking.com"} style={{ backgroundColor: "#00594c", color: "#ffffff", padding: "12px 20px", borderRadius: "6px" }}>Review estimate & book</Button>
    </Container></Body></Html>;
}
export const template = { component: BookingEstimate, subject: "Your requested cleaning estimate | HousekeepingBooking.com", displayName: "Phone booking estimate", previewData: { name: "Customer", service: "Standard Housekeeping", level: "Light", amount: "$95.00", date: "November 10, 2026", time: "Morning (8am–12pm)", address: "Your cleaning address", frequency: "One-time", home: "2 bedrooms / 1 bathroom" } } satisfies TemplateEntry;