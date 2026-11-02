<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The marketing site is static HTML in public/*.html (served as-is, "/" redirects to /index.html); new interactive features are React routes styled with matching tokens in src/styles.css. Why: preserves the migrated design exactly while allowing real app features.
- AI calls live in src/lib/*.server.ts (gateway, Responses API, structured output) behind createServerFn wrappers in *.functions.ts. Why: keeps the API key server-side.
- Accounts: roles live in user_roles (admin/cleaner/customer, checked via has_role); a signup trigger creates the profile + customer role. Signed-in pages live under src/routes/_authenticated and read data with the browser client under RLS. Why: no privilege escalation, and access is enforced by the database.
- Scheduling uses shared dnd-kit week and month views and the authenticated schedule_booking database function; admins assign visits, cleaners move only their own, and writes check conflicts and stale versions. Why: enforces scheduling permissions independently of the interface.
- The dedicated cleaner schedule page reuses the weekly board in cleaner mode, even for accounts that also have admin access. Why: personal scheduling stays limited to the signed-in cleaner's assigned visits.
- The availability creator edits only the signed-in cleaner's existing cleaner_settings hours, days off and accepting status; shared validation also applies to the profile editor. Why: availability is consistent across jobs and admin views without replacing profile or rate data.
- Customer account and status pages share an explicitly owner-filtered bookings query under RLS, including verified exact-email guest bookings and periodic refresh. Why: multi-role customers still see only their own visits and scheduling changes appear automatically.
- Booking mutations refresh all cached booking views, including inactive tabs; admin, cleaner and customer lists poll every 15 seconds while open. Why: assignments and moves synchronize across views and separate sessions without manual reloads.
- Booking and customer-payment emails run after successful server-side booking confirmations and verified completed PayPal captures, using persisted recipients and event-derived idempotency; the admin confirmation action shares the booking sender. Email failures never fail the payment, and customer-payment notices never imply cleaner wage settlement. Why: automatic notices cannot spoof recipients, duplicate retries, or falsely claim money delivery.
- Waiting-list RPCs expose only appointment scope and location area, never customer contact or payment data, and atomically claim unassigned confirmed visits with cleaner-role, availability and conflict checks. Why: employees fill their schedules without accessing unassigned customers' private data or double-booking.
- Appointment work records use cleaner-owned authenticated RPCs; submission snapshots hourly earnings and locks edits, while admin-only review records approval and externally completed payments. Why: timesheets cannot self-approve and customer PayPal payments remain separate from employee payouts.
- Keep the project on Vite 7 and use exact legacy entities subpath aliases only, never a broad entities alias. Why: newer HTML parsers need their own entities version, and forcing the legacy package stalls dependency optimization and leaves portals blank.
- Timesheet approval uses an admin-authorized approve-and-pay server function, validates a receiving email before approval, and reserves one permanent PayPal operation per timesheet; pending receipts reconcile while either portal is open, uncertain sends never retry and tests never settle live wages. Why: approval initiates payment without duplicate transfers or false settlement.
- The admin PayPal dashboard reuses existing payout controls and classifies settlement only from live successful payouts with paid work receipts, separating manual records, tests and uncertain transfers. Why: summary totals cannot imply money was delivered without verified receipts.
- Customer tips are separate post-cleaning PayPal captures and separate one-shot cleaner payouts; booking access tokens authorize customer actions and only verified completed receipts credit tips. Why: voluntary tips never alter recurring charges or frozen timesheet wages.

- Customer payment history reuses the owner-filtered bookings query and booking-token tip receipts, distinguishing capture dates from cleaner delivery dates and sandbox records. Why: customers see only their records without exposing cleaner payout account details.

- Hiring review enables cleaner roles only through the admin-checked review_application RPC; applicants cannot change their own status. Why: applying cannot grant staff access.
- Messaging uses participant-scoped threads and authenticated RPC sends with server-derived sender names; booking participation follows the current cleaner assignment. Why: users cannot spoof messages or read another customer’s conversations.
- Public housekeeper portfolios expose only explicitly published profile fields and linked private-bucket photos through expiring links; uploads are cleaner-owned. Why: publicity is opt-in and customer contact data stays private.
- Customer portal balance buttons reuse the token-authorized PayPal checkout for completed unpaid visits and refresh shared booking queries; customer charges remain distinct from cleaner wages. Why: preserves zero upfront payment and avoids implying customer receipts are employee payouts.
- Admin date blocks live separately from cleaner settings, with admin-only mutation and a booking-write validation trigger under the shared cleaner lock. Why: cleaners cannot erase admin restrictions, all assignment paths enforce them, and active visits must be rescheduled before blocking.
