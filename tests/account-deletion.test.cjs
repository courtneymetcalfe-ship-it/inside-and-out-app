const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const A='10000000-0000-0000-0000-000000000001',B='10000000-0000-0000-0000-000000000002',C='10000000-0000-0000-0000-000000000003';
const state={version:1,demo:false,profile:{name:'Test inmate',min:'',location:''},entries:[]};
test('account deletion validates all choices, preserves transferred files, revokes access and retries safely',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
 await db.query('insert into auth.users values ($1,$2,now()),($3,$4,now()),($5,$6,now())',[A,'admin@example.test',B,'family@example.test',C,'stranger@example.test']);
 await db.exec(fs.readFileSync('supabase/migrations/202609160001_family.sql','utf8'));
 await db.exec(`create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(bucket_id text,name text,owner uuid,owner_id text,primary key(bucket_id,name)); alter table storage.objects enable row level security; grant usage on schema storage to authenticated,anon; grant select,insert,delete,update on storage.objects to authenticated;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261002031236_profile_files.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261002233020_account_deletion.sql','utf8'));
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
 async function rpc(fn,args=[]){return (await db.query(`select public.${fn}(${args.map((_,n)=>'$'+(n+1)).join(',')}) result`,args)).rows[0].result;}
 async function prepare(choices){await db.exec('reset role; set role service_role');return rpc('io_prepare_delete',[A,JSON.stringify(choices)]);}
 await as(A);const keep=await rpc('io_create',[state]),remove=await rpc('io_create',[state]);
 await rpc('io_invite',[keep,'family@example.test']);await as(B);const invite=(await rpc('io_invitations'))[0];await rpc('io_accept',[invite.id]);
 await as(A);await db.query("insert into storage.objects values ('io-files',$1,$2::uuid,$2::text),('io-files',$3,$2::uuid,$2::text)",[keep+'/keep.pdf',A,remove+'/remove.pdf']);
 await assert.rejects(()=>rpc('io_prepare_delete',[A,'[]']),/permission denied/);
 await assert.rejects(()=>prepare([{id:keep,action:'transfer',target:C},{id:remove,action:'delete'}]),/existing family member/);
 await as(A);assert.equal((await db.query('select * from io_inmates')).rows.length,2);
 await assert.rejects(()=>prepare([{id:keep,action:'delete'}]),/Profile list changed/);
 await assert.rejects(()=>prepare([{id:keep,action:'delete'},{id:keep,action:'delete'}]),/Profile list changed/);
 const choices=[{id:keep,action:'transfer',target:B},{id:remove,action:'delete'}];
 assert.deepEqual(await prepare(choices),[remove]);
 assert.deepEqual(await prepare([]),[remove]); // resume after a lost response, never repeat transfer
 await as(A);assert.equal((await db.query('select * from io_inmates')).rows.length,0);
 await assert.rejects(()=>rpc('io_create',[state]),/verified email/);
 await assert.rejects(()=>rpc('io_read',[keep]),/access/i);
 await as(B);assert.equal((await db.query('select * from io_inmates')).rows[0].admin_id,B);
 assert.equal((await db.query('select owner_id from storage.objects')).rows[0].owner_id,B);
 await rpc('io_invite',[keep,'admin@example.test']);await as(A);assert.deepEqual(await rpc('io_invitations'),[]);
 await db.exec('reset role');
 assert.equal((await db.query('select * from io_private.account_deletions')).rows.length,1);
 assert.equal((await db.query('select * from storage.objects')).rows.length,2); // only Storage API removes file bytes
 assert.equal((await db.query('select * from io_activity where actor_id=$1',[A])).rows.length,0);
 await db.query('delete from auth.users where id=$1',[A]);
 assert.equal((await db.query('select * from io_private.account_deletions')).rows.length,0);
 await as(A);await assert.rejects(()=>rpc('io_create',[state]),/verified email/);
 }finally{await db.close();}
});

test('deletion endpoint verifies identity and never trusts a supplied account ID or cleanup path',async()=>{
 const vm=require('node:vm'),ts=require('typescript');let handler,verified=false,prepared=null,removed=[],deleted=null,failCleanup=false;
 const service={auth:{getUser:async()=>verified?{data:{user:{id:A}}}:{data:{user:null},error:{}},admin:{deleteUser:async id=>{deleted=id;return {};}}},rpc:async(name,args)=>{prepared=args;return {data:['server-profile']};},storage:{from:()=>({list:async()=>({data:removed.length?[]:[{id:'file',name:'file.pdf'}]}),remove:async paths=>{if(failCleanup)return {error:new Error('Storage unavailable')};removed=paths;return {};}})}};
 const js=ts.transpileModule(fs.readFileSync('supabase/functions/delete-account/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports:{},require:()=>({createClient:()=>service}),Deno:{env:{get:()=>''},serve:fn=>handler=fn},Response});
 const request=(body={})=>({method:'POST',headers:new Headers({Authorization:'Bearer token'}),json:async()=>body});
 assert.equal((await handler(request())).status,401);assert.equal(prepared,null);
 verified=true;assert.equal((await handler(request({confirmation:'wrong',choices:[]}))).status,400);assert.equal(prepared,null);
 failCleanup=true;
 assert.equal((await handler(request({confirmation:'DELETE MY ACCOUNT',choices:[]}))).status,503);assert.equal(deleted,null);
 failCleanup=false;
 assert.equal((await handler(request({confirmation:'DELETE MY ACCOUNT',choices:[],userId:C,prefixes:['other-profile']}))).status,200);
 assert.equal(prepared.acting_user,A);assert.deepEqual(Array.from(removed),['server-profile/file.pdf']);assert.equal(deleted,A);
});
