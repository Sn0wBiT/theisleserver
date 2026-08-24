import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { restQuestApi } from "@/features/quests/api/quests.api";

export function useClaimQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questId: string) => restQuestApi.claimQuest(questId),
    onSuccess: async (result) => {
      toast.success(`Đã nhận thưởng · +${result.rewardTokens.toLocaleString("vi-VN")} token`);
      await queryClient.invalidateQueries({ queryKey: ["quests"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không thể nhận thưởng nhiệm vụ này"),
  });
}
