import { type ReactNode } from "react";
import { ContentContext } from "./contentContext";
import { useContent } from "@/hooks/useContent";

export function ContentProvider({ children }: { children: ReactNode }) {
  const value = useContent();
  return (
    <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
  );
}
