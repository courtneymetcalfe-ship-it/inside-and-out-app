import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export async function saveJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function clearLocalData() {
  await AsyncStorage.clear();
}

export async function exportLocalData() {
  const keys = await AsyncStorage.getAllKeys();
  const pairs = await AsyncStorage.multiGet(keys);
  const data: Record<string, unknown> = {};
  for (const [key, value] of pairs) {
    if (!value) continue;
    try { data[key] = JSON.parse(value); } catch { data[key] = value; }
  }
  return data;
}
