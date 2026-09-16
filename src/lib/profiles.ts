import {model} from './model';
export type RecordState = ReturnType<typeof model.empty>;
export type LocalProfile = {id:string; state:RecordState};
export type ProfileBook = {version:2; selectedId:string; profiles:LocalProfile[]};
export function migrateProfile(legacy:RecordState):ProfileBook {
  return {version:2,selectedId:'original',profiles:[{id:'original',state:legacy}]};
}
export function parseBook(raw:string):ProfileBook {
  const x=JSON.parse(raw);
  if(x?.version!==2||!Array.isArray(x.profiles)||!x.profiles.length)throw new Error('Invalid profile storage. Your original records have not been changed.');
  const ids=new Set<string>();
  for(const p of x.profiles){
    if(typeof p.id!=='string'||!p.id||ids.has(p.id))throw new Error('Invalid profile identifier.');
    ids.add(p.id);p.state=model.parse(JSON.stringify(p.state));
  }
  if(!ids.has(x.selectedId))throw new Error('The selected profile could not be found.');
  return x;
}
export function replaceProfile(book:ProfileBook,id:string,state:RecordState):ProfileBook {
  if(!book.profiles.some(p=>p.id===id))throw new Error('Profile no longer exists.');
  return {...book,profiles:book.profiles.map(p=>p.id===id?{...p,state}:p)};
}
export function addProfile(book:ProfileBook,id:string,name:string):ProfileBook {
  if(!name.trim())throw new Error('Enter the inmate’s name.');
  if(book.profiles.some(p=>p.id===id))throw new Error('Profile identifier already exists.');
  return {...book,selectedId:id,profiles:[...book.profiles,{id,state:{...model.empty(),profile:{name:name.trim(),min:'',location:''}}}]};
}
export type RecordSource = {
  shared:boolean; admin:boolean;
  load:()=>Promise<RecordState>;
  save:(state:RecordState)=>Promise<void>;
  subscribe?:(onChange:()=>void)=>()=>void;
  completeTask?:(id:string,completed:boolean,revision?:number)=>Promise<RecordState>;
};
