create or replace function io_private.io_save(inmate uuid,expected integer,payload jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare
 i public.io_inmates;
 result integer;
 old_entry jsonb;
 new_entry jsonb;
 changed boolean := false;
begin
 select * into i from public.io_inmates where id=inmate for update;
 if i.id is null or auth.uid() is null or i.admin_id<>auth.uid() then raise exception 'Only this inmate’s admin can edit records'; end if;
 if expected is distinct from i.revision then raise exception 'Another family member made a change. Close this form, refresh and try again.'; end if;
 perform io_private.io_validate(payload);

 if i.state->'profile' is distinct from payload->'profile' then
   perform io_private.io_log(inmate,'Updated inmate profile');
   changed := true;
 end if;

 for new_entry in select value from jsonb_array_elements(payload->'entries')
 loop
   select value into old_entry
   from jsonb_array_elements(i.state->'entries')
   where value->>'id'=new_entry->>'id'
   limit 1;

   if old_entry is null then
     if new_entry->>'kind'='Document' and coalesce(new_entry->>'attachment','')<>'' then
       perform io_private.io_log(inmate,'Uploaded document: '||(new_entry->>'title'));
     else
       perform io_private.io_log(inmate,'Added '||lower(new_entry->>'kind')||': '||(new_entry->>'title'));
     end if;
     changed := true;
   elsif old_entry is distinct from new_entry then
     perform io_private.io_log(inmate,'Updated '||lower(new_entry->>'kind')||': '||(new_entry->>'title'));
     changed := true;
   end if;
 end loop;

 for old_entry in select value from jsonb_array_elements(i.state->'entries')
 loop
   select value into new_entry
   from jsonb_array_elements(payload->'entries')
   where value->>'id'=old_entry->>'id'
   limit 1;

   if new_entry is null then
     if old_entry->>'kind'='Document' and coalesce(old_entry->>'attachment','')<>'' then
       perform io_private.io_log(inmate,'Removed document: '||(old_entry->>'title'));
     else
       perform io_private.io_log(inmate,'Removed '||lower(old_entry->>'kind')||': '||(old_entry->>'title'));
     end if;
     changed := true;
   end if;
 end loop;

 update public.io_inmates
 set state=payload,name=payload->'profile'->>'name',revision=revision+1,updated_at=now()
 where id=inmate
 returning revision into result;

 if not changed then perform io_private.io_log(inmate,'Updated shared profile'); end if;
 return result;
end $$;

revoke execute on function io_private.io_save(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function io_private.io_save(uuid,integer,jsonb) to authenticated;
