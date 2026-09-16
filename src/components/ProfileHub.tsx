import React,{useEffect,useMemo,useRef,useState} from 'react';
import {View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Action,Box,Field,Label,Sheet,Shell} from './Surface';
import {addProfile,migrateProfile,parseBook,replaceProfile,ProfileBook,RecordSource,RecordState} from '../lib/profiles';
import {platform} from '../lib/platform';
import {cloudSource,family,familyConfigured,rpc,sharedProfiles,SharedProfile} from '../lib/family';
const BOOK_KEY='insideout.profiles.v2';
type Team={members:{id:string;email:string;admin:boolean}[];invites:{id:string;email:string;expires:string}[]};
type Props={children:(source:RecordSource,toolbar:React.ReactNode,identity:string)=>React.ReactNode};
export default function ProfileHub({children}:Props){
 const [book,setBook]=useState<ProfileBook|null>(null);const bookRef=useRef<ProfileBook|null>(null);
 const [cloud,setCloud]=useState<SharedProfile[]>([]);const [cloudId,setCloudId]=useState('');
 const [account,setAccount]=useState<{id:string;email:string}|null>(null);
 const [modal,setModal]=useState<'switch'|'family'|'share'|null>(null);
 const [name,setName]=useState('');const [email,setEmail]=useState('');const [code,setCode]=useState('');const [sent,setSent]=useState(false);
 const [recipient,setRecipient]=useState('');const [team,setTeam]=useState<Team|null>(null);
 const [invitations,setInvitations]=useState<{id:string;name:string}[]>([]);
 const [activity,setActivity]=useState<{id:number;actor_email:string;action:string;created_at:string}[]>([]);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const lock=useRef(false);
 useEffect(()=>{let alive=true;(async()=>{
   const raw=await AsyncStorage.getItem(BOOK_KEY);
   const loaded=raw?parseBook(raw):migrateProfile(await platform.load());
   // Write v2 before using it. The original v1 key remains untouched as a recovery copy.
   if(!raw)await AsyncStorage.setItem(BOOK_KEY,JSON.stringify(loaded));
   if(alive){bookRef.current=loaded;setBook(loaded);}
 })().catch(e=>alive&&setError(e.message));return()=>{alive=false;};},[]);
 async function loadCloud(){
   const rows=await sharedProfiles();setCloud(rows);
   setInvitations(await rpc('io_invitations'));
 }
 useEffect(()=>{
   if(!family)return;
   const {data}=family.auth.onAuthStateChange((_event,session)=>{
     setAccount(session?{id:session.user.id,email:session.user.email||''}:null);
     if(!session){setCloudId('');setCloud([]);setInvitations([]);setTeam(null);setActivity([]);}
   });return()=>data.subscription.unsubscribe();
 },[]);
 useEffect(()=>{if(account)void loadCloud().catch(e=>setError(e.message));},[account?.id]);
 async function run(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Unable to complete that action.');}finally{lock.current=false;setBusy(false);}}
 async function saveBook(next:ProfileBook){await AsyncStorage.setItem(BOOK_KEY,JSON.stringify(next));bookRef.current=next;setBook(next);}
 const selected=cloud.find(p=>p.id===cloudId);
 const local=book?.profiles.find(p=>p.id===book.selectedId);
 const isAdmin=!!selected&&selected.admin_id===account?.id;
 const source=useMemo<RecordSource|null>(()=>{
   if(cloudId&&account)return cloudSource(cloudId,!!selected&&selected.admin_id===account.id);
   if(!book)return null;const id=book.selectedId;
   return {shared:false,admin:true,load:async()=>bookRef.current!.profiles.find(p=>p.id===id)!.state,
     save:async state=>{await saveBook(replaceProfile(bookRef.current!,id,state));}};
 },[cloudId,book?.selectedId,account?.id,selected?.admin_id]);
 async function openFamily(){setTeam(null);setActivity([]);setModal('family');if(!account)return;
   await loadCloud();if(cloudId){setTeam(await rpc('io_team',{inmate:cloudId}));const {data,error}=await family!.from('io_activity').select('id,actor_email,action,created_at').eq('inmate_id',cloudId).order('created_at',{ascending:false}).limit(30);if(error)throw error;setActivity(data||[]);}
 }
 if(!book||!source)return <Shell nav={null}><Label variant="title">Inside & Out</Label><Label>{error||'Opening inmate profiles…'}</Label></Shell>;
 const toolbar=<Box variant="card"><Box variant="row"><View style={{flex:1}}><Label variant="badge">{cloudId?(isAdmin?'SHARED · ADMIN':'SHARED · FAMILY MEMBER'):'ON THIS DEVICE'}</Label><Label variant="heading">{selected?.name||local?.state.profile.name||'Your inmate profile'}</Label></View><Action disabled={busy} tone="quiet" onPress={()=>{setError('');setModal('switch');}}>Switch inmate</Action></Box><Action disabled={busy} tone="quiet" onPress={()=>run(openFamily)}>Family access</Action>{!!error&&<Label variant="error">{error}</Label>}{!!notice&&<Label variant="accent">{notice}</Label>}</Box>;
 return <>{children(source,toolbar,cloudId?`shared-${account?.id}-${cloudId}`:`local-${book.selectedId}`)}
 <Sheet open={modal==='switch'} title="Inmate profiles" onClose={()=>!busy&&setModal(null)}>
 <Label variant="small">Each inmate has a separate timeline, documents and task list.</Label>
 {book.profiles.map(p=><Action key={p.id} disabled={busy} tone={!cloudId&&book.selectedId===p.id?'selected':'quiet'} onPress={()=>run(async()=>{await saveBook({...bookRef.current!,selectedId:p.id});setCloudId('');setModal(null);})}>{p.state.profile.name||'Your original profile'} · On this device</Action>)}
 {cloud.map(p=><Action key={p.id} disabled={busy} tone={cloudId===p.id?'selected':'quiet'} onPress={()=>{setCloudId(p.id);setModal(null);}}>{p.name} · {p.admin_id===account?.id?'Admin':'Family member'}</Action>)}
 <Field label="New inmate’s name" value={name} onChange={setName}/>
 <Action disabled={busy} onPress={()=>run(async()=>{const id=`local-${Date.now()}-${Math.random().toString(36).slice(2)}`;await saveBook(addProfile(bookRef.current!,id,name));setCloudId('');setName('');setModal(null);})}>Add inmate profile</Action>
 {account&&<Action disabled={busy} tone="quiet" onPress={()=>run(loadCloud)}>Refresh shared profiles</Action>}
 {!!error&&<Label variant="error">{error}</Label>}
 </Sheet>
 <Sheet open={modal==='family'} title="Family access" onClose={()=>!busy&&setModal(null)}>
 {!familyConfigured?<><Label variant="heading">Family sharing is not connected yet</Label><Label>Your inmate profiles work on this device. Shared accounts will become available after the app’s cloud connection is configured.</Label></>:!account?<>
 <Label>Sign in with your own email. Each inmate has one admin who controls family access.</Label>
 <Field label="Your email address" value={email} onChange={v=>{setEmail(v);setSent(false);setCode('');}}/>
 <Action disabled={busy||!email.trim()} onPress={()=>run(async()=>{const {error}=await family!.auth.signInWithOtp({email:email.trim().toLowerCase()});if(error)throw error;setSent(true);setNotice('Check your email for a sign-in code.');})}>{sent?'Send another code':'Send sign-in code'}</Action>
 {sent&&<><Field label="Email sign-in code" value={code} onChange={setCode}/><Action disabled={busy} onPress={()=>run(async()=>{const {error}=await family!.auth.verifyOtp({email:email.trim().toLowerCase(),token:code.trim(),type:'email'});if(error)throw error;setCode('');setSent(false);await loadCloud();setNotice('Signed in. Choose an invitation or share your device profile.');})}>Sign in</Action></>}
 </>:<>
 <Label variant="small">Signed in as {account.email}</Label>
 {invitations.map(v=><Box variant="card" key={v.id}><Label>Invitation to {v.name}</Label><Action disabled={busy} onPress={()=>run(async()=>{const id=await rpc<string>('io_accept',{invitation:v.id});await loadCloud();setCloudId(id);setModal(null);})}>Accept invitation</Action></Box>)}
 {!cloudId?<><Label>Share this inmate’s profile with family. You will become its only admin. Invited members can view all shared records and mark tasks completed or reopen them.</Label><Action disabled={busy||!local?.state.profile.name} onPress={()=>setModal('share')}>Set up shared profile</Action></>:<>
 <Label>{isAdmin?'You are the only admin for this inmate.':'You can view records and update task completion. The admin manages records and family access.'}</Label>
 {team?.members.map(m=><Box variant="card" key={m.id}><Label>{m.email}</Label><Label variant="badge">{m.admin?'ADMIN':'FAMILY MEMBER'}</Label>{isAdmin&&!m.admin&&<Action disabled={busy} tone="quiet" onPress={()=>run(async()=>{await rpc('io_remove_member',{inmate:cloudId,member:m.id});await openFamily();})}>Remove access</Action>}</Box>)}
 {isAdmin&&<><Field label="Family member’s email" value={recipient} onChange={setRecipient}/><Action disabled={busy} onPress={()=>run(async()=>{await rpc('io_invite',{inmate:cloudId,recipient:recipient.trim().toLowerCase()});setRecipient('');await openFamily();setNotice('Invitation ready for 7 days. Ask them to sign in with this email and open Family access. No invitation email has been sent.');})}>Create invitation</Action>
 {team?.invites.map(v=><Box variant="card" key={v.id}><Label>{v.email} · Pending</Label><Label variant="small">Expires {new Date(v.expires).toLocaleDateString('en-AU')}</Label><Action disabled={busy} tone="quiet" onPress={()=>run(async()=>{await rpc('io_revoke_invite',{inmate:cloudId,invitation:v.id});await openFamily();})}>Revoke invitation</Action></Box>)}</>}
 <Label variant="heading">Recent family activity</Label>
 {activity.map(a=><Box key={a.id}><Label>{a.action}</Label><Label variant="small">{a.actor_email} · {new Date(a.created_at).toLocaleString('en-AU')}</Label></Box>)}
 <Action disabled={busy} tone="quiet" onPress={()=>run(openFamily)}>Refresh family activity</Action>
 </>}
 <Action disabled={busy} tone="quiet" onPress={()=>run(async()=>{const {error}=await family!.auth.signOut({scope:'local'});if(error)throw error;setModal(null);})}>Sign out</Action>
 </>}
 {!!error&&<Label variant="error">{error}</Label>}{!!notice&&<Label variant="accent">{notice}</Label>}
 </Sheet>
 <Sheet open={modal==='share'} title="Share this inmate profile?" onClose={()=>!busy&&setModal('family')}>
 <Label>This will upload {local?.state.profile.name}’s profile details and {local?.state.entries.length||0} records to your family account. Only you and family members you invite will have access.</Label>
 <Label variant="small">Your original device profile remains as a separate copy. Changes to that copy will not sync. Attached document files cannot be shared in this version; profiles containing attachments must stay on this device.</Label>
 <Action disabled={busy||!!local?.state.entries.some(e=>e.attachment)} onPress={()=>run(async()=>{
   const state=bookRef.current!.profiles.find(p=>p.id===bookRef.current!.selectedId)!.state;
   const clean:RecordState={...state,entries:state.entries.map(({reminderId,...e})=>e)};
   const id=await rpc<string>('io_create',{payload:clean});await loadCloud();setCloudId(id);setModal(null);setNotice('Shared profile created. Open Family access to invite your family.');
 })}>Upload and become admin</Action>
 {!!error&&<Label variant="error">{error}</Label>}
 </Sheet>
 </>;
}
