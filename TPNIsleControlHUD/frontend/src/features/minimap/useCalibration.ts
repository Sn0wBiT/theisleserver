import { useEffect, useState } from "react";
import { loadCalibration } from "./calibration";
import type { Calibration } from "./types";

export function useCalibration() {
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    loadCalibration(controller.signal).then(setCalibration).catch(() => {
      if (!controller.signal.aborted) setInvalid(true);
    });
    return () => controller.abort();
  }, []);
  return { calibration, invalid };
}
