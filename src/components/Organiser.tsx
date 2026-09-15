import React,{useEffect,useRef,useState} from 'react';
import {Image,ImageBackground,Pressable,StyleSheet,Text,View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {model} from '../lib/model';
import {platform} from '../lib/platform';
import {Action,Box,Field,Label,Picker,Shell,Sheet} from './Surface';
import BottomNav from './BottomNav';
type Entry=ReturnType<typeof model.blank>;
type State=ReturnType<typeof model.empty>;
const categories=[
  {page:'Court',icon:'gavel',label:'Court & Legal',tint:'#E8F3F1'},
  {page:'Medical',icon:'heart-pulse',label:'Medical & Safety',tint:'#F5EDE3'},
  {page:'Visit',icon:'account-clock-outline',label:'Visits',tint:'#E8F3F1'},
  {page:'Task',icon:'clipboard-check-outline',label:'Tasks',tint:'#E8F3F1'},
  {page:'Document',icon:'file-document-outline',label:'Documents',tint:'#F5EDE3'},
  {page:'Help',icon:'lifebuoy',label:'Get Help',tint:'#E8F3F1'},
] as const;
const pageTitles:Record<string,string>={Court:'Court & Legal',Medical:'Medical & Safety',Visit:'Visits',Task:'Tasks',Timeline:'Timeline',Document:'Documents',Help:'Get Help',Call:'Calls & Follow-ups',More:'More'};
function displayName(value:string){return value.trim().replace(/\b\w/g,c=>c.toUpperCase());}
function formatDate(date?:string,time?:string){
  if(!date)return '';
  const parts=date.split('-').map(Number); if(parts.length!==3||parts.some(Number.isNaN))return [date,time].filter(Boolean).join(' · ');
  const d=new Date(parts[0],parts[1]-1,parts[2]);
  const day=d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  if(!time)return day;
  const [h,m]=time.split(':').map(Number); const clock=new Date(2000,0,1,h||0,m||0).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}).toLowerCase();
  return `${day} · ${clock}`;
}
const topicNotes:Record<string,string>={
  'Medical treatment':'Record the concern, when it started, who you contacted and their response. Use Medical & Safety to keep the follow-up together.',
  'Court / bail':'Keep hearing notices, dates, matter numbers and solicitor details together. Confirm dates and advice directly with your legal representative.',
  'Safety or assault':'Keep a dated account of what was reported, the source and whom you contacted. Save a follow-up record; recording here does not notify anyone.',
  'Contact and visits':'Keep the centre’s contact details, booking references, visitor approvals and the outcome of each call in your records.',
  'Money / property':'Keep receipts, transaction references and a dated record of any request or response.',
  'Documents':'Keep your original documents and an independent backup. Use the document wallet for copies on this device or browser.',
  'Make a complaint':'Write a factual chronology, the people or service contacted, their response and the outcome you are requesting. Save relevant correspondence.',
  'Preparing for release':'Use visit or note records for transport, accommodation, appointments, medications and contact arrangements that need confirmation.'
};
export default function Organiser({initialPage='Home'}:{initialPage?:string}) {
  const [state,setState]=useState<State>(model.empty()); const current=useRef(state);
  const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false); const writing=useRef(false);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [page,setPage]=useState(initialPage);
  const [filter,setFilter]=useState('All');const [search,setSearch]=useState('');const [edit,setEdit]=useState<Entry|null>(null);
  const [profile,setProfile]=useState<State['profile']|null>(null);const [confirm,setConfirm]=useState<'clear'|Entry|null>(null);
  const [topic,setTopic]=useState('');
  useEffect(()=>{let active=true;platform.load().then(s=>{if(active){current.current=s;setState(s);setReady(true);}}).catch(e=>{if(active)setError('Unable to load saved records: '+e.message);});return()=>{active=false;};},[]);
  async function work(fn:()=>Promise<void>){if(writing.current)return;writing.current=true;setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'The action could not be completed.');}finally{writing.current=false;setBusy(false);}}
  async function commit(s:State){await platform.save(s);current.current=s;setState(s);}
  function go(p:string){setPage(p);setFilter('All');setSearch('');setNotice('');}
  function add(kind=page){setEdit(model.blank(model.kinds.includes(kind)?kind:'Note'));setError('');}
  async function saveEntry(){if(!edit)return;const problem=model.validate(edit);if(problem){setError(problem);return;}await work(async()=>{let item={...edit,title:edit.title.trim()};const old=current.current.entries.find(e=>e.id===item.id);if(old?.reminderId&&(old.date!==item.date||old.time!==item.time||item.status==='Completed')){await platform.cancelReminder(old.reminderId);item.reminderId=undefined;}await commit({...current.current,entries:[...current.current.entries.filter(e=>e.id!==item.id),item]});setEdit(null);setNotice('Record saved.');});}
  async function deleteConfirmed(){await work(async()=>{if(confirm==='clear'){for(const e of current.current.entries){if(e.reminderId)await platform.cancelReminder(e.reminderId);if(e.attachment)await platform.removeAttachment(e.attachment);}await commit(model.empty());setNotice('Organiser data cleared.');}else if(confirm){if(confirm.reminderId)await platform.cancelReminder(confirm.reminderId);if(confirm.attachment)await platform.removeAttachment(confirm.attachment);await commit({...current.current,entries:current.current.entries.filter(e=>e.id!==confirm.id)});setNotice('Record removed.');}setConfirm(null);});}
  async function attach(files:any[]){await work(async()=>{for(const file of files){const attachment=await platform.attach(file);const entry={...model.blank('Document'),title:String(file.name||'Document').slice(0,200),status:'Completed',attachment};try{await commit({...current.current,entries:[...current.current.entries,entry]});}catch(e){await platform.removeAttachment(attachment);throw e;}}setNotice('Document copies saved here.');});}
  const entries=model.sort(state.entries);
  const visible=entries.filter(e=>(page==='Timeline'||e.kind===page)&&(filter==='All'||e.kind===filter||e.status===filter)&&`${e.title} ${e.place} ${e.details}`.toLowerCase().includes(search.toLowerCase()));
  const issues=entries.filter(e=>['Follow up','Missing','Not confirmed'].includes(e.status));
  const court=model.next(state,'Court');const visit=model.next(state,'Visit');
  const nav=<BottomNav active={page} onSelect={p=>p==='Add'?add('Note'):go(p)}/>;
  if(!ready)return <Shell nav={null}><Label variant="title">Inside & Out</Label><Label>{error||'Loading your organiser…'}</Label></Shell>;
  return <Shell nav={nav}>
    <View style={ui.header}>
      <View style={ui.brandRow}>
        <Image source={require('../../assets/inside-out-door.png')} style={ui.logo}/>
        <View style={ui.brandCopy}><Text style={ui.brand}>{page==='Home'?'Inside & Out':pageTitles[page]||page}</Text><Text style={ui.tagline}>{page==='Home'?'Organise · Stay informed · Feel supported':'Your family organiser'}</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Profile settings" style={ui.profileButton} onPress={()=>setProfile({...state.profile})}><MaterialCommunityIcons name="cog-outline" size={22} color="#174F4B"/></Pressable>
    </View>
    {state.demo&&<Box variant="alert"><Label variant="badge">SAMPLE DATA</Label><Label variant="small">These are fictional examples. Clear sample data in More before adding personal records.</Label></Box>}
    {!!error&&<Label variant="error">{error}</Label>}{!!notice&&<Label variant="accent">{notice}</Label>}
    {page==='Home'&&<>
      <ImageBackground source={require('../../assets/inside-out-mountains.png')} imageStyle={ui.welcomeImage} style={ui.welcome}>
        <View style={ui.welcomeCopy}><Text style={ui.eyebrow}>YOUR ORGANISER</Text><Text style={ui.welcomeTitle}>{state.profile.name?`Good morning, ${displayName(state.profile.name).split(' ')[0]}`:'A clearer path forward'}</Text><Text style={ui.quote}>Small steps keep bigger futures possible.</Text></View>
      </ImageBackground>
      <Pressable accessibilityRole="button" onPress={()=>setProfile({...state.profile})} style={ui.profileStrip}>
        <View style={ui.avatar}><Text style={ui.avatarText}>{state.profile.name?displayName(state.profile.name).split(' ').map(n=>n[0]).join('').slice(0,2):'IO'}</Text></View>
        <View style={ui.profileCopy}><Text style={ui.profileName}>{state.profile.name?displayName(state.profile.name):'Add a profile'}</Text><Text numberOfLines={1} style={ui.profileMeta}>{[state.profile.min&&`MIN ${state.profile.min}`,state.profile.location?.trim()].filter(Boolean).join('  •  ')||'Keep key details together'}</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#60727E"/>
      </Pressable>
      {issues.length>0&&<Box variant="alert"><Label variant="badge">NEEDS FOLLOW-UP · {issues.length}</Label><Label variant="heading">{issues[0].title}</Label><Label variant="small">{issues[0].date} · {issues[0].status}</Label><Action tone="quiet" onPress={()=>{go(issues[0].kind);setEdit({...issues[0]});}}>View record</Action></Box>}
      <View style={ui.sectionHead}><Text style={ui.sectionTitle}>Everything you need</Text><Text style={ui.sectionHint}>All in one place</Text></View>
      <View style={ui.tileGrid}>{categories.map(item=><Pressable accessibilityRole="button" key={item.page} onPress={()=>go(item.page)} style={[ui.tile,{backgroundColor:item.tint}]}><View style={ui.tileIcon}><MaterialCommunityIcons name={item.icon as any} size={27} color="#174F4B"/></View><Text style={ui.tileLabel}>{item.label}</Text><Text style={ui.tileHint}>{item.page==='Document'?`${entries.filter(e=>e.kind==='Document').length} saved`:item.page==='Task'?`${entries.filter(e=>e.kind==='Task'&&e.status!=='Completed').length} open`:'Open'}</Text></Pressable>)}</View>
      <View style={ui.sectionHead}><Text style={ui.sectionTitle}>Upcoming</Text><Pressable onPress={()=>go('Timeline')}><Text style={ui.seeAll}>See all</Text></Pressable></View>
      <View style={ui.upcomingCard}>
        {[
          {label:'Court date',value:court?formatDate(court.date,court.time):'No upcoming date',page:'Court',icon:'gavel'},
          {label:'Next visit',value:visit?formatDate(visit.date,visit.time):'No upcoming visit',page:'Visit',icon:'account-clock-outline'},
          {label:'Follow-ups',value:issues.length?`${issues.length} item${issues.length===1?'':'s'} need attention`:'You’re up to date',page:'Timeline',icon:'check-circle-outline'}
        ].map((item,index)=><Pressable accessibilityRole="button" key={item.label} onPress={()=>go(item.page)} style={[ui.upcomingRow,index>0&&ui.upcomingBorder]}><View style={ui.upcomingIcon}><MaterialCommunityIcons name={item.icon as any} size={21} color="#218A84"/></View><View style={ui.upcomingCopy}><Text style={ui.upcomingLabel}>{item.label}</Text><Text style={ui.upcomingValue}>{item.value}</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color="#7B8B91"/></Pressable>)}
      </View>
      {!entries.length&&!state.profile.name&&<Action tone="quiet" disabled={busy} onPress={()=>work(async()=>{await commit(model.sample());})}>Explore sample records</Action>}
    </>}
    {(model.kinds.includes(page)||page==='Timeline')&&<>
      {page==='Task'&&<Label variant="small">Keep important follow-ups and things to do together. Mark each task completed when it is finished.</Label>}
      {page==='Medical'&&<Label variant="small">Record medications, conditions and incidents. Notes are not sent to a clinician or emergency service.</Label>}
      {page==='Court'&&<Label variant="small">Keep matter numbers, charges as entered, solicitor details and bail preparation notes with each court record.</Label>}
      {page==='Visit'&&<Label variant="small">Keep visitor names, approval status, booking references and transport notes together. Adding a record does not book a visit.</Label>}
      {page==='Document'?<><Label variant="small">Copies stay on this device or browser. JSON exports contain record metadata, not the document files. Keep original documents separately.</Label>{platform.native?<Action disabled={busy} onPress={()=>platform.pick().then(attach).catch(e=>setError(e.message))}>Choose documents</Action>:<Picker disabled={busy} onPick={attach}/>}</>:<Action tone={page==='Medical'?'danger':'teal'} disabled={busy} onPress={()=>add()}>+ {page==='Medical'?'Add medication, condition or incident':page==='Timeline'?'Add event':page==='Task'?'Add task':'Add record'}</Action>}
      <Field label="Search records" value={search} onChange={setSearch} placeholder="Title, location or notes"/>
      <Box variant="grid">{(page==='Timeline'?['All',...model.kinds]:['All','Follow up','Completed']).map(t=><Action key={t} tone={filter===t?'selected':'quiet'} onPress={()=>setFilter(t)}>{t}</Action>)}</Box>
      {visible.length===0&&<Box variant="card"><Label variant="heading">{entries.some(e=>page==='Timeline'||e.kind===page)?'No matching records':'Nothing saved yet'}</Label><Label variant="small">{search?'Try another search.':'Add a record to begin. Your saved entries will appear here.'}</Label></Box>}
      {visible.map(e=><Box variant="card" key={e.id}><Label variant="badge">{e.kind} · {e.status}</Label><Label variant="heading">{e.title}</Label><Label variant="small">{formatDate(e.date,e.time)}{e.place?' · '+e.place:''}</Label>{!!e.details&&<Label>{e.details}</Label>}<Box variant="row"><Action tone="quiet" disabled={busy} onPress={()=>{setError('');setEdit({...e});}}>Edit</Action>{e.attachment&&<Action tone="quiet" disabled={busy} onPress={()=>work(async()=>{await platform.open(e.attachment!);})}>Open / share</Action>}<Action tone="quiet" disabled={busy} onPress={()=>setConfirm(e)}>Delete</Action></Box>{platform.native&&e.kind!=='Document'&&e.status!=='Completed'&&<Action tone="quiet" disabled={busy} onPress={()=>work(async()=>{if(e.reminderId){await platform.cancelReminder(e.reminderId);await commit({...current.current,entries:current.current.entries.map(x=>x.id===e.id?{...x,reminderId:undefined}:x)});setNotice('Reminder cancelled.');}else{const id=await platform.remind(e);try{await commit({...current.current,entries:current.current.entries.map(x=>x.id===e.id?{...x,reminderId:id}:x)});}catch(error){await platform.cancelReminder(id);throw error;}setNotice('Reminder scheduled for '+formatDate(e.date,e.time)+'.');}})}>{e.reminderId?'Cancel reminder':'Remind me at this time'}</Action>}</Box>)}
      {page==='Timeline'&&<Action tone="quiet" disabled={busy} onPress={()=>work(async()=>{await platform.export({...state,entries:visible});})}>Export displayed timeline</Action>}
    </>}
    {page==='Help'&&<><Label variant="heading">What do you need help with?</Label><Box variant="grid">{Object.keys(topicNotes).map(t=><Action key={t} tone="tile" onPress={()=>setTopic(t)}>{t}</Action>)}</Box><Box variant="card"><Label variant="heading">Keep a clear record</Label><Label>Save dates, documents and the outcome of each call so your next conversation is easier.</Label><Action tone="teal" onPress={()=>{go('Note');add('Note');}}>Write a note</Action></Box></>}
    {page==='More'&&<><Box variant="card"><Label variant="heading">Your data</Label><Label>{platform.storageNote}</Label>{!platform.native&&<Label variant="small">This browser version has no app lock. Use a private device. Clearing browser data can remove saved records and files. Native Face ID and reminders are only in the mobile build.</Label>}<Action disabled={busy} onPress={()=>work(async()=>{await platform.export(state);})}>Export organiser backup</Action><Action disabled={busy} tone="danger" onPress={()=>setConfirm('clear')}>{state.demo?'Clear sample data':'Delete organiser data'}</Action></Box><Box variant="card"><Label variant="heading">About Inside & Out</Label><Label>A family organiser for court, medical, visits, calls and documents.</Label><Label variant="small">Mobile and Floot records are separate. There are no user accounts, automatic family sharing or live government feeds in this version.</Label></Box></>}
    <Label variant="small">Organisational tools only. Not connected to Corrective Services, courts, hospitals or emergency services. For urgent help, contact the relevant service directly.</Label>
    <Sheet open={!!edit} title={edit&&entries.some(e=>e.id===edit.id)?'Edit record':'Add record'} onClose={()=>{if(!busy)setEdit(null);}}>{edit&&<><Label variant="small">Category</Label><Box variant="grid">{model.kinds.filter(k=>edit.attachment?k==='Document':k!=='Document').map(k=><Action key={k} tone={edit.kind===k?'selected':'quiet'} disabled={busy} onPress={()=>setEdit({...edit,kind:k})}>{k}</Action>)}</Box><Field label={edit.kind==='Medical'?'Medication, condition or incident':'Title'} value={edit.title} onChange={title=>setEdit({...edit,title})}/><Field label="Date (YYYY-MM-DD)" placeholder="2026-09-12" value={edit.date} onChange={date=>setEdit({...edit,date})}/><Field label="Time (HH:MM, 24-hour, optional)" placeholder="09:30" value={edit.time} onChange={time=>setEdit({...edit,time})}/><Field label="Location / organisation" value={edit.place} onChange={place=>setEdit({...edit,place})}/><Field label={edit.kind==='Medical'?'Dose, frequency, source and notes':'Details, contacts and reference numbers'} multiline value={edit.details} onChange={details=>setEdit({...edit,details})}/><Label variant="small">Status</Label><Box variant="grid">{model.statuses.map(status=><Action key={status} tone={edit.status===status?'selected':'quiet'} onPress={()=>setEdit({...edit,status})}>{status}</Action>)}</Box>{!!error&&<Label variant="error">{error}</Label>}<Action disabled={busy} tone="teal" onPress={saveEntry}>{busy?'Saving…':'Save record'}</Action></>}</Sheet>
    <Sheet open={!!profile} title="Profile" onClose={()=>{if(!busy)setProfile(null);}}>{profile&&<><Field label="Name" value={profile.name} onChange={name=>setProfile({...profile,name})}/><Field label="MIN (optional)" value={profile.min} onChange={min=>setProfile({...profile,min})}/><Field label="Location" value={profile.location} onChange={location=>setProfile({...profile,location})}/>{!!error&&<Label variant="error">{error}</Label>}<Action disabled={busy} onPress={()=>work(async()=>{await commit({...current.current,profile});setProfile(null);setNotice('Profile saved.');})}>Save profile</Action></>}</Sheet>
    <Sheet open={!!confirm} title="Confirm deletion" onClose={()=>{if(!busy)setConfirm(null);}}><Label>{confirm==='clear'?'Delete your organiser profile, records and attached copies here? This cannot be undone. Save a backup and original documents first. Your native app-lock credentials are kept.':'Delete this record and its attached copy? This cannot be undone.'}</Label>{!!error&&<Label variant="error">{error}</Label>}<Action tone="danger" disabled={busy} onPress={deleteConfirmed}>Delete permanently</Action></Sheet>
    <Sheet open={!!topic} title={topic||'Help'} onClose={()=>setTopic('')}><Label>{topicNotes[topic]}</Label><Action onPress={()=>{setTopic('');go('Note');add('Note');}}>Add a note</Action></Sheet>
  </Shell>;
}

