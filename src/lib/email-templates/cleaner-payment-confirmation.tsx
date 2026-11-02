import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Props = { name?: string; service?: string; date?: string; amount?: string; reference?: string; test?: boolean };
function CleanerPaymentConfirmation({ name, service, date, amount, reference, test }: Props) {
  return <Html lang="en"><Head /><Preview>{test ? "Test payment" : "Customer payment received"} for your cleaning appointment.</Preview>
    <Body style={main}><Container style={container}>
      <Text style={brand}>HousekeepingBooking.com</Text>
      <Heading>{test ? "Test customer payment recorded" : "Customer payment received"}</Heading>
      <Text>Hi {name || "there"},</Text>
      <Text>{test ? "A sandbox payment was recorded. No real money was collected." : "The customer has paid for your assigned cleaning."}</Text>
      <Text><strong>Service:</strong> {service || "Housekeeping"}<br /><strong>Visit date:</strong> {date || "See your jobs"}<br /><strong>Customer payment:</strong> {amount || "See your jobs"}<br /><strong>Payment reference:</strong> {reference || "See your jobs"}</Text>
      <Text>This is the customer’s cleaning payment, not your earnings or a settled transfer to you. Your earnings and PayPal transfer status are shown separately in your portal.</Text>
      <Button href="https://housekeepingbooking.com/cleaner" style={button}>View my jobs</Button>
    </Container></Body>
  </Html>;
}
const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#183b35" };
const container = { padding: "32px 24px", maxWidth: "560px" };
const brand = { fontWeight: "bold", color: "#00594c" };
const button = { backgroundColor: "#00594c", color: "#ffffff", padding: "12px 20px", borderRadius: "6px" };
export const template = {
  component: CleanerPaymentConfirmation,
  subject: (data) => `${data['test'] ? "Test customer payment" : "Customer payment received"} | HousekeepingBooking.com`,
  displayName: "Cleaner customer-payment confirmation",
  previewData: { name: "Housekeeper", service: "Standard Housekeeping", date: "Monday, November 9, 2026", amount: "$95.00", reference: "Payment receipt" },
} satisfies TemplateEntry;