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
