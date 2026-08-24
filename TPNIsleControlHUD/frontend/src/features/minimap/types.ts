import { z } from "zod";

export const positionEventSchema = z.object({
  steamId: z.string().regex(/^\d{17}$/),
  position: z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }),
  updatedAt: z.number().finite().nonnegative(),
});

const pointSchema = z.object({ world: z.object({ x: z.number(), y: z.number() }), image: z.object({ x: z.number(), y: z.number() }) });

export const calibrationSchema = z.object({
  revision: z.string().min(1),
  image: z.object({ src: z.string().min(1), width: z.number().positive(), height: z.number().positive() }),
  worldBounds: z.object({ minX: z.number(), maxX: z.number(), minY: z.number(), maxY: z.number() }),
  axes: z.object({ x: z.enum(["left-to-right", "right-to-left"]), y: z.enum(["top-to-bottom", "bottom-to-top"]) }),
  attribution: z.string().min(1),
  verificationPoints: z.array(pointSchema).min(2),
}).superRefine((value, context) => {
  if (value.worldBounds.minX >= value.worldBounds.maxX || value.worldBounds.minY >= value.worldBounds.maxY) {
    context.addIssue({ code: "custom", message: "World bounds must have positive area" });
  }
});

export type PositionEvent = z.infer<typeof positionEventSchema>;
export type Calibration = z.infer<typeof calibrationSchema>;
export type StreamStatus = "waiting" | "connected" | "stale" | "reconnecting" | "unauthorized" | "unavailable";
