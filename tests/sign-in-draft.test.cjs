const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const Module=require('node:module');
const mod=new Module('signInDraft');
mod._compile(ts.transpileModule(fs.readFileSync('src/lib/signInDraft.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,'signInDraft.js');
const {signInDraft:draft}=mod.exports;
test('returning from email retains sign-in step even if response arrives while app is locked',()=>{
 draft.clear();draft.email('family@example.test');
 const unsubscribe=draft.subscribe(()=>{});unsubscribe(); // AppLock unmounts UI
 draft.sent('family@example.test'); // network request completes in background
 assert.deepEqual(draft.snapshot(),{email:'family@example.test',sent:true});
 let notified=false;const cleanup=draft.subscribe(()=>{notified=true;});
 draft.clear();assert.equal(notified,true);
 assert.deepEqual(draft.snapshot(),{email:'',sent:false});cleanup();
});
test('late response for an old email cannot enable a new email sign-in step',()=>{
 draft.email('first@example.test');draft.email('second@example.test');
 draft.sent('first@example.test');assert.equal(draft.snapshot().sent,false);
 draft.sent('second@example.test');assert.equal(draft.snapshot().sent,true);
 draft.clear();
});
