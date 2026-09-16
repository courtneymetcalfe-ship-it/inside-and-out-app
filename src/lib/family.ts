import 'react-native-url-polyfill/auto';
import {createClient,processLock} from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
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
  return {shared:true,admin,load,
    subscribe(onChange){
      const channel=family!.channel(`inmate-${id}-${Math.random()}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'io_inmates',filter:`id=eq.${id}`},onChange).subscribe();
      return ()=>{void family!.removeChannel(channel);};
    },
    async save(state){
      // Never expose private device paths or reminder identifiers to other users.
      if(state.entries.some(e=>e.attachment))throw new Error('Shared document uploads are not available yet. Keep document copies in a device profile.');
      const {cloudRevision,...base}=state;
      const clean={...base,entries:state.entries.map(({reminderId,...e})=>e)};
      const result=await rpc<number>('io_save',{inmate:id,expected:cloudRevision,payload:clean});state.cloudRevision=result;
    },
    async completeTask(entryId,completed,revision){
      await rpc('io_task_status',{inmate:id,entry_id:entryId,completed,expected:revision});return load();
    },
  };
}
