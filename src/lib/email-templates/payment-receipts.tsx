import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Props = { name?: string; amount?: string; reference?: string; url?: string; test?: boolean; kind?: string };
function Receipt({ name, amount, reference, url, test, kind = "Cleaning payment" }: Props) {
  return <Html lang="en"><Head /><Preview>{test ? "Test receipt — no real money moved." : `${kind} received: ${amount || "see receipt"}`}</Preview><Body style={main}><Container style={container}>
    <Text style={brand}>HousekeepingBooking.com</Text><Heading>{test ? "Test receipt" : `${kind} received`}</Heading>
    <Text>Hi {name || "there"},</Text><Text>{test ? "This is a test email. It does not confirm any real payment." : `Your ${kind.toLowerCase()} has been confirmed through PayPal.`}</Text>
    <Text><strong>Amount:</strong> {amount || "See payment history"}<br /><strong>PayPal reference:</strong> {reference || "See payment history"}</Text>
    <Button href={url || "https://housekeepingbooking.com/booking-history"} style={button}>View receipt</Button>
  </Container></Body></Html>;
}
const entry = (kind: string, displayName: string): TemplateEntry => ({
  component: (props: Props) => <Receipt {...props} kind={kind} />,
  subject: (data) => `${data['test'] ? "Test receipt" : `${kind} received`} | HousekeepingBooking.com`,
  displayName,
  previewData: { name: "Example customer", amount: "$95.00", reference: "Example receipt" },
});
export const customerPaymentReceipt = entry("Cleaning payment", "Customer payment receipt");
export const customerTipReceipt = entry("Tip payment", "Customer tip receipt");
export const cleanerPayoutReceipt = entry("Cleaning earnings", "Cleaner earnings delivered");
export const cleanerTipPayoutReceipt = entry("Tip earnings", "Cleaner tip delivered");
const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#183b35" };
const container = { padding: "32px 24px", maxWidth: "560px" };
const brand = { fontWeight: "bold", color: "#00594c" };
const button = { backgroundColor: "#00594c", color: "#ffffff", padding: "12px 20px", borderRadius: "6px" };