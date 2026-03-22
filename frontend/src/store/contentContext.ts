import { createContext } from "react";
import type { ContentItem } from "@/types";

export interface ContentState {
  contents: ContentItem[];
  isLoading: boolean;
  error: string;
  deleteItem: (id: string) => void;
}

export const ContentContext = createContext<ContentState | null>(null);
