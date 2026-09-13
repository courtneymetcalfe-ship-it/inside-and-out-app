import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Files from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import {model} from './model';
import {requestNotificationPermission,scheduleReminder} from './notifications';
const key='insideout.organiser.v1';
const folder=()=> {if(!Files.documentDirectory)throw new Error('Device document storage is unavailable.');return Files.documentDirectory+'insideout-documents/';};
export const platform={
  native:true,
  storageNote:'Saved on this device. No cloud sync. App Lock controls access to the app; it does not separately encrypt exported files.',
  async load(){const s=await AsyncStorage.getItem(key);return s?model.parse(s):model.empty();},
  async save(value:ReturnType<typeof model.empty>){await AsyncStorage.setItem(key,JSON.stringify(value));},
  async export(value:ReturnType<typeof model.empty>){if(!Files.cacheDirectory)throw new Error('Export storage unavailable.');const path=Files.cacheDirectory+'inside-and-out-backup.json';await Files.writeAsStringAsync(path,JSON.stringify(value,null,2));if(!await Sharing.isAvailableAsync())throw new Error('Sharing is unavailable.');await Sharing.shareAsync(path,{mimeType:'application/json',dialogTitle:'Save your organiser backup'});},
  async pick(){const r=await DocumentPicker.getDocumentAsync({multiple:true,copyToCacheDirectory:true,type:['application/pdf','image/*','text/plain']});return r.canceled?[]:r.assets;},
  async attach(file:any){if(file.size>20*1024*1024)throw new Error('Choose a document smaller than 20 MB.');await Files.makeDirectoryAsync(folder(),{intermediates:true});const name=String(file.name||'document').replace(/[^a-zA-Z0-9._-]/g,'_');const path=folder()+Date.now()+'-'+Math.random().toString(36).slice(2)+'-'+name;await Files.copyAsync({from:file.uri,to:path});return path;},
  async open(uri:string){if(!uri.startsWith(folder()))throw new Error('This attachment is not available on this device.');if(!await Sharing.isAvailableAsync())throw new Error('Document sharing is unavailable.');await Sharing.shareAsync(uri);},
  async removeAttachment(uri:string){if(uri.startsWith(folder()))await Files.deleteAsync(uri,{idempotent:true});},
  async remind(e:ReturnType<typeof model.blank>){const date=model.dateTime(e.date,e.time||'09:00');if(!date||date.getTime()<=Date.now())throw new Error('Choose a future date and time before setting a reminder.');if(!await requestNotificationPermission())throw new Error('Notifications were not allowed. Your record remains saved.');return scheduleReminder('Inside & Out reminder','Open the app to view your scheduled record.',date);},
  async cancelReminder(id:string){await Notifications.cancelScheduledNotificationAsync(id);},
};
