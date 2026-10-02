// AppLock unmounts the organiser when backgrounded. Keep only the email and
// code-entry step in memory across that remount; never retain the OTP itself.
type Draft = {email: string; sent: boolean};
let draft: Draft = {email:'',sent:false};
const listeners = new Set<()=>void>();
function update(next: Draft){draft=next;listeners.forEach(listener=>listener());}
export const signInDraft = {
  snapshot:()=>draft,
  subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},
  email:(email:string)=>update({email,sent:false}),
  sent:(email:string)=>{if(draft.email.trim().toLowerCase()===email)update({...draft,sent:true});},
  clear:()=>update({email:'',sent:false}),
};
