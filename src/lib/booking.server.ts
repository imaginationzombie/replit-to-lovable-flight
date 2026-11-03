import { quote } from "./pricing";
import { notifyBookingEvent } from "./booking-notices.server";

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
  requestedCleanerId?: string;
};

export async function createBookingOrder(input: BookingInput, userId: string | null, origin = "") {
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
      amount_cents: q.totalCents, user_id: userId, requested_cleaner_id: input.requestedCleanerId ?? null,
    })
    .select("id")
    .single();
  if (error || !booking) {
    console.error(error);
    throw new Error(input.requestedCleanerId ? error?.message ?? "Couldn't reserve that housekeeper. Choose another appointment." : "Couldn't save your booking.");
  }

  let orderId: string;
  if (input.frequency !== "One-time" && origin) {
    // Recurring: ask PayPal to save the customer's PayPal for later visits.
    try {
      orderId = await paypalOrder("AUTHORIZE", booking.id, input.service, q.totalCents, `${booking.id}-v`, {
        paypal: {
          attributes: { vault: { store_in_vault: "ON_SUCCESS", usage_type: "MERCHANT", customer_type: "CONSUMER" } },
          experience_context: { return_url: `${origin}/book`, cancel_url: `${origin}/book`, shipping_preference: "NO_SHIPPING" },
        },
      });
    } catch {
      orderId = await paypalOrder("AUTHORIZE", booking.id, input.service, q.totalCents, booking.id);
    }
  } else {
    orderId = await paypalOrder("AUTHORIZE", booking.id, input.service, q.totalCents, booking.id);
  }
  await db.from("bookings").update({ paypal_order_id: orderId }).eq("id", booking.id);
  return { orderId };
}

async function paypalOrder(intent: "AUTHORIZE" | "CAPTURE", bookingId: string, service: string, cents: number, requestId: string, paymentSource?: unknown) {
  const token = await paypalToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": requestId },
    body: JSON.stringify({
      intent,
      purchase_units: [{
        reference_id: bookingId,
        description: `${service} – HousekeepingBooking.com`,
        amount: { currency_code: "USD", value: (cents / 100).toFixed(2) },
      }],
      ...(paymentSource ? { payment_source: paymentSource } : {}),
    }),
  });
  if (!res.ok) {
    console.error("PayPal create order failed", res.status, await res.text());
    throw new Error("Couldn't start PayPal checkout.");
  }
  return ((await res.json()) as { id: string }).id;
}

/** Customer approved the PayPal hold at checkout: authorize (no money moves yet) and confirm the booking. */
export async function authorizeBookingOrder(orderId: string) {
  const db = await admin();
  const { data: booking } = await db
    .from("bookings").select("id, access_token, amount_cents, status").eq("paypal_order_id", orderId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "pending_payment") {
    if (booking.status === "confirmed") await notifyBookingEvent(db, booking.id, "confirmed");
    return { bookingId: booking.id, token: booking.access_token };
  }
  const token = await paypalToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const body = (await res.json()) as {
    status?: string;
    payment_source?: { paypal?: { attributes?: { vault?: { id?: string; status?: string } } } };
    purchase_units?: { payments?: { authorizations?: { id: string; status: string; amount: { value: string; currency_code: string } }[] } }[];
  };
  const auth = body.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!res.ok || !auth || (auth.status !== "CREATED" && auth.status !== "PENDING")) {
    console.error("PayPal authorize failed", res.status, JSON.stringify(body));
    throw new Error("PayPal couldn't approve that payment method. Please try again.");
  }
  if (Math.round(parseFloat(auth.amount.value) * 100) !== booking.amount_cents || auth.amount.currency_code !== "USD") {
    console.error("Amount mismatch", auth.amount, booking.amount_cents);
    throw new Error("Payment amount didn't match. Please contact us.");
  }
  const { error: confirmError } = await db.from("bookings").update({
    status: "confirmed", paypal_authorization_id: auth.id, authorized_at: new Date().toISOString(),
    paypal_vault_id: body.payment_source?.paypal?.attributes?.vault?.id ?? null,
  }).eq("id", booking.id);
  if (confirmError) throw new Error("Couldn't save your confirmed booking. Please try again.");
  await notifyBookingEvent(db, booking.id, "confirmed");
  return { bookingId: booking.id, token: booking.access_token };
}

