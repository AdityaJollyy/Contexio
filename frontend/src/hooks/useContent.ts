import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContents, removeContent, retryContent } from "@/lib/api";
import type { ContentItem } from "@/types";

export const CONTENTS_KEY = ["contents"] as const;
export const SEARCH_KEY = ["search"] as const;
// The AI quota lives in the query cache rather than the Search page, so it
// survives that page unmounting on a tab switch.
export const AI_QUOTA_KEY = ["ai", "quota"] as const;

interface ContentsCache {
  contents: ContentItem[];
}

/** Plain search caches its own shape, one entry per query string. */
interface SearchCache {
  results: ContentItem[];
  suggestions: ContentItem[];
  total: number;
}

export function useContent() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: CONTENTS_KEY,
    queryFn: getContents,
    select: (res) => res.contents,
    // Items are enriched by a background worker, so poll while any of them are
    // still in flight. The interval stops on its own once everything settles.
    refetchInterval: (query) =>
      query.state.data?.contents.some(
        (c) => c.status === "pending" || c.status === "processing",
      )
        ? 3000
        : false,
  });

  const contents: ContentItem[] = data ?? [];
  const errorMessage = error ? "Failed to load content" : "";

  const deleteMutation = useMutation({
    mutationFn: removeContent,
    onMutate: async (id) => {
      // Search results are separate cache entries, one per query string, so the
      // library cache alone leaves a deleted card on screen mid-search.
      await queryClient.cancelQueries({ queryKey: CONTENTS_KEY });
      await queryClient.cancelQueries({ queryKey: SEARCH_KEY });

      const previousContents =
        queryClient.getQueryData<ContentsCache>(CONTENTS_KEY);
      const previousSearches = queryClient.getQueriesData<SearchCache>({
        queryKey: SEARCH_KEY,
      });

      queryClient.setQueryData<ContentsCache>(CONTENTS_KEY, (old) =>
        old ? { contents: old.contents.filter((c) => c._id !== id) } : old,
      );

      // Search entries hold results and suggestions, not a contents array.
      queryClient.setQueriesData<SearchCache>(
        { queryKey: SEARCH_KEY },
        (old) => {
          if (!old) return old;
          const results = old.results.filter((c) => c._id !== id);
          return {
            results,
            suggestions: old.suggestions.filter((c) => c._id !== id),
            total: results.length,
          };
        },
      );

      return { previousContents, previousSearches };
    },
    onError: (_err, _id, context) => {
      if (context?.previousContents) {
        queryClient.setQueryData(CONTENTS_KEY, context.previousContents);
      }
      for (const [key, value] of context?.previousSearches ?? []) {
        queryClient.setQueryData(key, value);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CONTENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: SEARCH_KEY });
    },
  });

  const deleteItem = (id: string) => deleteMutation.mutate(id);

  const retryMutation = useMutation({
    mutationFn: retryContent,
    // The refetch moves the card to Processing; the existing poll takes it on.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CONTENTS_KEY });
    },
  });

  const retryItem = (id: string) => retryMutation.mutate(id);

  return {
    contents,
    isLoading,
    error: errorMessage,
    deleteItem,
    retryItem,
    isRetrying: retryMutation.isPending,
  };
}
