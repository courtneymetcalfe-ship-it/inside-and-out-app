import React, { useEffect, useState } from 'react';
import { AppState, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors } from './UI';
import { hasPasscode, isLockEnabled, setPasscode, verifyPasscode } from '../lib/secure';

type Props = { children: React.ReactNode };

export default function AppLock({ children }: Props) {
  if(Platform.OS==='web')return <>{children}</>;
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const exists = await hasPasscode();
      const enabled = await isLockEnabled();
      setNeedsSetup(!exists);
      setLocked(exists && enabled);
      setReady(true);
      if (exists && enabled) void tryBiometrics();
    })().catch(() => setError('Secure storage could not be opened. Close and reopen the app to try again.'));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      if (state === 'background') {
        try { if (await isLockEnabled() && await hasPasscode()) setLocked(true); }
        catch {setLocked(true);setError('Unable to check secure storage. Unlock to continue.');}
      }
    });
    return () => sub.remove();
  }, []);

  async function tryBiometrics() {
    try {
      const available = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!available || !enrolled) return;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Inside & Out',
        fallbackLabel: 'Use passcode',
      });
      if (result.success) setLocked(false);
    } catch {}
  }

  async function setup() {
    if (busy) return;
    if (!/^\d{6}$/.test(pin)) {
      setError('Choose a 6-digit passcode.');
      return;
    }
    if(pin!==confirmation){setError('The passcodes do not match.');return;}
    setBusy(true);
    try { await setPasscode(pin);
    setPin('');
    setConfirmation('');
    setNeedsSetup(false);
    setLocked(false);
    } catch {setError('The passcode could not be saved. Please try again.');} finally {setBusy(false);}
  }

  async function unlock() {
    if(busy)return;
    setBusy(true);
    try { if (await verifyPasscode(pin)) {
      setPin('');
      setError('');
      setLocked(false);
    } else setError('Incorrect passcode.');
    } catch {setError('Secure storage could not be opened. Please try again.');} finally {setBusy(false);}
  }

  if (!ready) return <View style={s.center}><Text>{error || 'Loading…'}</Text></View>;
  if (!needsSetup && !locked) return <>{children}</>;

  return <View style={s.page}>
    <Image source={require('../../assets/inside-out-door.png')} style={s.logo}/>
    <Text style={s.title}>Inside & Out</Text>
    <Text style={s.subtitle}>{needsSetup ? 'Protect private family information with an app passcode.' : 'Unlock to continue.'}</Text>
    <TextInput
      value={pin}
      onChangeText={setPin}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      placeholder="Passcode"
      style={s.input}
      textContentType="password"
    />
    {needsSetup && <TextInput accessibilityLabel="Confirm passcode" value={confirmation} onChangeText={setConfirmation} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="Confirm passcode" style={[s.input,{marginTop:12}]} />}
    {!!error && <Text style={s.error}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={busy} style={s.primary} onPress={needsSetup ? setup : unlock}><Text style={s.primaryText}>{busy ? 'Please wait…' : needsSetup ? 'Create passcode' : 'Unlock'}</Text></Pressable>
    {!needsSetup && <Pressable style={s.secondary} onPress={tryBiometrics}><Text style={s.secondaryText}>Use Face ID / Touch ID</Text></Pressable>}
    <Text style={s.note}>Your passcode is stored in secure device storage. App Lock controls app access; keep your device protected and exported files private.</Text>
  </View>;
}

const s = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.soft,justifyContent:'center',padding:28},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
  logo:{width:74,height:74,borderRadius:22,alignSelf:'center',marginBottom:18},
  title:{fontFamily:'Georgia',fontSize:30,fontWeight:'700',textAlign:'center',color:colors.navy},
  subtitle:{fontSize:15,lineHeight:22,textAlign:'center',color:colors.muted,marginTop:8,marginBottom:24},
  input:{backgroundColor:'#fff',borderWidth:1,borderColor:colors.line,borderRadius:14,padding:15,fontSize:20,textAlign:'center',letterSpacing:8},
  error:{color:colors.danger,textAlign:'center',marginTop:8},
  primary:{backgroundColor:colors.navy,borderRadius:14,padding:15,alignItems:'center',marginTop:14},primaryText:{color:'#fff',fontWeight:'800'},
  secondary:{padding:14,alignItems:'center'},secondaryText:{color:colors.blue,fontWeight:'700'},
  note:{fontSize:12,lineHeight:18,color:colors.muted,textAlign:'center',marginTop:18}
});
