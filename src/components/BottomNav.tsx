import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from './UI';

const items=[
  {key:'home',label:'Home',icon:'⌂',path:'/'},
  {key:'timeline',label:'Timeline',icon:'◷',path:'/timeline'},
  {key:'add',label:'',icon:'+',path:'/timeline'},
  {key:'calls',label:'Calls',icon:'☎',path:'/calls'},
  {key:'more',label:'More',icon:'•••',path:'/more'},
];
export default function BottomNav({active='home'}:{active?:string}){
 return <View style={s.bar}>{items.map(i=><Pressable key={i.key} onPress={()=>router.push(i.path as any)} style={[s.item,i.key==='add'&&s.addWrap]}>
   <View style={i.key==='add'?s.add:undefined}><Text style={[s.icon,i.key===active&&s.active,i.key==='add'&&s.addIcon]}>{i.icon}</Text></View>
   {!!i.label&&<Text style={[s.label,i.key===active&&s.active]}>{i.label}</Text>}
 </Pressable>)}</View>
}
const s=StyleSheet.create({bar:{height:72,borderTopWidth:1,borderTopColor:colors.line,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:4},item:{flex:1,alignItems:'center',justifyContent:'center'},icon:{fontSize:22,color:'#81909A',fontWeight:'700'},label:{fontSize:10,color:'#81909A',marginTop:3,fontWeight:'700'},active:{color:colors.teal},addWrap:{marginTop:-20},add:{width:48,height:48,borderRadius:24,backgroundColor:colors.teal,alignItems:'center',justifyContent:'center',shadowColor:'#000',shadowOpacity:.12,shadowRadius:8,shadowOffset:{width:0,height:4}},addIcon:{color:'#fff',fontSize:30,lineHeight:31}});
