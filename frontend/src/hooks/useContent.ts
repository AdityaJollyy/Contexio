import { useState, useEffect, useCallback } from "react";
import { getContents, removeContent } from "@/lib/api";
import type { ContentItem } from "@/types";

export function useContent() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchContents = useCallback(async () => {
    try {
      const data = await getContents();
      setContents(data.contents);
      setError("");
    } catch {
      setError("Failed to load content");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteItem = useCallback(
    async (id: string) => {
      // Optimistic update
      setContents((prev) => prev.filter((c) => c._id !== id));
      try {
        await removeContent(id);
      } catch {
        // Revert on failure
        fetchContents();
      }
    },
    [fetchContents],
  );

  useEffect(() => {
    fetchContents();
    // Poll every 8 seconds to pick up AI processing status changes
    const interval = setInterval(fetchContents, 8000);
    return () => clearInterval(interval);
  }, [fetchContents]);

  return { contents, isLoading, error, fetchContents, deleteItem };
}
