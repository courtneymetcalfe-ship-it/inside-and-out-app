import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppLock from '../src/components/AppLock';
export default function Root(){return <SafeAreaProvider><AppLock><StatusBar style="dark"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:'#fff'}}}/></AppLock></SafeAreaProvider>;}