const ui=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},brandRow:{flexDirection:'row',alignItems:'center',gap:11,flex:1},logo:{width:48,height:48,borderRadius:14},brandCopy:{flex:1},brand:{fontFamily:'Georgia',fontSize:27,fontWeight:'700',color:'#173A54',letterSpacing:-.5},tagline:{marginTop:2,fontSize:10.5,fontWeight:'800',letterSpacing:.45,textTransform:'uppercase',color:'#60727E'},profileButton:{width:43,height:43,borderRadius:22,backgroundColor:'#E8F3F1',alignItems:'center',justifyContent:'center'},
  welcome:{minHeight:145,borderRadius:25,padding:21,backgroundColor:'#E8F1EC',justifyContent:'center',overflow:'hidden'},welcomeImage:{borderRadius:25,opacity:.68},welcomeCopy:{width:'82%'},eyebrow:{fontSize:10.5,fontWeight:'900',letterSpacing:1.4,color:'#59766C'},welcomeTitle:{fontFamily:'Georgia',fontSize:27,lineHeight:32,fontWeight:'700',color:'#173A54',marginTop:6},quote:{fontFamily:'Georgia',fontStyle:'italic',fontSize:14,lineHeight:20,color:'#536A70',marginTop:8},
  profileStrip:{backgroundColor:'#FFFEFB',borderWidth:1,borderColor:'#E1E8E7',borderRadius:19,padding:13,flexDirection:'row',alignItems:'center',gap:12},avatar:{width:42,height:42,borderRadius:21,backgroundColor:'#174F4B',alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontWeight:'900',fontSize:13},profileCopy:{flex:1},profileName:{fontSize:15.5,fontWeight:'900',color:'#173A54'},profileMeta:{fontSize:12.5,color:'#60727E',marginTop:3},
  sectionHead:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',marginTop:2},sectionTitle:{fontFamily:'Georgia',fontSize:21,fontWeight:'700',color:'#173A54'},sectionHint:{fontSize:12,color:'#71828A'},seeAll:{fontSize:13,fontWeight:'800',color:'#218A84'},tileGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},tile:{width:'31%',minHeight:116,borderRadius:19,paddingHorizontal:10,paddingVertical:13,alignItems:'center',justifyContent:'center'},tileIcon:{width:42,height:42,borderRadius:21,backgroundColor:'rgba(255,255,255,.65)',alignItems:'center',justifyContent:'center',marginBottom:8},tileLabel:{fontSize:13,fontWeight:'900',lineHeight:16,color:'#173A54',textAlign:'center'},tileHint:{fontSize:10.5,color:'#6C7C82',marginTop:4},
  upcomingCard:{backgroundColor:'#FFFEFB',borderWidth:1,borderColor:'#E1E8E7',borderRadius:22,paddingHorizontal:15},upcomingRow:{flexDirection:'row',alignItems:'center',paddingVertical:14,gap:11},upcomingBorder:{borderTopWidth:1,borderTopColor:'#E7ECEA'},upcomingIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#E6F4F2',alignItems:'center',justifyContent:'center'},upcomingCopy:{flex:1},upcomingLabel:{fontSize:11.5,color:'#647680',fontWeight:'700'},upcomingValue:{fontSize:14.5,lineHeight:20,color:'#173A54',fontWeight:'800',marginTop:2}
});
