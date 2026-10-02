import 'react-native-url-polyfill/auto';
import {createClient,processLock} from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import {File} from 'expo-file-system';
import * as Linking from 'expo-linking';
import {AppState,Platform} from 'react-native';
import {model} from './model';
import type {RecordState,RecordSource} from './profiles';

const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// The mobile bundle must never contain a service-role/secret key.
export const familyConfigured=Boolean(url?.startsWith('https://')&&key?.startsWith('sb_publishable_'));
const storage={
  getItem:(k:string)=>SecureStore.getItemAsync(k),
  setItem:(k:string,v:string)=>SecureStore.setItemAsync(k,v,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),
  removeItem:(k:string)=>SecureStore.deleteItemAsync(k),
};
export const family=familyConfigured?createClient(url!,key!,{auth:{
  ...(Platform.OS==='web'?{}:{storage}),persistSession:Platform.OS!=='web',
  autoRefreshToken:true,detectSessionInUrl:false,lock:processLock,
}}):null;
if(family&&Platform.OS!=='web')AppState.addEventListener('change',s=>{
  if(s==='active')family.auth.startAutoRefresh();else family.auth.stopAutoRefresh();
});
export type SharedProfile={id:string;admin_id:string;name:string};
export async function rpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{
  if(!family)throw new Error('Family sharing is not connected yet. Your device profiles still work.');
  const {data,error}=await family.rpc(name,args);
  if(error)throw new Error(error.message);
  return data as T;
}
export async function sharedProfiles():Promise<SharedProfile[]>{
  if(!family)return [];
  const {data,error}=await family.from('io_inmates').select('id,admin_id,name').order('name');
  if(error)throw new Error(error.message);return data||[];
}
export function cloudSource(id:string,admin:boolean):RecordSource {
  async function load(){
    const result=await rpc<{state:RecordState;revision:number}>('io_read',{inmate:id});
    const parsed=model.parse(JSON.stringify(result.state));return {...parsed,cloudRevision:result.revision};
  }
  function objectPath(path:string){
    if(!path.startsWith(`io-files/${id}/`))throw new Error('This file does not belong to the selected profile.');
    return path.slice('io-files/'.length);
  }
  return {shared:true,admin,load,
    async attach(file){
      if(!admin)throw new Error('Only the profile admin can upload files.');
      const limit=20*1024*1024;
      if(file.size>limit)throw new Error('Choose a file smaller than 20 MB.');
      const contentType=file.mimeType||file.type||'application/octet-stream';
      const allowed=['application/pdf','image/jpeg','image/png','image/heic','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if(!allowed.includes(contentType))throw new Error('Choose a PDF, Word document, text file, JPG, PNG or HEIC image.');
      const bytes=Platform.OS==='web'?(file.file?await file.file.arrayBuffer():await fetch(file.uri).then(r=>r.arrayBuffer())):await new File(file.uri).arrayBuffer();
      if(bytes.byteLength>limit||!bytes.byteLength)throw new Error('Choose a non-empty file smaller than 20 MB.');
      const name=String(file.name||'document').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120);
      const path=`${id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`;
      const {error}=await family!.storage.from('io-files').upload(path,bytes,{contentType,upsert:false});
      if(error)throw new Error(error.message);return `io-files/${path}`;
    },
    async openAttachment(path){
      const {data,error}=await family!.storage.from('io-files').createSignedUrl(objectPath(path),60,{download:true});
      if(error)throw new Error(error.message);await Linking.openURL(data.signedUrl);
    },
    async removeAttachment(path){
      const {error}=await family!.storage.from('io-files').remove([objectPath(path)]);
      if(error)throw new Error(error.message);
    },
    subscribe(onChange){
      const channel=family!.channel(`inmate-${id}-${Math.random()}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'io_inmates',filter:`id=eq.${id}`},onChange).subscribe();
      return ()=>{void family!.removeChannel(channel);};
    },
    async save(state){
      // Never expose private device paths or reminder identifiers to other users.
      if(state.entries.some(e=>e.attachment&&!e.attachment.startsWith(`io-files/${id}/`)))throw new Error('A file belongs to a different profile or is only saved on this device.');
      const {cloudRevision,...base}=state;
      const clean={...base,entries:state.entries.map(({reminderId,...e})=>e)};
      const result=await rpc<number>('io_save',{inmate:id,expected:cloudRevision,payload:clean});state.cloudRevision=result;
    },
    async completeTask(entryId,completed,revision){
      await rpc('io_task_status',{inmate:id,entry_id:entryId,completed,expected:revision});return load();
    },
  };
}
