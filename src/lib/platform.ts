import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import * as Files from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import * as Print from 'expo-print';
import {model} from './model';
import {csvCell} from './exportSafety';
import {requestNotificationPermission,scheduleReminder} from './notifications';
const key='insideout.organiser.v1';
const folder=()=> {if(!Files.documentDirectory)throw new Error('Device document storage is unavailable.');return Files.documentDirectory+'insideout-documents/';};
type OrganiserState=ReturnType<typeof model.empty>;
type TimelineFormat='pdf'|'csv';
const safe=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
async function temporaryExport(extension:string,write:(path:string)=>Promise<void>,options:Sharing.SharingOptions){
  if(!Files.cacheDirectory)throw new Error('Export storage unavailable.');
  if(!await Sharing.isAvailableAsync())throw new Error('Sharing is unavailable.');
  const path=Files.cacheDirectory+`inside-out-export-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  try{await write(path);await Sharing.shareAsync(path,options);}
  finally{
    // Android resolves when its chooser closes, before a receiving app necessarily
    // finishes reading. Keep a short grace period, with startup cleanup as fallback.
    if(Platform.OS==='android')setTimeout(()=>{void Files.deleteAsync(path,{idempotent:true}).catch(()=>{});},10*60*1000);
    else await Files.deleteAsync(path,{idempotent:true});
  }
}
export async function cleanOldExports(){
  if(!Files.cacheDirectory)return;
  const names=await Files.readDirectoryAsync(Files.cacheDirectory);
  for(const name of names){
    const recent=/^inside-out-export-([0-9]+)-[a-z0-9]+\.(json|csv|pdf)$/.exec(name);
    if(recent&&Platform.OS==='android'&&Date.now()-Number(recent[1])<10*60*1000)continue;
    if(name==='inside-and-out-backup.json'||/^inside-and-out-timeline-\d{4}-\d{2}-\d{2}\.(csv|pdf)$/.test(name)||recent)await Files.deleteAsync(Files.cacheDirectory+name,{idempotent:true});
  }
}
function timelineHtml(value:OrganiserState){
  const rows=value.entries.map(entry=>`<section class="entry"><div class="meta"><span>${safe(entry.kind)}</span><span>${safe(entry.status)}</span></div><h2>${safe(entry.title)}</h2><p class="when">${safe([model.displayDate(entry.date),entry.time,entry.place].filter(Boolean).join(' | '))}</p>${entry.details?`<p>${safe(entry.details).replace(/\n/g,'<br>')}</p>`:''}</section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:42px 38px 48px}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#173A54;font-size:12px;line-height:1.45}header{border-bottom:4px solid #174F4B;padding-bottom:16px;margin-bottom:20px}h1{font-family:Georgia,serif;font-size:28px;margin:0 0 5px;color:#174F4B}.subtitle{color:#60727E;margin:0}.entry{break-inside:avoid;border:1px solid #DDE8E6;border-radius:10px;padding:14px 16px;margin:0 0 12px;background:#FAFCFB}.meta{display:flex;gap:8px;text-transform:uppercase;font-size:9px;font-weight:700;letter-spacing:.7px;color:#218A84}.meta span+span:before{content:" | ";color:#8AA09C}h2{font-family:Georgia,serif;font-size:17px;margin:5px 0 3px;color:#173A54}.when{color:#60727E;margin:0 0 7px}.empty{padding:24px;background:#F1F7F6;border-radius:10px;color:#60727E}footer{margin-top:22px;padding-top:10px;border-top:1px solid #DDE8E6;color:#71828A;font-size:9px}</style></head><body><header><h1>Inside &amp; Out - Timeline</h1><p class="subtitle">${safe(value.profile.name||'Organiser')} ${value.profile.location?`| ${safe(value.profile.location)}`:''} | Exported ${safe(model.displayDate(model.today()))}</p></header>${rows||'<p class="empty">No records are included in this timeline.</p>'}<footer>Private organiser export. Store and share this file carefully.</footer></body></html>`;
}
export const platform={
  native:true,
  storageNote:'Saved on this device. No cloud sync. App Lock controls access to the app; it does not separately encrypt exported files.',
  async load(){const s=await AsyncStorage.getItem(key);return s?model.parse(s):model.empty();},
  async save(value:ReturnType<typeof model.empty>){await AsyncStorage.setItem(key,JSON.stringify(value));},
  async exportBackup(value:OrganiserState){await temporaryExport('json',path=>Files.writeAsStringAsync(path,JSON.stringify(value,null,2)),{mimeType:'application/json',dialogTitle:'Save your organiser backup'});},
  async exportTimeline(value:OrganiserState,format:TimelineFormat){
    if(!Files.cacheDirectory)throw new Error('Export storage unavailable.');
    if(!await Sharing.isAvailableAsync())throw new Error('Sharing is unavailable.');
    if(format==='csv'){
      const header=['Category','Status','Title','Date','Time','Location','Details'];
      const rows=value.entries.map(entry=>[entry.kind,entry.status,entry.title,model.displayDate(entry.date),entry.time,entry.place,entry.details].map(csvCell).join(','));
      await temporaryExport('csv',path=>Files.writeAsStringAsync(path,'\uFEFF'+[header.map(csvCell).join(','),...rows].join('\r\n')),{mimeType:'text/csv',UTI:'public.comma-separated-values-text',dialogTitle:'Save timeline CSV'});
      return;
    }
    const printed=await Print.printToFileAsync({html:timelineHtml(value)});
    try{await temporaryExport('pdf',path=>Files.copyAsync({from:printed.uri,to:path}),{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Save timeline PDF'});}
    finally{await Files.deleteAsync(printed.uri,{idempotent:true});}
  },
  async pick(){const r=await DocumentPicker.getDocumentAsync({multiple:true,copyToCacheDirectory:true,type:['application/pdf','image/jpeg','image/png','image/heic','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']});return r.canceled?[]:r.assets;},
  async attach(file:any){if(file.size>20*1024*1024)throw new Error('Choose a document smaller than 20 MB.');await Files.makeDirectoryAsync(folder(),{intermediates:true});const name=String(file.name||'document').replace(/[^a-zA-Z0-9._-]/g,'_');const path=folder()+Date.now()+'-'+Math.random().toString(36).slice(2)+'-'+name;await Files.copyAsync({from:file.uri,to:path});return path;},
  async open(uri:string){if(!uri.startsWith(folder()))throw new Error('This attachment is not available on this device.');if(!await Sharing.isAvailableAsync())throw new Error('Document sharing is unavailable.');await Sharing.shareAsync(uri);},
  async removeAttachment(uri:string){if(uri.startsWith(folder()))await Files.deleteAsync(uri,{idempotent:true});},
  async remind(e:ReturnType<typeof model.blank>){const date=model.dateTime(e.date,e.time||'09:00');if(!date||date.getTime()<=Date.now())throw new Error('Choose a future date and time before setting a reminder.');if(!await requestNotificationPermission())throw new Error('Notifications were not allowed. Your record remains saved.');return scheduleReminder('Inside & Out reminder','Open the app to view your scheduled record.',date);},
  async cancelReminder(id:string){await Notifications.cancelScheduledNotificationAsync(id);},
};
