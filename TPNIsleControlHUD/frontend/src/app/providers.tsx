import { QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren } from "react";
import { Toaster } from "sonner";
import { queryClient } from "@/app/query-client";

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster theme="dark" position="top-right" toastOptions={{ className: "hud-toast" }} />
    </QueryClientProvider>
  );
}
