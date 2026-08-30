export type VoiceSettings = { version: 1; enabled: boolean; pushToTalkKey: string; inputDeviceId: string; outputDeviceId: string; inputGain: number; outputVolume: number; echoCancellation: boolean; noiseSuppression: boolean; autoGainControl: boolean; mutedSteamIds: string[] };
export type AudibleSpeaker = { identity: string; displayName: string; gain: number; direction: { x: number; y: number; z: number }; subscribed: boolean };
export type ProximityState = { ready: boolean; stale: boolean; gameServerId: string; audibleSpeakers: AudibleSpeaker[]; permittedListeners: string[] };

export const defaultVoiceSettings: VoiceSettings = { version: 1, enabled: true, pushToTalkKey: "V", inputDeviceId: "default", outputDeviceId: "default", inputGain: 1, outputVolume: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true, mutedSteamIds: [] };
const storageKey = "tpn.hud.voice.v1";
export function loadVoiceSettings(storage: Pick<Storage, "getItem"> = localStorage): VoiceSettings {
  try { const value = JSON.parse(storage.getItem(storageKey) || "null"); return value?.version === 1 ? { ...defaultVoiceSettings, ...value, mutedSteamIds: Array.isArray(value.mutedSteamIds) ? value.mutedSteamIds.filter((id: unknown) => /^\d{17}$/.test(String(id))) : [] } : defaultVoiceSettings; }
  catch { return defaultVoiceSettings; }
}
export function saveVoiceSettings(settings: VoiceSettings, storage: Pick<Storage, "setItem"> = localStorage) { storage.setItem(storageKey, JSON.stringify(settings)); }
