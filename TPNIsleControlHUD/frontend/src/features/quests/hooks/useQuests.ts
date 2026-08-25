import { useQuery } from "@tanstack/react-query";
import { restQuestApi } from "@/features/quests/api/quests.api";
import { useOverlayStore } from "@/stores/overlay.store";
import { usePositionStream } from "@/features/minimap/usePositionStream";

export function useQuests() {
  const gameReady = useOverlayStore((state) => state.gameProcessConnected && !state.shuttingDown);
  const { playerPresent } = usePositionStream();
  const canPoll = gameReady && playerPresent;
  return useQuery({
    queryKey: ["quests"],
    queryFn: ({ signal }) => restQuestApi.getQuests(signal),
    enabled: canPoll,
    refetchInterval: canPoll ? 5_000 : false,
  });
}
