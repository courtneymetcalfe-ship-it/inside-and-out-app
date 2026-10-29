import React, { useEffect, useState } from 'react';
import { AppState, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors } from './UI';
import {cleanOldExports} from '../lib/platform';
import { hasPasscode, isLockEnabled, setPasscode, verifyPasscode, resetPinAttempts, PinCooldownError } from '../lib/secure';

type Props = { children: React.ReactNode };

export default function AppLock({ children }: Props) {
  if(Platform.OS==='web')return <>{children}</>;
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      // Export cleanup is maintenance, not a prerequisite for unlocking.
      await cleanOldExports().catch(() => {});
      const exists = await hasPasscode();
      const enabled = await isLockEnabled();
      setNeedsSetup(!exists);
      setLocked(exists && enabled);
      setReady(true);
      if (exists && enabled) void tryBiometrics();
    })().catch(() => {setLocked(true);setReady(true);setError('Secure storage is unavailable. Close and reopen the app to try again.');});
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
      if (result.success) {await resetPinAttempts();setPin('');setError('');setLocked(false);}
    } catch {}
  }

  async function setup() {
    if (busy) return;
    if (!/^\d{6}$/.test(pin)) {
      setError('Enter exactly six numbers.');
      return;
    }
    if (setupStep === 'create') {
      setPendingPin(pin);
      setPin('');
      setError('');
      setSetupStep('confirm');
      return;
    }
    if (pin !== pendingPin) {
      setPin('');
      setError('Those passcodes do not match. Re-enter the six numbers you chose, or start over.');
      return;
    }
    setBusy(true);
    try {
      await setPasscode(pin);
      // Read it back through the same verification path used to unlock.
      if (!await verifyPasscode(pin)) throw new Error('Stored passcode could not be verified.');
      setPin('');
      setPendingPin('');
      setSetupStep('create');
      setError('');
      setNeedsSetup(false);
      setLocked(false);
    } catch {
      setError('Could not verify the saved passcode. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    if(busy)return;
    setBusy(true);
    try { if (await verifyPasscode(pin)) {
      setPin('');
      setError('');
      setLocked(false);
    } else setError('Incorrect passcode.');
    } catch(e) {setError(e instanceof PinCooldownError?e.message:'Secure storage could not be opened. Please try again.');} finally {setPin('');setBusy(false);}
  }

  if (!ready) return <View style={s.center}><Text>{error || 'Loading…'}</Text></View>;
  if (!needsSetup && !locked) return <>{children}</>;

  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Image source={require('../../assets/inside-out-app-icon.png')} style={s.logo}/>
      <Text style={s.title}>Inside & Out</Text>
      <Text style={s.subtitle}>{needsSetup ? (setupStep === 'create' ? 'Choose a six-digit passcode to protect your private family information.' : 'Confirm your passcode by entering the same six numbers again.') : 'Unlock to continue.'}</Text>
      <TextInput
        accessibilityLabel={needsSetup ? (setupStep === 'create' ? 'Choose six-digit passcode' : 'Confirm six-digit passcode') : 'Enter passcode'}
        value={pin}
        onChangeText={value => {setPin(value.replace(/\D/g, '').slice(0, 6));setError('');}}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        placeholder={needsSetup ? (setupStep === 'create' ? 'New passcode' : 'Confirm passcode') : 'Passcode'}
        style={s.input}
        textContentType="none"
        autoComplete="off"
        autoCorrect={false}
        importantForAutofill="no"
      />
      {!!error && <Text style={s.error}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={busy || pin.length !== 6} style={[s.primary, (busy || pin.length !== 6) && {opacity:0.55}]} onPress={needsSetup ? setup : unlock}><Text style={s.primaryText}>{busy ? 'Please wait…' : needsSetup ? (setupStep === 'create' ? 'Continue' : 'Verify & create passcode') : 'Unlock'}</Text></Pressable>
      {needsSetup && setupStep === 'confirm' && <Pressable accessibilityRole="button" style={s.secondary} onPress={() => {setPendingPin('');setPin('');setSetupStep('create');setError('');}}><Text style={s.secondaryText}>Start over with a different passcode</Text></Pressable>}
      {!needsSetup && <Pressable accessibilityRole="button" style={s.secondary} onPress={tryBiometrics}><Text style={s.secondaryText}>{Platform.OS === 'android' ? 'Use fingerprint / face unlock' : 'Use Face ID / Touch ID'}</Text></Pressable>}
      <Text style={s.note}>Your passcode is stored in secure device storage. App Lock controls app access; keep your device protected and exported files private.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.soft},
  content:{flexGrow:1,justifyContent:'center',padding:28},
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
