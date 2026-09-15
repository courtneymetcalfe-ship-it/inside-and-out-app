type Entry = { id:string; kind:string; title:string; date:string; time:string; place:string; details:string; status:string; attachment?:string; reminderId?:string };
type State = { version:1; demo:boolean; profile:{name:string; min:string; location:string}; entries:Entry[] };
const kinds = ['Court','Medical','Visit','Call','Note','Task','Document'];
const statuses = ['Planned','Follow up','Completed','Receiving','Not confirmed','Missing'];
const empty = ():State => ({version:1,demo:false,profile:{name:'',min:'',location:''},entries:[]});
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const blank = (kind='Note'):Entry => ({id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,kind,title:'',date:today(),time:'',place:'',details:'',status:'Planned'});
function dateTime(date:string,time='12:00') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)) return null;
  const [y,m,d]=date.split('-').map(Number); const [h,n]=time.split(':').map(Number);
  const value=new Date(y,m-1,d,h,n);
  return value.getFullYear()===y&&value.getMonth()===m-1&&value.getDate()===d&&h<24&&n<60 ? value : null;
}
function validate(e:Entry) {
  if(!kinds.includes(e.kind)) return 'Choose a record category.';
  if(!e.title.trim()) return 'Enter a title.';
  if(e.title.length>200||e.details.length>10000) return 'Use a shorter title or notes.';
  if(!dateTime(e.date,e.time||'12:00')) return 'Use a valid date (YYYY-MM-DD) and time (HH:MM, 24-hour).';
  if(!statuses.includes(e.status)) return 'Choose a status.';
  return '';
}
function parse(raw:string):State {
  const x=JSON.parse(raw);
  if(x?.version!==1 || typeof x.demo!=='boolean' || !x.profile || !['name','min','location'].every(k=>typeof x.profile[k]==='string') || !Array.isArray(x.entries)) throw new Error('This data file is not a supported Inside & Out backup.');
  if(x.entries.some((e:any)=>!e || !['id','kind','title','date','time','place','details','status'].every(k=>typeof e[k]==='string') || validate(e) || (e.attachment!==undefined&&typeof e.attachment!=='string') || (e.reminderId!==undefined&&typeof e.reminderId!=='string'))) throw new Error('A record in this data file is invalid.');
  if(new Set(x.entries.map((e:Entry)=>e.id)).size!==x.entries.length) throw new Error('Duplicate record IDs in this data file.');
  return x;
}
const sort = (items:Entry[]) => [...items].sort((a,b)=>`${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
function next(state:State,kind:string) { return [...state.entries].filter(e=>e.kind===kind&&e.status!=='Completed'&&e.date>=today()).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0]; }
function sample():State { const x=empty(); x.demo=true; x.profile={name:'Demo profile',min:'Example only',location:'NSW correctional centre'}; x.entries=[{...blank('Court'),title:'Court mention',place:'Example Local Court',time:'09:30',details:'Sample record. Add the matter and solicitor details here.'},{...blank('Medical'),title:'Medication follow-up',status:'Follow up',details:'Sample concern to discuss with the treating team.'},{...blank('Visit'),title:'Family visit',time:'13:00',details:'Sample booking. Confirm approval and booking details with the centre.'}]; return x; }
export const model={kinds,statuses,empty,blank,today,dateTime,validate,parse,sort,next,sample};
