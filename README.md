# Caption Clash Admin

Admin area for the Caption Clash app (Next.js + Supabase + Vercel).

- **Dashboard** – stats from the data: laugh rate, 30-day activity, a weekday × hour voting heatmap, Hall of Fame / Hall of Shame / Most divisive captions, caption length vs. laugh rate, "funniest words", top critics, harshest critic vs. easiest laugh, best photo uploaders.
- **Users** – READ profiles (with per-user photo/caption/vote counts).
- **AI Media** – CREATE / READ / UPDATE / DELETE images and their AI-generated descriptions and captions (optional Gemini generation when `GEMINI_API_KEY` is set).
- **Votes** – READ upvotes/downvotes, as a log and as ratings per caption.

## Security

Three layers, every route:

1. `proxy.ts` runs on every request. Anything other than `/login` and `/auth/*` requires a Google-authenticated Supabase session **and** `profiles.is_superadmin = true`, otherwise it redirects to `/login`.
2. Every admin page and server action calls `requireAdmin()` again on the server.
3. Supabase RLS (`supabase/admin.sql`): admin policies all check `public.is_superadmin()`, so even a direct API call with the public key can't read other users' data or change media unless the caller is a superadmin.

A trigger stops anyone from setting their own `is_superadmin` through the API (the existing "update own profile" policy would otherwise allow it).

## Won't I be locked out?

Yes, if the only way to become a superadmin were through the admin area. The fix is to bootstrap the first superadmin **outside** the app. The Supabase SQL Editor runs as the `postgres` role, which bypasses RLS and the protection trigger. So the project owner runs:

```sql
update public.profiles set is_superadmin = true
where id = (select id from auth.users where email = 'me@example.com');
```

(That line is at the bottom of `supabase/admin.sql`.) Sign in with Google once first so the profile row exists. After that, more admins can be added the same way, or via the Table Editor.
