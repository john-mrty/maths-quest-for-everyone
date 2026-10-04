-- Run once in a NEW Supabase project's SQL editor.
begin;

-- One atomic family snapshot keeps profiles, preferences and results consistent.
-- Photos live in private object storage, not this JSON document.
create table public.family_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint valid_family_payload check (
    jsonb_typeof(payload->'learners') = 'array'
    and jsonb_typeof(payload->'settings') = 'object'
    and octet_length(payload::text) <= 4194304
  )
);
alter table public.family_state enable row level security;
revoke all on public.family_state from anon, authenticated;
grant select on public.family_state to authenticated;
create policy "Parents read their own family" on public.family_state
  for select to authenticated using ((select auth.uid()) = owner_id);

-- Compare revisions inside the database transaction: never silently overwrite
-- a newer save from another device. NULL means a new account snapshot.
create function public.save_family_state(expected_revision bigint, new_payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare next_revision bigint; parent_id uuid := auth.uid();
begin
  if parent_id is null then raise exception 'Sign in required'; end if;
  if new_payload->'learners' is null or new_payload->'settings' is null then
    raise exception 'Invalid family data';
  end if;
  if expected_revision is null then
    insert into public.family_state(owner_id, payload) values(parent_id, new_payload)
      on conflict (owner_id) do nothing returning revision into next_revision;
  else
    update public.family_state set payload = new_payload,
      revision = revision + 1, updated_at = now()
      where owner_id = parent_id and revision = expected_revision
      returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'SAVE_CONFLICT'; end if;
  return next_revision;
end;
$$;
revoke all on function public.save_family_state(bigint,jsonb) from public, anon;
grant execute on function public.save_family_state(bigint,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,524288,array['image/jpeg']);
create policy "Parents read their own photos" on storage.objects for select
  to authenticated using (bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Parents upload their own photos" on storage.objects for insert
  to authenticated with check (bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Parents remove their own photos" on storage.objects for delete
  to authenticated using (bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
