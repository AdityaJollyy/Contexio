import { createContext } from "react";
import type { ContentItem } from "@/types";

export interface ContentState {
  contents: ContentItem[];
  isLoading: boolean;
  error: string;
  fetchContents: () => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

export const ContentContext = createContext<ContentState | null>(null);
