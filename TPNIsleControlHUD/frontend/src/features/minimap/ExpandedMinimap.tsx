import { Circle, Crosshair, ListChecks, Square, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/old_button";
import { closeInteractiveMode } from "@/services/native-bridge";
import { useOverlayStore } from "@/stores/overlay.store";
import { MinimapMap } from "./MinimapMap";
import { MinimapStatus } from "./MinimapStatus";
import { useCalibration } from "./useCalibration";
import { usePositionStream } from "./usePositionStream";
import { followAfterAction } from "./state";
import { useMinimapFrameStore, type MinimapFrame } from "./frame.store";

export function ExpandedMinimap() {
  const openPanel = useOverlayStore((state) => state.openPanel);
  const { calibration, invalid } = useCalibration();
  const { position, status } = usePositionStream();
  const [follow, setFollow] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const frame = useMinimapFrameStore((state) => state.frame);
  const setFrame = useMinimapFrameStore((state) => state.setFrame);
  const recenter = () => { setFollow(followAfterAction("recenter")); setRecenterKey((value) => value + 1); };

  return <section className="expanded-minimap hud-panel pointer-events-auto" aria-label="Expanded Gateway minimap">
    <header className="expanded-minimap__header">
      <div><span className="eyebrow">Navigation / Gateway</span><h1>FIELD MAP</h1></div>
      <div className="flex items-center gap-2">
        <div className="minimap-frame-control" role="group" aria-label="Compact minimap frame">
          {(["square", "circle"] as MinimapFrame[]).map((value) => <button key={value} type="button" className={frame === value ? "is-active" : ""} onClick={() => setFrame(value)} aria-pressed={frame === value}>{value === "square" ? <Square /> : <Circle />}{value}</button>)}
        </div>
        <Button variant="ghost" onClick={() => openPanel("quests")}><ListChecks /> Quests</Button>
        <Button variant="ghost" onClick={recenter}><Crosshair /> Recenter</Button>
        <Button variant="ghost" size="icon" onClick={closeInteractiveMode} aria-label="Close map"><X /></Button>
      </div>
    </header>
    <div className="expanded-minimap__canvas">
      {calibration ? <MinimapMap calibration={calibration} position={position} follow={follow} recenterKey={recenterKey} onFollowChange={() => setFollow(followAfterAction("pan"))} /> : <div className="minimap-empty">{invalid ? "Map configuration unavailable" : "Loading Gateway map…"}</div>}
    </div>
    <footer className="expanded-minimap__footer">
      <MinimapStatus status={status} />
      <span>{follow ? "FOLLOWING PLAYER" : "FREE PAN · RECENTER TO FOLLOW"}</span>
      <span className="font-mono">{position ? `X ${position.position.x.toFixed(1)}  Y ${position.position.y.toFixed(1)}  Z ${position.position.z.toFixed(1)}` : "COORDINATES —"}</span>
    </footer>
  </section>;
}
