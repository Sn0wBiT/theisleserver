import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { apiUrl, request } from "@/services/api";
import { getAccessToken, sharedRefresh, type AuthResult } from "@/services/auth";
import { rawRequest } from "@/services/api";
import { postNativeMessage } from "@/services/native-bridge";
import { useOverlayStore } from "@/stores/overlay.store";
import { loadVoiceSettings, saveVoiceSettings, type ProximityState, type VoiceSettings } from "./types";

type VoiceContextValue = { settings: VoiceSettings; setSettings(value: VoiceSettings): void; connected: boolean; microphoneReady: boolean; transmitting: boolean; permissionError: string | null; proximity: ProximityState | null; devices: MediaDeviceInfo[]; testMicrophone(): Promise<void> };
const VoiceContext = createContext<VoiceContextValue | null>(null);
type Session = { url: string; token: string; room: string; expiresAt: number };

export function VoiceProvider({ playerPresent, children }: { playerPresent: boolean; children: ReactNode }) {
  const [settings, setSettingsState] = useState(loadVoiceSettings);
  const [connected, setConnected] = useState(false); const [microphoneReady, setMicrophoneReady] = useState(false);
  const [transmitting, setTransmitting] = useState(false); const [permissionError, setPermissionError] = useState<string | null>(null);
  const [proximity, setProximity] = useState<ProximityState | null>(null); const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const roomRef = useRef<Room | null>(null); const graphRef = useRef(new Map<string, { context: AudioContext; gain: GainNode; panner: PannerNode }>());
  const foreground = useOverlayStore((state) => state.gameForeground); const shuttingDown = useOverlayStore((state) => state.shuttingDown); const interactive = useOverlayStore((state) => state.interactive);
  const setSettings = (value: VoiceSettings) => { setSettingsState(value); saveVoiceSettings(value); postNativeMessage({ type: "voice.setPushToTalkKey", key: value.pushToTalkKey }); };

  useEffect(() => { navigator.mediaDevices?.enumerateDevices().then(setDevices).catch(() => setDevices([])); }, [microphoneReady]);
  useEffect(() => { postNativeMessage({ type: "voice.setPushToTalkKey", key: settings.pushToTalkKey }); }, [settings.pushToTalkKey]);
  useEffect(() => {
    const onNative = (event: Event) => { const detail = (event as CustomEvent<boolean>).detail; const active = Boolean(detail && connected && microphoneReady && foreground && !interactive); roomRef.current?.localParticipant.setMicrophoneEnabled(active).then(() => setTransmitting(active)).catch(() => setTransmitting(false)); };
    window.addEventListener("tpn-voice-ptt", onNative); return () => window.removeEventListener("tpn-voice-ptt", onNative);
  }, [connected, foreground, interactive, microphoneReady]);

  useEffect(() => {
    if (!settings.enabled || !playerPresent || !foreground || shuttingDown) { roomRef.current?.disconnect(); roomRef.current = null; setConnected(false); setMicrophoneReady(false); setTransmitting(false); return; }
    let cancelled = false; const room = new Room(); roomRef.current = room;
    const connect = async () => {
      try {
        const session = await request<Session>("/api/voice/session", { method: "POST" }); if (cancelled) return;
        await room.connect(session.url, session.token, { autoSubscribe: false });
        await room.localParticipant.setMicrophoneEnabled(true, { deviceId: settings.inputDeviceId === "default" ? undefined : settings.inputDeviceId, echoCancellation: settings.echoCancellation, noiseSuppression: settings.noiseSuppression, autoGainControl: settings.autoGainControl });
        await room.localParticipant.setMicrophoneEnabled(false); setConnected(true); setMicrophoneReady(true); setPermissionError(null);
      } catch (error) { setPermissionError(error instanceof Error ? error.message : "Microphone unavailable"); room.disconnect(); }
    };
    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (track.kind !== Track.Kind.Audio || settings.mutedSteamIds.includes(participant.identity)) return;
      const context = new AudioContext(); const source = context.createMediaStreamSource(new MediaStream([track.mediaStreamTrack])); const gain = context.createGain(); const panner = context.createPanner();
      panner.panningModel = "HRTF"; panner.distanceModel = "linear"; source.connect(gain).connect(panner).connect(context.destination); graphRef.current.set(participant.identity, { context, gain, panner });
    });
    room.on(RoomEvent.TrackUnsubscribed, (_track, _publication, participant) => { const graph = graphRef.current.get(participant.identity); graph?.context.close(); graphRef.current.delete(participant.identity); });
    connect(); return () => { cancelled = true; room.disconnect(); for (const graph of graphRef.current.values()) graph.context.close(); graphRef.current.clear(); };
  }, [foreground, playerPresent, settings.enabled, shuttingDown]);

  useEffect(() => {
    if (!connected) return; const controller = new AbortController();
    (async () => { try { let response = await fetch(`${apiUrl}/api/voice/proximity`, { headers: { Authorization: `Bearer ${getAccessToken() || ""}` }, signal: controller.signal });
      if (response.status === 401 && await sharedRefresh((refreshToken) => rawRequest<AuthResult>("/api/hud-auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }))) response = await fetch(`${apiUrl}/api/voice/proximity`, { headers: { Authorization: `Bearer ${getAccessToken() || ""}` }, signal: controller.signal });
      if (!response.ok || !response.body) return;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader(); let buffer = "";
      while (!controller.signal.aborted) { const { value, done } = await reader.read(); if (done) break; buffer += value; let end; while ((end = buffer.indexOf("\n\n")) >= 0) { const block = buffer.slice(0, end); buffer = buffer.slice(end + 2); const data = block.split("\n").find((line) => line.startsWith("data: "))?.slice(6); if (!data) continue; const state = JSON.parse(data) as ProximityState; setProximity(state);
        const allowed = new Set(state.audibleSpeakers.map((speaker) => speaker.identity)); for (const participant of roomRef.current?.remoteParticipants.values() || []) for (const publication of participant.audioTrackPublications.values()) publication.setSubscribed(allowed.has(participant.identity) && !settings.mutedSteamIds.includes(participant.identity));
        await roomRef.current?.localParticipant.setTrackSubscriptionPermissions(false, state.permittedListeners.map((participantIdentity) => ({ participantIdentity, allTracksAllowed: true })));
        for (const speaker of state.audibleSpeakers) { const graph = graphRef.current.get(speaker.identity); if (!graph) continue; graph.gain.gain.setTargetAtTime(speaker.gain * settings.outputVolume, graph.context.currentTime, .03); graph.panner.positionX.value = speaker.direction.x; graph.panner.positionY.value = speaker.direction.z; graph.panner.positionZ.value = -speaker.direction.y; }
      }}
    } catch { if (!controller.signal.aborted) setConnected(false); } })(); return () => controller.abort();
  }, [connected, settings.mutedSteamIds, settings.outputVolume]);

  async function testMicrophone() { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const audio = new Audio(URL.createObjectURL(new Blob())); void audio; stream.getTracks().forEach((track) => track.stop()); }
  return <VoiceContext.Provider value={{ settings, setSettings, connected, microphoneReady, transmitting, permissionError, proximity, devices, testMicrophone }}>{children}</VoiceContext.Provider>;
}
export function useVoice() { const value = useContext(VoiceContext); if (!value) throw new Error("VoiceProvider missing"); return value; }
