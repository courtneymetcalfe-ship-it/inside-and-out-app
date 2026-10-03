begin;
-- Durable cleanup state is private and only the deletion service can access it.
create table io_private.account_deletions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 prefixes jsonb not null,
 created_at timestamptz not null default now()
);
alter table io_private.account_deletions enable row level security;
revoke all on io_private.account_deletions from public,anon,authenticated;
alter table public.io_activity alter column actor_id drop not null;
alter table public.io_activity drop constraint io_activity_actor_id_fkey;
alter table public.io_activity add constraint io_activity_actor_id_fkey foreign key(actor_id) references auth.users(id) on delete set null;

create function io_private.io_guard_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Serialize new ownership with account deletion, including old installed clients.
 perform 1 from auth.users where id=new.admin_id for share;
 if exists(select 1 from io_private.account_deletions where user_id=new.admin_id) then raise exception 'Account deletion is in progress'; end if;
 return new;
end $$;
revoke all on function io_private.io_guard_admin() from public,anon,authenticated;
create trigger io_guard_admin before insert or update of admin_id on public.io_inmates for each row execute function io_private.io_guard_admin();

create or replace function io_private.io_email() returns text language sql stable security definer set search_path='' as $$
 select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null
 and not exists(select 1 from io_private.account_deletions where user_id=auth.uid())
$$;
create or replace function io_private.io_access(inmate uuid) returns boolean language sql stable security definer set search_path='' as $$
 select io_private.io_email() is not null and exists(select 1 from public.io_inmates i where i.id=inmate and
 (i.admin_id=auth.uid() or exists(select 1 from public.io_members m where m.inmate_id=i.id and m.user_id=auth.uid())))
$$;

-- Only the service can call this, after verifying the caller with Auth.getUser.
-- All choices are validated before making any transfer or deleting any profile.
create function io_private.io_prepare_delete(acting_user uuid,choices jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.io_inmates; choice jsonb; target uuid; cleanup_prefixes jsonb='[]'; email_address text;
begin
 select lower(email) into email_address from auth.users where id=acting_user for update;
 if email_address is null then raise exception 'Account unavailable'; end if;
 if exists(select 1 from io_private.account_deletions where user_id=acting_user) then
   -- Reconcile uploads that were already in flight when the first request began.
   update storage.objects o set owner=profile_row.admin_id,owner_id=profile_row.admin_id::text from public.io_inmates profile_row
   where o.bucket_id='io-files' and split_part(o.name,'/',1)=profile_row.id::text and (o.owner=acting_user or o.owner_id=acting_user::text);
   return (select d.prefixes from io_private.account_deletions d where d.user_id=acting_user);
 end if;
 if choices is null or jsonb_typeof(choices)<>'array' then raise exception 'Choose what happens to each profile'; end if;
 perform 1 from public.io_inmates where admin_id=acting_user order by id for update;
 if jsonb_array_length(choices)<>(select count(*) from public.io_inmates where admin_id=acting_user)
 or (select count(distinct c->>'id') from jsonb_array_elements(choices)c)<>jsonb_array_length(choices) then raise exception 'Profile list changed. Refresh and review every profile'; end if;
 for i in select * from public.io_inmates where admin_id=acting_user order by id loop
   select c into choice from jsonb_array_elements(choices)c where c->>'id'=i.id::text;
   if choice is null or choice->>'action' not in ('transfer','delete') or choice->>'action' is null then raise exception 'Choose transfer or delete for every profile'; end if;
   if choice->>'action'='transfer' then
     target=(choice->>'target')::uuid;
     perform 1 from auth.users where id=target for share;
     if target is null or target=acting_user or not exists(select 1 from public.io_members where inmate_id=i.id and user_id=target)
     or exists(select 1 from io_private.account_deletions where user_id=target) then raise exception 'Choose an existing family member with an active account'; end if;
   end if;
 end loop;
 insert into io_private.account_deletions(user_id,prefixes) values(acting_user,'[]');
 for i in select * from public.io_inmates where admin_id=acting_user order by id loop
   select c into choice from jsonb_array_elements(choices)c where c->>'id'=i.id::text;
   if choice->>'action'='transfer' then
     target=(choice->>'target')::uuid;
     update public.io_inmates set admin_id=target,revision=revision+1,updated_at=now() where id=i.id;
     delete from public.io_members where inmate_id=i.id and user_id=target;
     -- Ownership metadata follows the profile; file bytes and paths do not change.
     update storage.objects set owner=target,owner_id=target::text where bucket_id='io-files' and split_part(name,'/',1)=i.id::text;
     insert into public.io_activity(inmate_id,actor_id,actor_email,action) values(i.id,null,'Deleted account','Admin transferred during account deletion');
   else
     cleanup_prefixes=cleanup_prefixes||jsonb_build_array(i.id::text);
     delete from public.io_inmates where id=i.id;
   end if;
 end loop;
 delete from public.io_members where user_id=acting_user;
 delete from public.io_invites where email=email_address;
 update public.io_activity set actor_id=null,actor_email='Deleted account' where actor_id=acting_user;
 -- Remove the account email from task attribution, retaining the family record.
 update public.io_inmates profile_row set state=jsonb_set(state,'{entries}',
 (select coalesce(jsonb_agg(case when e->>'updatedBy'=email_address then e||'{"updatedBy":"Deleted account"}'::jsonb else e end order by n),'[]') from jsonb_array_elements(profile_row.state->'entries') with ordinality t(e,n))),revision=revision+1,updated_at=now()
 where exists(select 1 from jsonb_array_elements(profile_row.state->'entries') e where e->>'updatedBy'=email_address);
 -- Prior transfers may have left uploader ownership on a surviving family file.
 update storage.objects o set owner=profile_row.admin_id,owner_id=profile_row.admin_id::text from public.io_inmates profile_row
 where o.bucket_id='io-files' and split_part(o.name,'/',1)=profile_row.id::text and (o.owner=acting_user or o.owner_id=acting_user::text);
 select coalesce(jsonb_agg(distinct p),'[]') into cleanup_prefixes from (
   select jsonb_array_elements_text(cleanup_prefixes) p
   union select split_part(o.name,'/',1) from storage.objects o where o.bucket_id='io-files'
   and (o.owner=acting_user or o.owner_id=acting_user::text)
   and o.name ~ '^[0-9a-f-]{36}/[a-zA-Z0-9._-]+$'
   and not exists(select 1 from public.io_inmates profile_row where profile_row.id::text=split_part(o.name,'/',1))
 ) cleanup;
 update io_private.account_deletions set prefixes=cleanup_prefixes where user_id=acting_user;
 return cleanup_prefixes;
end $$;
revoke all on function io_private.io_prepare_delete(uuid,jsonb) from public,anon,authenticated;
grant usage on schema io_private to service_role;
grant execute on function io_private.io_prepare_delete(uuid,jsonb) to service_role;
create function public.io_prepare_delete(acting_user uuid,choices jsonb) returns jsonb language sql security invoker set search_path='' as $$ select io_private.io_prepare_delete(acting_user,choices) $$;
revoke all on function public.io_prepare_delete(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.io_prepare_delete(uuid,jsonb) to service_role;
commit;
