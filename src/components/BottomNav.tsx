import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from './UI';

const items=[
  {key:'Home',label:'Home',icon:'home-outline'},
  {key:'Timeline',label:'Timeline',icon:'clock-outline'},
  {key:'Add',label:'Add',icon:'plus'},
  {key:'Call',label:'Calls',icon:'phone-outline'},
  {key:'More',label:'More',icon:'dots-horizontal'},
];
export default function BottomNav({active='Home',onSelect}:{active?:string;onSelect?:(key:string)=>void}){
 return <View style={s.bar}>{items.map(i=><Pressable accessibilityRole="button" accessibilityLabel={i.label} key={i.key} onPress={()=>onSelect?.(i.key)} style={[s.item,i.key==='Add'&&s.addWrap,i.key===active&&i.key!=='Add'&&s.activePill]}>
   <View style={i.key==='Add'?s.add:undefined}><MaterialCommunityIcons name={i.icon as any} size={i.key==='Add'?27:23} color={i.key===active||i.key==='Add'?colors.teal:'#71828A'} /></View>
   <Text style={[s.label,i.key===active&&s.active,i.key==='Add'&&s.addLabel]}>{i.label}</Text>
 </Pressable>)}</View>
}
const s=StyleSheet.create({bar:{height:74,width:'100%',maxWidth:430,alignSelf:'center',borderTopWidth:1,borderTopColor:'#E1E8E7',backgroundColor:'#FFFEFB',flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:7},item:{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:7,borderRadius:16},label:{fontSize:10.5,color:'#71828A',marginTop:3,fontWeight:'800'},active:{color:colors.teal},activePill:{backgroundColor:'#D9F3F1'},addWrap:{marginTop:-18},add:{width:48,height:48,borderRadius:24,backgroundColor:'#174F4B',alignItems:'center',justifyContent:'center',shadowColor:'#173A54',shadowOpacity:.18,shadowRadius:10,shadowOffset:{width:0,height:4}},addLabel:{marginTop:2}});