/** Charge a vaulted (saved) PayPal account for one visit — no customer action needed. */
async function chargeVault(b: { id: string; service: string; amount_cents: number; paypal_vault_id: string }) {
  const token = await paypalToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `vault-${b.id}` },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ reference_id: b.id, description: `${b.service} – HousekeepingBooking.com`, amount: { currency_code: "USD", value: (b.amount_cents / 100).toFixed(2) } }],
      payment_source: { paypal: { vault_id: b.paypal_vault_id } },
    }),
  });
  const body = (await res.json()) as { id?: string; status?: string; purchase_units?: { payments?: { captures?: { id: string; status: string; amount?: { value: string; currency_code: string } }[] } }[] };
  const cap = body.purchase_units?.[0]?.payments?.captures?.[0];
  if (!res.ok || body.status !== "COMPLETED" || !body.id || !cap || (cap.status !== "COMPLETED" && cap.status !== "PENDING")) {
    console.error("PayPal vault charge failed", res.status, JSON.stringify(body));
    return null;
  }
  if (cap.status === "PENDING") return { pending: true as const };
  if (!cap.amount || Math.round(Number(cap.amount.value) * 100) !== b.amount_cents || cap.amount.currency_code !== "USD") throw new Error("Payment amount didn't match. Please contact us.");
  return { pending: false as const, orderId: body.id, captureId: cap.id };
}

