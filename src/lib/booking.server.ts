import { quote } from "./pricing";

function paypalBase() {
  return process.env["PAYPAL_ENV"] === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function paypalClientId() {
  const id = process.env["PAYPAL_CLIENT_ID"];
  if (!id) throw new Error("PayPal is not configured yet.");
  return id;
}

async function paypalToken() {
  const id = paypalClientId();
  const secret = process.env["PAYPAL_CLIENT_SECRET"];
  if (!secret) throw new Error("PayPal is not configured yet.");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.error("PayPal auth failed", res.status, await res.text());
    throw new Error("Couldn't connect to PayPal.");
  }
  return ((await res.json()) as { access_token: string }).access_token;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type BookingInput = {
  customerName: string; email: string; phone: string; address: string; serviceArea: string;
  service: string; frequency: string; bedrooms: number; bathrooms: number; addOns: string[];
  rush: boolean; preferredDate: string; timeWindow: string; notes: string;
};

export async function createBookingOrder(input: BookingInput) {
  const q = quote(input);
  if (q.totalCents <= 0) throw new Error("Please choose a service.");
  const db = await admin();
  const { data: booking, error } = await db
    .from("bookings")
    .insert({
      customer_name: input.customerName, email: input.email, phone: input.phone, address: input.address,
      service_area: input.serviceArea, service: input.service, frequency: input.frequency,
      bedrooms: input.bedrooms, bathrooms: input.bathrooms, add_ons: input.addOns, rush: input.rush,
      preferred_date: input.preferredDate, time_window: input.timeWindow, notes: input.notes,
      amount_cents: q.totalCents,
    })
    .select("id")
    .single();
  if (error || !booking) {
    console.error(error);
    throw new Error("Couldn't save your booking.");
  }

  const token = await paypalToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": booking.id },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: booking.id,
        description: `${input.service} – HousekeeperBooking.com`,
        amount: { currency_code: "USD", value: q.total.toFixed(2) },
      }],
    }),
  });
  if (!res.ok) {
    console.error("PayPal create order failed", res.status, await res.text());
    throw new Error("Couldn't start PayPal checkout.");
  }
  const order = (await res.json()) as { id: string };
  await db.from("bookings").update({ paypal_order_id: order.id }).eq("id", booking.id);
  return { orderId: order.id };
}

export async function captureBookingOrder(orderId: string) {
  const db = await admin();
  const { data: booking } = await db
    .from("bookings").select("id, access_token, amount_cents, status").eq("paypal_order_id", orderId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status === "confirmed") return { bookingId: booking.id, token: booking.access_token };

  const token = await paypalToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const body = (await res.json()) as {
    status?: string;
    purchase_units?: { payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[] } }[];
  };
  const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
  if (!res.ok || body.status !== "COMPLETED" || !capture || capture.status !== "COMPLETED") {
    console.error("PayPal capture failed", res.status, JSON.stringify(body));
    throw new Error("Payment didn't go through. Please try again.");
  }
  if (Math.round(parseFloat(capture.amount.value) * 100) !== booking.amount_cents || capture.amount.currency_code !== "USD") {
    console.error("Amount mismatch", capture.amount, booking.amount_cents);
    throw new Error("Payment amount didn't match. Please contact us.");
  }
  await db.from("bookings").update({
    status: "confirmed", paypal_capture_id: capture.id, paid_at: new Date().toISOString(),
  }).eq("id", booking.id);
  return { bookingId: booking.id, token: booking.access_token };
}

export async function getBooking(id: string, token: string) {
  const db = await admin();
  const { data } = await db
    .from("bookings")
    .select("id, status, customer_name, email, address, service_area, service, frequency, bedrooms, bathrooms, add_ons, rush, preferred_date, time_window, notes, amount_cents, paid_at")
    .eq("id", id).eq("access_token", token).maybeSingle();
  return data;
}
