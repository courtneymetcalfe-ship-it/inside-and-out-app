const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks={},extra={}){
 const exports={};
 const js=ts.transpileModule(fs.readFileSync(`src/lib/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports,require:name=>{if(!(name in mocks))throw Error(`Unexpected import ${name}`);return mocks[name];},...extra});
 return exports;
}
function pinHarness(){
 const data=new Map();let now=1000000;let failWrites=false;
 const store={WHEN_UNLOCKED_THIS_DEVICE_ONLY:'device-only',getItemAsync:async k=>data.get(k)||null,setItemAsync:async(k,v)=>{if(failWrites)throw Error('Locked keychain');data.set(k,v);}};
 const reload=()=>load('secure',{'expo-secure-store':store},{Date:{now:()=>now}});
 return {data,reload,advance:ms=>now+=ms,failWrites:()=>failWrites=true};
}
test('PIN delays persist across restart, increase, and reset after successful unlock',async()=>{
 const h=pinHarness();let secure=h.reload();await secure.setPasscode('123456');
 for(let i=0;i<4;i++)assert.equal(await secure.verifyPasscode('000000'),false);
 await assert.rejects(secure.verifyPasscode('000000'),/30 seconds/);
 secure=h.reload();await assert.rejects(secure.verifyPasscode('123456'),/30 seconds/);
 h.advance(30000);await assert.rejects(secure.verifyPasscode('000000'),/60 seconds/);
 h.advance(60000);assert.equal(await secure.verifyPasscode('123456'),true);
 assert.equal(await secure.verifyPasscode('000000'),false);
 assert.equal(JSON.parse(h.data.get('insideout_pin_attempts_v1')).failures,1);
});
test('concurrent PIN attempts cannot bypass the persisted limit',async()=>{
 const h=pinHarness(),secure=h.reload();await secure.setPasscode('123456');
 const results=await Promise.allSettled(Array.from({length:20},()=>secure.verifyPasscode('000000')));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,4);
 assert.equal(JSON.parse(h.data.get('insideout_pin_attempts_v1')).failures,5);
});
test('PIN checks fail closed for corrupt state or unavailable secure storage',async()=>{
 const h=pinHarness(),secure=h.reload();await secure.setPasscode('123456');
 h.data.set('insideout_pin_attempts_v1','{"failures":-1,"until":0}');
 await assert.rejects(secure.verifyPasscode('123456'),/Invalid PIN/);
 await secure.resetPinAttempts();h.failWrites();
 await assert.rejects(secure.verifyPasscode('123456'),/Locked keychain/);
});
test('CSV neutralises formulas and still escapes ordinary quotes',()=>{
 const {csvCell}=load('exportSafety');
 for(const value of ['=1+1','+SUM(A1)','-1+2','@SUM(A1)','  =1+1','\tformula','\rformula','\nformula','\u0000=1+1'])assert.ok(csvCell(value).startsWith('"\''),JSON.stringify(value));
 assert.equal(csvCell('A "quoted", title'),'"A ""quoted"", title"');
 assert.equal(csvCell('02-10-2026'),'"02-10-2026"');
 assert.equal(csvCell(null),'""');
});
function exportHarness(os='ios'){
 const files=new Map(),timers=[];let sharingError=false;
 const filesystem={cacheDirectory:'cache/',documentDirectory:'docs/',writeAsStringAsync:async(p,v)=>files.set(p,v),copyAsync:async({from,to})=>files.set(to,files.get(from)),deleteAsync:async p=>files.delete(p),readDirectoryAsync:async()=>[...files.keys()].filter(p=>p.startsWith('cache/')).map(p=>p.slice(6))};
 const sharing={isAvailableAsync:async()=>true,shareAsync:async p=>{assert.ok(files.has(p));if(sharingError)throw Error('Share failed');}};
 const model=load('model').model;
 const api=load('platform',{'@react-native-async-storage/async-storage':{},'react-native':{Platform:{OS:os}},'expo-file-system/legacy':filesystem,'expo-document-picker':{},'expo-sharing':sharing,'expo-notifications':{},'expo-print':{printToFileAsync:async()=>{files.set('cache/printed.pdf','pdf');return {uri:'cache/printed.pdf'};}},'./model':{model},'./exportSafety':load('exportSafety'),'./notifications':{}},{setTimeout:fn=>timers.push(fn)});
 return {...api,files,timers,state:model.empty(),failSharing:()=>sharingError=true};
}
test('iOS exports remove temporary JSON, CSV and both PDF copies after sharing',async()=>{
 const h=exportHarness();await h.platform.exportBackup(h.state);assert.equal(h.files.size,0);
 await h.platform.exportTimeline(h.state,'csv');assert.equal(h.files.size,0);
 await h.platform.exportTimeline(h.state,'pdf');assert.equal(h.files.size,0);
 h.failSharing();await assert.rejects(h.platform.exportBackup(h.state),/Share failed/);assert.equal(h.files.size,0);
});
test('startup cleans only known exports, leaving documents and unrelated cache untouched',async()=>{
 const h=exportHarness();
 for(const p of ['cache/inside-and-out-backup.json','cache/inside-and-out-timeline-2026-10-02.pdf','cache/inside-out-export-100-abc.csv','cache/unrelated.pdf','docs/private.pdf'])h.files.set(p,'data');
 await h.cleanOldExports();assert.deepEqual([...h.files.keys()],['cache/unrelated.pdf','docs/private.pdf']);
});
test('Android allows receiver grace period and cleans stale exports on restart',async()=>{
 const h=exportHarness('android');await h.platform.exportBackup(h.state);assert.equal(h.files.size,1);
 await h.cleanOldExports();assert.equal(h.files.size,1);
 h.files.set('cache/inside-out-export-100-abc.json','old');await h.cleanOldExports();assert.equal(h.files.size,1);
 h.timers[0]();await Promise.resolve();assert.equal(h.files.size,0);
});
