import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContents, removeContent } from "@/lib/api";
import type { ContentItem } from "@/types";

export const CONTENTS_KEY = ["contents"] as const;

export function useContent() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: CONTENTS_KEY,
    queryFn: getContents,
    select: (res) => res.contents,
  });

  const contents: ContentItem[] = data ?? [];
  const errorMessage = error ? "Failed to load content" : "";

  const deleteMutation = useMutation({
    mutationFn: removeContent,
    onMutate: async (id) => {
      // Cancel any in-flight refetch so it doesn't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: CONTENTS_KEY });

      // Snapshot current cache before mutating
      const previous = queryClient.getQueryData<{ contents: ContentItem[] }>(
        CONTENTS_KEY,
      );

      // Optimistically remove from cache immediately
      queryClient.setQueryData<{ contents: ContentItem[] }>(
        CONTENTS_KEY,
        (old) =>
          old ? { contents: old.contents.filter((c) => c._id !== id) } : old,
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      // API failed — roll back to snapshot
      if (context?.previous) {
        queryClient.setQueryData(CONTENTS_KEY, context.previous);
      }
    },
    onSettled: () => {
      // Always sync with server after delete resolves (success or failure)
      queryClient.invalidateQueries({ queryKey: CONTENTS_KEY });
    },
  });

  const deleteItem = (id: string) => deleteMutation.mutate(id);

  return { contents, isLoading, error: errorMessage, deleteItem };
}
