import { useQuery } from "@tanstack/react-query";
import { restQuestApi } from "@/features/quests/api/quests.api";
import { useOverlayStore } from "@/stores/overlay.store";

export function useQuests() {
  const canPoll = useOverlayStore((state) => state.gameConnected && !state.shuttingDown);
  return useQuery({
    queryKey: ["quests"],
    queryFn: ({ signal }) => restQuestApi.getQuests(signal),
    enabled: canPoll,
    refetchInterval: canPoll ? 5_000 : false,
  });
}

