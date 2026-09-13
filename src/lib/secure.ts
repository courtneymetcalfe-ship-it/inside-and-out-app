import * as SecureStore from 'expo-secure-store';

const PASSCODE_KEY = 'insideout_passcode';
const LOCK_ENABLED_KEY = 'insideout_lock_enabled';

export async function hasPasscode() {
  return Boolean(await SecureStore.getItemAsync(PASSCODE_KEY));
}

export async function setPasscode(passcode: string) {
  await SecureStore.setItemAsync(PASSCODE_KEY, passcode, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(LOCK_ENABLED_KEY, 'true');
}

export async function verifyPasscode(passcode: string) {
  const stored = await SecureStore.getItemAsync(PASSCODE_KEY);
  return stored === passcode;
}

export async function isLockEnabled() {
  return (await SecureStore.getItemAsync(LOCK_ENABLED_KEY)) !== 'false';
}

export async function setLockEnabled(enabled: boolean) {
  await SecureStore.setItemAsync(LOCK_ENABLED_KEY, String(enabled));
}
