import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const colors={
  navy:'#173A54', navy2:'#102E43', teal:'#174F4B', aqua:'#D9F3F1',
  blue:'#4B8DC6', purple:'#8F7AC8', purpleSoft:'#F1ECFB', green:'#63A979',
  greenSoft:'#EAF6EE', red:'#D95F70', danger:'#D95F70', redSoft:'#FDECEF', orange:'#E6A44D',
  orangeSoft:'#FFF4E5', ink:'#183143', muted:'#6F7D87', line:'#E7ECEF',
  bg:'#FAF8F3', soft:'#F2F5F3'
};
export function Card({children,style}:{children:React.ReactNode;style?:any}) { return <View style={[s.card,style]}>{children}</View>; }
export function H2({children}:{children:React.ReactNode}) { return <Text style={s.h2}>{children}</Text>; }
export function Muted({children}:{children:React.ReactNode}) { return <Text style={s.muted}>{children}</Text>; }
export function Button({title,onPress,secondary=false,danger=false}:{title:string;onPress:()=>void;secondary?:boolean;danger?:boolean}) {
  return <Pressable onPress={onPress} style={[s.button,secondary&&s.secondary,danger&&s.danger]}><Text style={[s.buttonText,secondary&&s.secondaryText]}>{title}</Text></Pressable>;
}
const s=StyleSheet.create({
 card:{backgroundColor:'#fff',borderRadius:18,padding:16,marginBottom:14,borderWidth:1,borderColor:colors.line,shadowColor:'#102E43',shadowOpacity:.04,shadowRadius:10,shadowOffset:{width:0,height:3}},
 h2:{fontSize:24,fontWeight:'800',color:colors.navy,marginBottom:8},
 muted:{fontSize:13,color:colors.muted,lineHeight:19},
 button:{backgroundColor:colors.navy,paddingVertical:14,paddingHorizontal:16,borderRadius:14,marginTop:10,alignItems:'center'},
 buttonText:{color:'#fff',fontWeight:'800',fontSize:14},secondary:{backgroundColor:'#fff',borderWidth:1,borderColor:colors.navy},secondaryText:{color:colors.navy},danger:{backgroundColor:colors.red}
});
