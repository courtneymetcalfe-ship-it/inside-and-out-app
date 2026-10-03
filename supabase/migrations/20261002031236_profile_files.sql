-- Private document storage. All access is scoped to the inmate in the object path.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('io-files','io-files',false,20971520,array['application/pdf','image/jpeg','image/png','image/heic','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create function io_private.io_file_access(object_name text,write_access boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare inmate uuid;
begin
 if auth.uid() is null or object_name !~ '^[0-9a-f-]{36}/[a-zA-Z0-9._-]+$' then return false; end if;
 begin inmate=split_part(object_name,'/',1)::uuid; exception when invalid_text_representation then return false; end;
 if write_access then return exists(select 1 from public.io_inmates where id=inmate and admin_id=auth.uid()); end if;
 return io_private.io_access(inmate) and exists(select 1 from public.io_inmates i, jsonb_array_elements(i.state->'entries') e where i.id=inmate and e->>'attachment'='io-files/'||object_name);
end $$;
revoke execute on function io_private.io_file_access(text,boolean) from public,anon;
grant execute on function io_private.io_file_access(text,boolean) to authenticated;
create policy io_files_read on storage.objects for select to authenticated using(bucket_id='io-files' and (io_private.io_file_access(name,false) or io_private.io_file_access(name,true)));
create policy io_files_upload on storage.objects for insert to authenticated with check(bucket_id='io-files' and io_private.io_file_access(name,true));
create policy io_files_delete on storage.objects for delete to authenticated using(bucket_id='io-files' and io_private.io_file_access(name,true));
-- No update/upsert policy: uploads cannot replace a file another record references.
create or replace function io_private.io_validate(payload jsonb) returns void language plpgsql set search_path='' as $$
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
 or (e ? 'attachment' and (jsonb_typeof(e->'attachment') is distinct from 'string' or e->>'kind'<>'Document' or e->>'attachment' !~ '^io-files/[0-9a-f-]{36}/[a-zA-Z0-9._-]+$')) or e ? 'reminderId')
 then raise exception 'Invalid record or unsupported shared attachment'; end if;
 perform (e->>'date')::date from jsonb_array_elements(payload->'entries') e;
 if (select count(*) from jsonb_array_elements(payload->'entries')) <> (select count(distinct e->>'id') from jsonb_array_elements(payload->'entries') e)
 then raise exception 'Duplicate record IDs'; end if;
end $$;
create or replace function io_private.io_save(inmate uuid,expected integer,payload jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare i public.io_inmates; result integer;
begin
 select * into i from public.io_inmates where id=inmate for update;
 if i.id is null or auth.uid() is null or i.admin_id<>auth.uid() then raise exception 'Only this inmate’s admin can edit records'; end if;
 if expected is distinct from i.revision then raise exception 'Another family member made a change. Close this form, refresh and try again.'; end if;
 perform io_private.io_validate(payload);
 if exists(select 1 from jsonb_array_elements(payload->'entries') e where e ? 'attachment' and
 (split_part(e->>'attachment','/',2)<>inmate::text or not exists(select 1 from storage.objects o where o.bucket_id='io-files' and o.name=substring(e->>'attachment' from 10))))
 then raise exception 'File unavailable or belongs to another inmate'; end if;
 update public.io_inmates set state=payload,name=payload->'profile'->>'name',revision=revision+1,updated_at=now() where id=inmate returning revision into result;
 perform io_private.io_log(inmate,'Updated profile or records');return result;
end $$;
create or replace function io_private.io_create(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if io_private.io_email() is null then raise exception 'Sign in with a verified email first'; end if;
 perform io_private.io_validate(payload);
 if exists(select 1 from jsonb_array_elements(payload->'entries') e where e ? 'attachment') then raise exception 'Create the profile first, then upload its files'; end if;
 insert into public.io_inmates(admin_id,name,state) values(auth.uid(),payload->'profile'->>'name',payload) returning id into result;
 perform io_private.io_log(result,'Created shared inmate profile');return result;
end $$;
