import type { Calibration } from "./types";
import { calibrationSchema } from "./types";

export type MapPoint = { x: number; y: number };

export function imagePointToLeaflet(point: MapPoint, imageHeight: number): [number, number] {
  return [imageHeight - point.y, point.x];
}

export function worldToMap(position: { x: number; y: number }, calibration: Calibration): MapPoint {
  const { minX, maxX, minY, maxY } = calibration.worldBounds;
  let x = ((position.x - minX) / (maxX - minX)) * calibration.image.width;
  let y = ((position.y - minY) / (maxY - minY)) * calibration.image.height;
  if (calibration.axes.x === "right-to-left") x = calibration.image.width - x;
  if (calibration.axes.y === "bottom-to-top") y = calibration.image.height - y;
  return { x, y };
}

export async function loadCalibration(signal?: AbortSignal): Promise<Calibration> {
  const response = await fetch("/maps/gateway/calibration.json", { cache: "no-store", signal });
  if (!response.ok) throw new Error("calibration-unavailable");
  const calibration = calibrationSchema.parse(await response.json());
  for (const point of calibration.verificationPoints) {
    const converted = worldToMap(point.world, calibration);
    if (Math.abs(converted.x - point.image.x) > 1 || Math.abs(converted.y - point.image.y) > 1) {
      throw new Error("calibration-verification-failed");
    }
  }
  return calibration;
}
