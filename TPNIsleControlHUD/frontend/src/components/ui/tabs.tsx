import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex gap-1 border-b border-stone/50 p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn("h-7 flex-1 rounded-[1px] border-2 border-stone bg-[#061f1be0] px-3 font-display text-xs font-medium uppercase tracking-[0.08em] text-bone transition-colors duration-100 ease-linear hover:border-[#9bd7c4] hover:bg-[#114138f2] data-[state=active]:border-[#9bd7c4] data-[state=active]:bg-moss data-[state=active]:text-ink", className)}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}
