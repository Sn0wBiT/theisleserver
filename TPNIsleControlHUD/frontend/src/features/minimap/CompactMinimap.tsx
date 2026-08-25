import { useOverlayStore } from "@/stores/overlay.store";
import { postNativeMessage } from "@/services/native-bridge";
import { useMinimapFrameStore } from "./frame.store";
import { MinimapMap } from "./MinimapMap";
import { MinimapStatus } from "./MinimapStatus";
import { useCalibration } from "./useCalibration";
import { usePositionStream } from "./usePositionStream";

export function CompactMinimap() {
  const interactive = useOverlayStore((state) => state.interactive);
  const setInteractive = useOverlayStore((state) => state.setInteractive);
  const openPanel = useOverlayStore((state) => state.openPanel);
  const frame = useMinimapFrameStore((state) => state.frame);
  const { calibration, invalid } = useCalibration();
  const { position, status } = usePositionStream();
  const content = (
    <>
      <div className="minimap-canvas">
        {calibration ? <MinimapMap compact calibration={calibration} position={position} follow /> : <div className="minimap-empty">{invalid ? "Map configuration unavailable" : "Loading map…"}</div>}
        <div className="minimap-status-overlay hidden"><MinimapStatus status={status} /></div>
        {position && <div className="minimap-coordinates">X {position.position.x.toFixed(0)} · Y {position.position.y.toFixed(0)} · Z {position.position.z.toFixed(0)}</div>}
      </div>
    </>
  );
  const className = `compact-minimap compact-minimap--${frame}`;
  const openMap = () => {
    postNativeMessage({ type: "overlay.openMap" });
    setInteractive(true);
    openPanel("minimap");
  };
  return <button type="button" className={`${className} compact-minimap--interactive${interactive ? "" : " pointer-events-auto"}`} onClick={openMap} aria-label="Open expanded Gateway map">{content}</button>;
}