/** After the cleaning: charge this visit (held amount, or saved PayPal for repeat visits). */
export async function collectBookingPayment(bookingId: string) {
  const db = await admin();
  const { data: b } = await db.from("bookings").select("id, status, service, amount_cents, paid_at, paypal_authorization_id, paypal_vault_id").eq("id", bookingId).single();
  if (!b) throw new Error("Booking not found.");
  if (b.paid_at) {
    await notifyBookingEvent(db, b.id, "paid");
    return { paid: true, needsCustomerPayment: false };
  }
  if (b.status !== "completed") throw new Error("Mark the cleaning completed before charging.");
  if (b.paypal_authorization_id) {
    const token = await paypalToken();
    const res = await fetch(`${paypalBase()}/v2/payments/authorizations/${encodeURIComponent(b.paypal_authorization_id)}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `cap-${b.id}` },
      body: JSON.stringify({ final_capture: true }),
    });
    const body = (await res.json()) as { id?: string; status?: string; amount?: { value: string; currency_code: string } };
    if (res.ok && body.id && body.status === "PENDING") return { paid: false, needsCustomerPayment: false };
    if (res.ok && body.id && body.status === "COMPLETED") {
      if (!body.amount || Math.round(Number(body.amount.value) * 100) !== b.amount_cents || body.amount.currency_code !== "USD") throw new Error("Payment amount didn't match. Please contact us.");
      const { error } = await db.from("bookings").update({ paypal_capture_id: body.id, paid_at: new Date().toISOString() }).eq("id", b.id);
      if (error) throw new Error("Couldn't save your payment receipt. Please contact us.");
      await notifyBookingEvent(db, b.id, "paid");
      return { paid: true, needsCustomerPayment: false };
    }
    console.error("PayPal authorization capture failed", res.status, JSON.stringify(body));
  }
  if (b.paypal_vault_id) {
    const r = await chargeVault({ ...b, paypal_vault_id: b.paypal_vault_id });
    if (r) {
      if (r.pending) return { paid: false, needsCustomerPayment: false };
      const { error } = await db.from("bookings").update({ paypal_order_id: r.orderId, paypal_capture_id: r.captureId, paid_at: new Date().toISOString() }).eq("id", b.id);
      if (error) throw new Error("Couldn't save your payment receipt. Please contact us.");
      await notifyBookingEvent(db, b.id, "paid");
      return { paid: true, needsCustomerPayment: false };
    }
  }
  return { paid: false, needsCustomerPayment: true };
}

export function nextVisitDate(date: string, frequency: string): string | null {
  const d = new Date(date + "T12:00:00Z");
  if (frequency === "Weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === "Bi-weekly") d.setUTCDate(d.getUTCDate() + 14);
  else if (frequency === "Monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else return null;
  return d.toISOString().slice(0, 10);
}

/** Mark a visit completed, charge it, and schedule the next visit for repeat bookings. */
export async function completeVisit(bookingId: string) {
  const db = await admin();
  const { data: b } = await db.from("bookings").select("*").eq("id", bookingId).single();
  if (!b) throw new Error("Booking not found.");
  if (b.status !== "confirmed" && b.status !== "completed") throw new Error("Only confirmed bookings can be completed.");
  if (b.status === "confirmed") await db.from("bookings").update({ status: "completed" }).eq("id", b.id);
  const pay = await collectBookingPayment(b.id);
  let nextDate: string | null = null;
  const next = nextVisitDate(b.preferred_date, b.frequency);
  if (next) {
    const { data: existing } = await db.from("bookings").select("id").eq("parent_booking_id", b.id).maybeSingle();
    if (!existing) {
      const { data: nextBooking, error } = await db.from("bookings").insert({
        parent_booking_id: b.id, visit_number: b.visit_number + 1, status: "confirmed",
        customer_name: b.customer_name, email: b.email, phone: b.phone, address: b.address, service_area: b.service_area,
        service: b.service, frequency: b.frequency, bedrooms: b.bedrooms, bathrooms: b.bathrooms, add_ons: b.add_ons,
        rush: false, preferred_date: next, time_window: b.time_window, notes: b.notes,
        amount_cents: quote({ service: b.service, bedrooms: b.bedrooms, bathrooms: b.bathrooms, addOns: b.add_ons, rush: false }).totalCents,
        user_id: b.user_id, cleaner_id: b.cleaner_id, paypal_vault_id: b.paypal_vault_id,
      }).select("id").single();
      if (error) console.error("Next visit insert failed", error);
      else if (nextBooking) {
        nextDate = next;
        await notifyBookingEvent(db, nextBooking.id, "confirmed");
      }
    } else {
      await notifyBookingEvent(db, existing.id, "confirmed");
    }
  }
  return { ...pay, nextDate };
}

/** Fallback when the hold expired: customer pays the completed visit from their booking page. */
export async function createBalanceOrder(id: string, accessToken: string) {
  const db = await admin();
  const { data: b } = await db.from("bookings").select("id, service, amount_cents, status, paid_at").eq("id", id).eq("access_token", accessToken).maybeSingle();
  if (!b) throw new Error("Booking not found.");
  if (b.paid_at) throw new Error("This visit is already paid.");
  if (b.status !== "completed") throw new Error("Payment opens once your cleaning is completed.");
  const orderId = await paypalOrder("CAPTURE", b.id, b.service, b.amount_cents, `bal-${b.id}-${Date.now()}`);
  await db.from("bookings").update({ paypal_order_id: orderId }).eq("id", b.id);
  return { orderId };
}

export async function captureBookingOrder(orderId: string) {
  const db = await admin();
  const { data: booking } = await db
    .from("bookings").select("id, access_token, amount_cents, status, paid_at").eq("paypal_order_id", orderId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.paid_at) {
    await notifyBookingEvent(db, booking.id, "paid");
    if (booking.status === "confirmed") await notifyBookingEvent(db, booking.id, "confirmed");
    return { bookingId: booking.id, token: booking.access_token };
  }

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
  const { error: receiptError } = await db.from("bookings").update({
    ...(booking.status === "pending_payment" ? { status: "confirmed" } : {}), paypal_capture_id: capture.id, paid_at: new Date().toISOString(),
  }).eq("id", booking.id);
  if (receiptError) throw new Error("Couldn't save your payment receipt. Please contact us.");
  if (booking.status === "pending_payment") await notifyBookingEvent(db, booking.id, "confirmed");
  await notifyBookingEvent(db, booking.id, "paid");
  return { bookingId: booking.id, token: booking.access_token };
}

export async function getBooking(id: string, token: string) {
  const db = await admin();
  const { data } = await db
    .from("bookings")
    .select("id, status, customer_name, email, address, service_area, service, frequency, bedrooms, bathrooms, add_ons, rush, preferred_date, time_window, notes, amount_cents, paid_at, authorized_at, cleaner_id")
    .eq("id", id).eq("access_token", token).maybeSingle();
  return data;
}

export async function userIdFromBearer(authHeader: string | undefined) {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const db = await admin();
  const { data } = await db.auth.getUser(token);
  return data.user?.id ?? null;
}
