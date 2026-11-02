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
- Scheduling uses a shared dnd-kit weekly board and the authenticated schedule_booking database function; admins assign visits, cleaners move only their own, and writes check conflicts and stale versions. Why: enforces scheduling permissions independently of the interface.
- The dedicated cleaner schedule page reuses the weekly board in cleaner mode, even for accounts that also have admin access. Why: personal scheduling stays limited to the signed-in cleaner's assigned visits.
- The availability creator edits only the signed-in cleaner's existing cleaner_settings hours, days off and accepting status; shared validation also applies to the profile editor. Why: availability is consistent across jobs and admin views without replacing profile or rate data.
- Customer account and status pages share an explicitly owner-filtered bookings query under RLS, including verified exact-email guest bookings and periodic refresh. Why: multi-role customers still see only their own visits and scheduling changes appear automatically.
- Booking mutations refresh all cached booking views, including inactive tabs; admin, cleaner and customer lists poll every 15 seconds while open. Why: assignments and moves synchronize across views and separate sessions without manual reloads.
