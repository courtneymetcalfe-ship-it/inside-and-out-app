import * as SecureStore from 'expo-secure-store';

const PASSCODE_KEY = 'insideout_passcode';
const LOCK_ENABLED_KEY = 'insideout_lock_enabled';
const ATTEMPTS_KEY = 'insideout_pin_attempts_v1';
const secureOptions = {keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
let verificationQueue: Promise<unknown> = Promise.resolve();
export class PinCooldownError extends Error {
  constructor(seconds: number) {super(`Too many incorrect attempts. Try again in ${seconds} seconds, or use biometric unlock.`);}
}
export async function resetPinAttempts() {
  await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify({failures:0,until:0}), secureOptions);
}

export async function hasPasscode() {
  return Boolean(await SecureStore.getItemAsync(PASSCODE_KEY));
}

export async function setPasscode(passcode: string) {
  await SecureStore.setItemAsync(PASSCODE_KEY, passcode, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(LOCK_ENABLED_KEY, 'true');
  await resetPinAttempts();
}

export async function verifyPasscode(passcode: string) {
  const attempt = verificationQueue.then(async () => {
    const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY);
    const attempts = raw ? JSON.parse(raw) : {failures:0,until:0};
    if(!Number.isSafeInteger(attempts.failures)||attempts.failures<0||!Number.isFinite(attempts.until)||attempts.until<0)throw new Error('Invalid PIN protection state');
    if(attempts.until>Date.now())throw new PinCooldownError(Math.ceil((attempts.until-Date.now())/1000));
    const failures=Math.min(attempts.failures+1,30);
    const delay=failures>=5?Math.min(900,30*2**(failures-5)):0;
    // Persist before comparing, so closing the app cannot reset failed attempts.
    await SecureStore.setItemAsync(ATTEMPTS_KEY,JSON.stringify({failures,until:Date.now()+delay*1000}),secureOptions);
    const stored = await SecureStore.getItemAsync(PASSCODE_KEY);
    if(stored && stored === passcode){await resetPinAttempts();return true;}
    if(delay)throw new PinCooldownError(delay);
    return false;
  });
  verificationQueue=attempt.catch(()=>{});
  return attempt;
}

export async function isLockEnabled() {
  return (await SecureStore.getItemAsync(LOCK_ENABLED_KEY)) !== 'false';
}

export async function setLockEnabled(enabled: boolean) {
  await SecureStore.setItemAsync(LOCK_ENABLED_KEY, String(enabled));
}
