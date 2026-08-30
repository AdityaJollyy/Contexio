import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { regularSearch } from "@/lib/api";
import { SEARCH_KEY } from "@/hooks/useContent";

const DEBOUNCE_MS = 300;
// Matches the server's Zod floor. Two characters do not prefix-match, since
// minGrams is 3, but `AI` and `Go` are whole tokens worth searching for.
export const MIN_QUERY_LENGTH = 2;

const EMPTY: never[] = [];

/**
 * Server-side and keyword-ranked, in two tiers. `results` are literal matches
 * and are never score-filtered; `suggestions` are fuzzy near-misses the server
 * computes only when tier 1 came back thin. The debounce is what stops a
 * per-keystroke query becoming a per-keystroke aggregation.
 */
export function useSearch(query: string) {
  const trimmed = query.trim();
  const [debounced, setDebounced] = useState(trimmed);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const isActive = debounced.length >= MIN_QUERY_LENGTH;

  const { data, isFetching, error } = useQuery({
    queryKey: [...SEARCH_KEY, debounced],
    queryFn: () => regularSearch(debounced),
    enabled: isActive,
    staleTime: 30000,
  });

  return {
    isActive,
    // Typing past the debounce should not flash the previous query's results.
    results: isActive ? (data?.results ?? EMPTY) : EMPTY,
    suggestions: isActive ? (data?.suggestions ?? EMPTY) : EMPTY,
    total: isActive ? (data?.total ?? 0) : 0,
    isSearching: isActive && (isFetching || debounced !== trimmed),
    // A query the server would reject never leaves the browser.
    tooShort: trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH,
    error: error ? "Search failed" : "",
  };
}
