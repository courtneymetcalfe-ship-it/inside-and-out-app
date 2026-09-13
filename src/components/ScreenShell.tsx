import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import BottomNav from './BottomNav';
export default function ScreenShell({children,active='home'}:{children:React.ReactNode;active?:string}){return <SafeAreaView style={s.safe}><View style={s.body}>{children}</View><BottomNav active={active}/></SafeAreaView>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#fff'},body:{flex:1}});
