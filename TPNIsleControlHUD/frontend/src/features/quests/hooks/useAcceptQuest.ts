import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { restQuestApi } from "@/features/quests/api/quests.api";

export function useAcceptQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questId: string) => restQuestApi.acceptQuest(questId),
    onSuccess: async () => {
      toast.success("Đã nhận nhiệm vụ");
      await queryClient.invalidateQueries({ queryKey: ["quests"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không thể nhận nhiệm vụ này"),
  });
}
