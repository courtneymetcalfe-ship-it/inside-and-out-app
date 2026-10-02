import React,{useState} from 'react';
import * as Linking from 'expo-linking';
import {Action,Box,Label,Sheet} from './Surface';
import {privacySections,privacyUpdated,privacyUrl,supportEmail} from '../lib/privacy';
export default function PrivacyNotice(){
 const [open,setOpen]=useState(false),[error,setError]=useState('');
 async function link(url:string){try{setError('');await Linking.openURL(url);}catch{setError(`Unable to open the link. Contact ${supportEmail}.`);}}
 return <>
 <Action tone="quiet" onPress={()=>setOpen(true)}>Privacy policy & support</Action>
 <Sheet open={open} title="Privacy policy" closeLabel="Done" onClose={()=>setOpen(false)}>
 <Label variant="small">Last updated {privacyUpdated}</Label>
 {privacySections.map(section=><Box key={section.title}><Label variant="heading">{section.title}</Label><Label>{section.body}</Label></Box>)}
 <Action onPress={()=>void link(privacyUrl)}>Open public privacy policy</Action>
 <Action tone="quiet" onPress={()=>void link(`mailto:${supportEmail}`)}>Email support</Action>
 <Label variant="small">{supportEmail}</Label>
 {!!error&&<Label variant="error">{error}</Label>}
 </Sheet>
 </>;
}
