begin;
create table public.io_inmates (
 id uuid primary key default gen_random_uuid(),
 admin_id uuid not null references auth.users(id) on delete restrict,
 name text not null check(length(name) between 1 and 200),
 state jsonb not null,
 revision integer not null default 0,
 updated_at timestamptz not null default now()
);
create table public.io_members (
 inmate_id uuid not null references public.io_inmates(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(inmate_id,user_id)
);
create table public.io_invites (
 id uuid primary key default gen_random_uuid(),
 inmate_id uuid not null references public.io_inmates(id) on delete cascade,
 email text not null check(length(email) <= 254),
 expires_at timestamptz not null default now()+interval '7 days',
 unique(inmate_id,email)
);
create table public.io_activity (
 id bigint generated always as identity primary key,
 inmate_id uuid not null references public.io_inmates(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete restrict,
 actor_email text not null,
 action text not null,
 created_at timestamptz not null default now()
);
alter table public.io_inmates enable row level security;
alter table public.io_members enable row level security;
alter table public.io_invites enable row level security;
alter table public.io_activity enable row level security;
revoke all on public.io_inmates,public.io_members,public.io_invites,public.io_activity from public,anon,authenticated;
grant select on public.io_inmates,public.io_activity to authenticated;

create function public.io_email() returns text language sql stable security definer set search_path='' as $$
 select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null
$$;
create function public.io_access(inmate uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.io_inmates i where i.id=inmate and
 (i.admin_id=auth.uid() or exists(select 1 from public.io_members m where m.inmate_id=i.id and m.user_id=auth.uid())))
$$;
create policy io_read_inmate on public.io_inmates for select to authenticated using (public.io_access(id));
create policy io_read_activity on public.io_activity for select to authenticated using (public.io_access(inmate_id));

create function public.io_validate(payload jsonb) returns void language plpgsql set search_path='' as $$
begin
 if payload is null or payload->>'version' is distinct from '1' or jsonb_typeof(payload->'demo') is distinct from 'boolean'
 or jsonb_typeof(payload->'profile') is distinct from 'object' or jsonb_typeof(payload->'entries') is distinct from 'array'
 or length(payload::text)>2000000 then raise exception 'Invalid organiser data'; end if;
 if exists(select 1 from unnest(array['name','min','location']) k where jsonb_typeof(payload->'profile'->k) is distinct from 'string')
 or length(payload->'profile'->>'name') not between 1 and 200 then raise exception 'Invalid inmate profile'; end if;
 if exists(select 1 from jsonb_array_elements(payload->'entries') e where
 jsonb_typeof(e) is distinct from 'object' or exists(select 1 from unnest(array['id','kind','title','date','time','place','details','status']) k where jsonb_typeof(e->k) is distinct from 'string')
 or e->>'kind' not in ('Court','Medical','Visit','Call','Note','Task','Document')
 or e->>'status' not in ('Planned','Follow up','Completed','Receiving','Not confirmed','Missing')
 or length(e->>'id') not between 1 and 200 or length(trim(e->>'title')) not between 1 and 200
 or length(e->>'details')>10000
 or (e->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
 or (e->>'time') !~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$'
 or (e ? 'updatedBy' and jsonb_typeof(e->'updatedBy') <> 'string')
 or (e ? 'updatedAt' and jsonb_typeof(e->'updatedAt') <> 'string')
 or e ? 'attachment' or e ? 'reminderId')
 then raise exception 'Invalid record or unsupported shared attachment'; end if;
 perform (e->>'date')::date from jsonb_array_elements(payload->'entries') e;
 if (select count(*) from jsonb_array_elements(payload->'entries')) <> (select count(distinct e->>'id') from jsonb_array_elements(payload->'entries') e)
 then raise exception 'Duplicate record IDs'; end if;
end $$;
create function public.io_log(inmate uuid,description text) returns void language sql security definer set search_path='' as $$
 insert into public.io_activity(inmate_id,actor_id,actor_email,action) values(inmate,auth.uid(),public.io_email(),description)
$$;
create function public.io_create(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if public.io_email() is null then raise exception 'Sign in with a verified email first'; end if;
 perform public.io_validate(payload);
 insert into public.io_inmates(admin_id,name,state) values(auth.uid(),payload->'profile'->>'name',payload) returning id into result;
 perform public.io_log(result,'Created shared inmate profile');return result;
end $$;
create function public.io_read(inmate uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.io_access(inmate) then raise exception 'You no longer have access to this profile'; end if;
 return (select jsonb_build_object('state',state,'revision',revision) from public.io_inmates where id=inmate);
end $$;
create function public.io_save(inmate uuid,expected integer,payload jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare i public.io_inmates; result integer;
begin
 select * into i from public.io_inmates where id=inmate for update;
 if i.id is null or auth.uid() is null or i.admin_id<>auth.uid() then raise exception 'Only this inmate’s admin can edit records'; end if;
 if expected is distinct from i.revision then raise exception 'Another family member made a change. Close this form, refresh and try again.'; end if;
 perform public.io_validate(payload);
 update public.io_inmates set state=payload,name=payload->'profile'->>'name',revision=revision+1,updated_at=now() where id=inmate returning revision into result;
 perform public.io_log(inmate,'Updated profile or records');return result;
end $$;
create function public.io_task_status(inmate uuid,entry_id text,completed boolean,expected integer) returns void language plpgsql security definer set search_path='' as $$
declare i public.io_inmates; task jsonb; entries jsonb;
begin
 select * into i from public.io_inmates where id=inmate for update;
 if not public.io_access(inmate) then raise exception 'Access denied'; end if;
 if expected is distinct from i.revision then raise exception 'Another family member made a change. Refresh and try again.'; end if;
 select e into task from jsonb_array_elements(i.state->'entries') e where e->>'id'=entry_id and e->>'kind'='Task';
 if task is null or completed is null then raise exception 'Task not found'; end if;
 select jsonb_agg(case when e->>'id'=entry_id then e || jsonb_build_object('status',case when completed then 'Completed' else 'Planned' end,'updatedBy',public.io_email(),'updatedAt',now()) else e end order by ord)
 into entries from jsonb_array_elements(i.state->'entries') with ordinality x(e,ord);
 update public.io_inmates set state=jsonb_set(state,'{entries}',entries),revision=revision+1,updated_at=now() where id=inmate;
 perform public.io_log(inmate,(case when completed then 'Completed task: ' else 'Reopened task: ' end)||(task->>'title'));
end $$;
create function public.io_invite(inmate uuid,recipient text) returns void language plpgsql security definer set search_path='' as $$
declare i public.io_inmates;
begin
 select * into i from public.io_inmates where id=inmate for update;
 if auth.uid() is null or i.id is null or i.admin_id<>auth.uid() then raise exception 'Only the admin can invite family'; end if;
 recipient=lower(trim(recipient));
 if recipient is null or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email'; end if;
 if recipient=public.io_email() then raise exception 'You are already the admin'; end if;
 insert into public.io_invites(inmate_id,email) values(inmate,recipient) on conflict(inmate_id,email) do update set expires_at=now()+interval '7 days';
 perform public.io_log(inmate,'Invited a family member');
end $$;
create function public.io_invitations() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',i.name)),'[]'::jsonb)
 from public.io_invites v join public.io_inmates i on i.id=v.inmate_id where v.email=public.io_email() and v.expires_at>now()
$$;
create function public.io_accept(invitation uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.io_invites;
begin
 select * into v from public.io_invites where id=invitation;
 if v.id is null then raise exception 'Invitation unavailable'; end if;
 perform 1 from public.io_inmates where id=v.inmate_id for update;
 select * into v from public.io_invites where id=invitation for update;
 if public.io_email() is null or v.id is null or v.email<>public.io_email() or v.expires_at<=now() then raise exception 'Invitation expired or belongs to another email'; end if;
 insert into public.io_members values(v.inmate_id,auth.uid()) on conflict do nothing;
 delete from public.io_invites where id=invitation;
 perform public.io_log(v.inmate_id,'Joined family profile');return v.inmate_id;
end $$;
create function public.io_team(inmate uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.io_access(inmate) then raise exception 'Access denied'; end if;
 return jsonb_build_object('members',(select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'admin',u.id=i.admin_id)),'[]')
 from public.io_inmates i join auth.users u on u.id=i.admin_id or exists(select 1 from public.io_members m where m.inmate_id=i.id and m.user_id=u.id) where i.id=inmate),
 'invites',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'email',v.email,'expires',v.expires_at)),'[]') from public.io_invites v join public.io_inmates i on i.id=v.inmate_id where i.id=inmate and i.admin_id=auth.uid()));
end $$;
create function public.io_remove_member(inmate uuid,member uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.io_inmates;
begin
 select * into i from public.io_inmates where id=inmate for update;
 if auth.uid() is null or i.id is null or i.admin_id<>auth.uid() then raise exception 'Only the admin can remove members'; end if;
 if member=i.admin_id then raise exception 'The sole admin cannot be removed'; end if;
 delete from public.io_members where inmate_id=inmate and user_id=member;
 delete from public.io_invites where inmate_id=inmate and email=(select lower(email) from auth.users where id=member);
 perform public.io_log(inmate,'Removed a family member');
end $$;
create function public.io_revoke_invite(inmate uuid,invitation uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.io_inmates;
begin
 select * into i from public.io_inmates where id=inmate for update;
 if auth.uid() is null or i.id is null or i.admin_id<>auth.uid() then raise exception 'Only the admin can revoke invitations'; end if;
 delete from public.io_invites where id=invitation and inmate_id=inmate;
 perform public.io_log(inmate,'Revoked a family invitation');
end $$;
-- Explicit grants: internal helpers are not callable by app clients.
revoke execute on function public.io_email(),public.io_access(uuid),public.io_validate(jsonb),public.io_log(uuid,text),public.io_create(jsonb),public.io_read(uuid),public.io_save(uuid,integer,jsonb),public.io_task_status(uuid,text,boolean,integer),public.io_invite(uuid,text),public.io_invitations(),public.io_accept(uuid),public.io_team(uuid),public.io_remove_member(uuid,uuid),public.io_revoke_invite(uuid,uuid) from public,anon,authenticated;
grant execute on function public.io_access(uuid),public.io_create(jsonb),public.io_read(uuid),public.io_save(uuid,integer,jsonb),public.io_task_status(uuid,text,boolean,integer),public.io_invite(uuid,text),public.io_invitations(),public.io_accept(uuid),public.io_team(uuid),public.io_remove_member(uuid,uuid),public.io_revoke_invite(uuid,uuid) to authenticated;
-- Realtime never bypasses the SELECT policies above.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.io_inmates; end if;
end $$;
commit;
