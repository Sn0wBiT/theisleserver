import { useQuery } from "@tanstack/react-query";
import { restQuestApi } from "@/features/quests/api/quests.api";
import { useOverlayStore } from "@/stores/overlay.store";
import { usePositionStream } from "@/features/minimap/usePositionStream";
import { isUiDevelopment } from "@/config/ui-development";

export function useQuests() {
  const gameReady = useOverlayStore((state) => state.gameProcessConnected && !state.shuttingDown);
  const { playerPresent } = usePositionStream();
  const canPoll = isUiDevelopment || (gameReady && playerPresent);
  return useQuery({
    queryKey: ["quests"],
    queryFn: ({ signal }) => restQuestApi.getQuests(signal),
    enabled: canPoll,
    refetchInterval: canPoll ? 5_000 : false,
  });
}
