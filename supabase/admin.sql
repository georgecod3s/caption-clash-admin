-- =====================================================================
-- Admin area: superadmin flag + RLS policies
-- Paste into Supabase -> SQL Editor -> Run. Safe to re-run.
-- =====================================================================

-- 1. The gate column -------------------------------------------------
alter table public.profiles
    add column if not exists is_superadmin boolean not null default false;

-- 2. Helper used by every admin policy (SECURITY DEFINER so it can read
--    profiles without recursing through profiles' own RLS) -----------
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select p.is_superadmin from public.profiles p where p.id = auth.uid()),
        false
    );
$$;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to anon, authenticated;

-- 3. Nobody can promote themselves through the API.
--    The existing "profiles: update own" policy lets a user update their
--    own row, so without this trigger anyone could set is_superadmin=true.
--    Only privileged roles (SQL editor / service role) may change it.
create or replace function public.protect_superadmin_flag()
returns trigger
language plpgsql
as $$
begin
    if current_user in ('anon', 'authenticated') then
        if tg_op = 'INSERT' and new.is_superadmin then
            raise exception 'is_superadmin can only be set by a database administrator';
        end if;
        if tg_op = 'UPDATE' and new.is_superadmin is distinct from old.is_superadmin then
            raise exception 'is_superadmin can only be set by a database administrator';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists protect_superadmin_flag on public.profiles;
create trigger protect_superadmin_flag
    before insert or update on public.profiles
    for each row execute function public.protect_superadmin_flag();

-- 4. Admin policies (added on top of the existing user policies) ------

-- profiles: READ all
drop policy if exists "admin: read profiles" on public.profiles;
create policy "admin: read profiles" on public.profiles for select to authenticated
    using (public.is_superadmin());

-- images (AI media): full CRUD
drop policy if exists "admin: insert images" on public.images;
drop policy if exists "admin: update images" on public.images;
drop policy if exists "admin: delete images" on public.images;
create policy "admin: insert images" on public.images for insert to authenticated
    with check (public.is_superadmin());
create policy "admin: update images" on public.images for update to authenticated
    using (public.is_superadmin()) with check (public.is_superadmin());
create policy "admin: delete images" on public.images for delete to authenticated
    using (public.is_superadmin());

-- captions (AI-generated text): full CRUD
drop policy if exists "admin: insert captions" on public.captions;
drop policy if exists "admin: update captions" on public.captions;
drop policy if exists "admin: delete captions" on public.captions;
create policy "admin: insert captions" on public.captions for insert to authenticated
    with check (public.is_superadmin());
create policy "admin: update captions" on public.captions for update to authenticated
    using (public.is_superadmin()) with check (public.is_superadmin());
create policy "admin: delete captions" on public.captions for delete to authenticated
    using (public.is_superadmin());

-- caption_votes: READ all
drop policy if exists "admin: read votes" on public.caption_votes;
create policy "admin: read votes" on public.caption_votes for select to authenticated
    using (public.is_superadmin());

-- storage: admins may upload/replace/delete any file in caption-images
drop policy if exists "caption-images: admin insert" on storage.objects;
drop policy if exists "caption-images: admin update" on storage.objects;
drop policy if exists "caption-images: admin delete" on storage.objects;
drop policy if exists "caption-images: admin select" on storage.objects;
create policy "caption-images: admin insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'caption-images' and public.is_superadmin());
create policy "caption-images: admin update" on storage.objects for update to authenticated
    using (bucket_id = 'caption-images' and public.is_superadmin());
create policy "caption-images: admin delete" on storage.objects for delete to authenticated
    using (bucket_id = 'caption-images' and public.is_superadmin());
create policy "caption-images: admin select" on storage.objects for select to authenticated
    using (bucket_id = 'caption-images' and public.is_superadmin());

-- 5. Bootstrap: solve the chicken-and-egg lockout -----------------------
-- The SQL editor runs as the `postgres` role, which bypasses RLS and the
-- trigger above, so the project owner can flip the flag for themselves.
update public.profiles
set is_superadmin = true
where id in (select id from auth.users where email = 'georgedanielneira@gmail.com');

select p.id, u.email, p.is_superadmin
from public.profiles p join auth.users u on u.id = p.id
order by p.is_superadmin desc;
