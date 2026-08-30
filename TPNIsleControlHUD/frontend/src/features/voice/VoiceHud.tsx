import { Mic, MicOff } from "lucide-react";
import { useOverlayStore } from "@/stores/overlay.store";
import { postNativeMessage } from "@/services/native-bridge";
import { cn } from "@/lib/utils";
import { useVoice } from "./VoiceProvider";

export function VoiceHud() { const voice = useVoice(); const openPanel = useOverlayStore((state) => state.openPanel); const setInteractive = useOverlayStore((state) => state.setInteractive); const ready = voice.settings.enabled && voice.connected && voice.microphoneReady;
  return <button className={cn("voice-status pointer-events-auto", ready && "voice-status--ready", voice.transmitting && "voice-status--transmitting")} onClick={() => { postNativeMessage({ type: "overlay.setInteractive", value: true }); setInteractive(true); openPanel("voice"); }} aria-label="Open voice settings" title={voice.permissionError || (ready ? "Voice connected" : "Voice unavailable")}>{ready ? <Mic size={20} /> : <MicOff size={20} />}</button>; }
