# NovelFlow Supabase setup

This is the first cloud-storage phase. It keeps the current local API contract
intact while allowing project snapshots to be stored in Supabase.

1. Open the Supabase dashboard SQL Editor for the NovelFlow project.
2. Run [`schema.sql`](schema.sql) once.
3. Create a user in Supabase Authentication, then copy that user's UUID.
4. Configure these **Heroku server-side config vars**:

   - `SUPABASE_URL=https://<project-ref>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>`
   - `NOVELFLOW_TENANT_ID=<the Auth user UUID>`

Never put the service role key in `web-ui`, `.env.example`, a browser form,
or a Git commit. The current compatibility mode is single-tenant; the next
phase will derive `owner_id` from the signed-in Supabase access token so each
customer sees only their own projects.

After setting the vars, restart the Heroku app and check `/api/health`. It
should return `storage: "supabase"` and `supabaseReady: true`.
