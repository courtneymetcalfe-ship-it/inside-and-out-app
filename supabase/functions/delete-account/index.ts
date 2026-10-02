import {createClient} from 'npm:@supabase/supabase-js@2.116.0';

const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return respond(405,{error:'Use POST'});
 const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
 if(!token)return respond(401,{error:'Sign in to delete your account'});
 const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:authError}=await service.auth.getUser(token);
 if(authError||!identity.user)return respond(401,{error:'Sign in again to continue'});
 try{
   const body=await req.json();
   if(body.confirmation!=='DELETE MY ACCOUNT'||!Array.isArray(body.choices)||body.choices.length>1000)return respond(400,{error:'Review each profile and confirm account deletion'});
   const {data:prefixes,error}=await service.rpc('io_prepare_delete',{acting_user:identity.user.id,choices:body.choices});
   if(error)return respond(409,{error:'Unable to prepare deletion. Refresh your profile choices and try again.'});
   // The database, never the caller, supplies cleanup paths. Retry resumes the same job.
   for(const prefix of prefixes as string[]){
     for(let page=0;page<100;page++){
       const {data:files,error:listError}=await service.storage.from('io-files').list(prefix,{limit:100,offset:0});
       if(listError)throw listError;
       if(!files?.length)break;
       if(files.some(f=>!f.id))throw new Error('Unexpected folder');
       const {error:removeError}=await service.storage.from('io-files').remove(files.map(f=>`${prefix}/${f.name}`));
       if(removeError)throw removeError;
       if(page===99)throw new Error('Cleanup requires another pass');
     }
   }
   const {error:deleteError}=await service.auth.admin.deleteUser(identity.user.id);
   if(deleteError)throw deleteError;
   return respond(200,{deleted:true});
 }catch{
   return respond(503,{error:'Deletion has not finished. Your request is saved if processing began. Retry to finish cleanup. Contact insideandoutapp.support@gmail.com if this continues.'});
 }
});
