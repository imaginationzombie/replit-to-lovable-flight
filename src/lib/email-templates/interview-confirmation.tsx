import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Props = { name?: string; date?: string; time?: string; phone?: string };
function InterviewConfirmation({ name, date, time, phone }: Props) {
  return <Html lang="en"><Head /><Preview>{`Your phone interview is set for ${date || "your chosen date"} at ${time || "your chosen time"}.`}</Preview><Body style={main}><Container style={container}>
    <Text style={brand}>HousekeepingBooking.com</Text>
    <Heading>Your phone interview is set</Heading>
    <Text>{name ? `Hi ${name},` : "Hi there,"}</Text>
    <Text>Thanks for applying to join our housekeepers. We'll call you for your interview at:</Text>
    <Text><strong>Date:</strong> {date || "See your application page"}<br /><strong>Time:</strong> {time || "See your application page"} (Eastern Time)<br /><strong>We'll call:</strong> {phone || "the phone number on your application"}</Text>
    <Text>Need a different time? You can change it on your application page.</Text>
    <Button href="https://housekeepingbooking.com/apply" style={button}>View my application</Button>
  </Container></Body></Html>;
}
export const template = {
  component: InterviewConfirmation,
  subject: (data: Record<string, unknown>) => `Phone interview set for ${data["date"] ?? "your chosen date"} | HousekeepingBooking.com`,
  displayName: "Interview confirmation",
  previewData: { name: "Jamie", date: "Monday, November 9, 2026", time: "12pm", phone: "(717) 555-0100" },
} satisfies TemplateEntry;
const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#183b35" };
const container = { padding: "32px 24px", maxWidth: "560px" };
const brand = { fontWeight: "bold", color: "#00594c" };
const button = { backgroundColor: "#00594c", color: "#ffffff", padding: "12px 20px", borderRadius: "6px" };
