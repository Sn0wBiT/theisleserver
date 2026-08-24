import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({ value = 0, className }: { value?: number; className?: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <ProgressPrimitive.Root className={cn("h-2 overflow-hidden rounded-none border border-stone/40 bg-[#162822]", className)} value={safeValue}>
      <ProgressPrimitive.Indicator
        className="h-full bg-[#e3e7b2] transition-transform duration-100 ease-linear"
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
