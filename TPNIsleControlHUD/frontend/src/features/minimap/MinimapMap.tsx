import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Calibration, PositionEvent } from "./types";
import { imagePointToLeaflet, worldToMap } from "./calibration";
import { loadTerritories, territoryColor, territoryPolygon, type Territory } from "./territories";

type Props = {
  calibration: Calibration;
  position: PositionEvent | null;
  compact?: boolean;
  follow: boolean;
  recenterKey?: number;
  onFollowChange?: (follow: boolean) => void;
  showTerritories?: boolean;
};

export function MinimapMap({ calibration, position, compact = false, follow, recenterKey, onFollowChange, showTerritories = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const latestPoint = useRef<L.LatLng | null>(null);
  const onFollowChangeRef = useRef(onFollowChange);
  const territoryLayerRef = useRef<L.LayerGroup | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  onFollowChangeRef.current = onFollowChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const bounds = L.latLngBounds([0, 0], [calibration.image.height, calibration.image.width]);
    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      attributionControl: !compact,
      zoomControl: !compact,
      dragging: !compact,
      scrollWheelZoom: !compact,
      doubleClickZoom: !compact,
      boxZoom: !compact,
      keyboard: !compact,
      touchZoom: !compact,
      minZoom: -3,
      maxZoom: 3,
      maxBounds: bounds.pad(0.35),
    });
    L.imageOverlay(calibration.image.src, bounds, { attribution: calibration.attribution }).addTo(map);
    territoryLayerRef.current = L.layerGroup().addTo(map);
    map.fitBounds(bounds, { animate: false });
    if (!compact) map.on("dragstart", () => onFollowChangeRef.current?.(false));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; territoryLayerRef.current = null; };
  }, [calibration, compact]);

  useEffect(() => {
    const controller = new AbortController();
    const mock = import.meta.env.DEV && import.meta.env.VITE_TERRITORY_MOCK !== "false";
    loadTerritories(controller.signal, calibration, mock).then(setTerritories).catch(() => undefined);
    const source = mock ? null : new EventSource("/api/territories/stream");
    source?.addEventListener("territories", (event) => {
      try { setTerritories(JSON.parse((event as MessageEvent).data).territories ?? []); } catch { /* reconnect on the next mount */ }
    });
    return () => { controller.abort(); source?.close(); };
  }, [calibration]);

  useEffect(() => {
    const layer = territoryLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showTerritories) return;
    for (const zone of territories) {
      const polygon = territoryPolygon(zone, calibration).map((point) => imagePointToLeaflet(point, calibration.image.height) as [number, number]);
      L.polygon(polygon, { color: territoryColor(zone), weight: zone.status === "contested" ? 3 : 1, opacity: 0.3, fillOpacity: Math.min(0.2, 0.12 + zone.influence / 500) })
        .bindTooltip(`${zone.name} · ${zone.status}`)
        .addTo(layer);
    }
  }, [calibration, showTerritories, territories]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;
    const point = worldToMap(position.position, calibration);
    const latLng = L.latLng(imagePointToLeaflet(point, calibration.image.height));
    latestPoint.current = latLng;
    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, {
        interactive: false,
        icon: L.divIcon({ className: "player-marker-shell", html: '<span class="player-marker" aria-hidden="true"></span>', iconSize: [24, 24], iconAnchor: [12, 12] }),
      }).addTo(map);
    } else markerRef.current.setLatLng(latLng);
    if (compact || follow) map.setView(latLng, compact ? 0 : Math.max(map.getZoom(), -1), { animate: false });
  }, [calibration, compact, follow, position]);

  useEffect(() => {
    if (recenterKey !== undefined && latestPoint.current) mapRef.current?.setView(latestPoint.current, 0, { animate: true });
  }, [recenterKey]);

  return <div ref={containerRef} className="size-full" aria-label={compact ? "Gateway minimap" : "Interactive Gateway map"} />;
}
