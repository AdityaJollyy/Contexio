import { Brain } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { FilterType } from "@/components/layout/Sidebar";

interface EmptyStateProps {
  filter: FilterType;
  isSearching: boolean;
  onAddClick: () => void;
}

export function EmptyState({
  filter,
  isSearching,
  onAddClick,
}: EmptyStateProps) {
  const title = isSearching
    ? "No results found"
    : filter === "all"
      ? "Your brain is empty"
      : `No ${filter} content yet`;

  const description = isSearching
    ? "Try a different search term"
    : "Start saving content to build your second brain";

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-12 h-12 rounded-xl border border-border bg-bg-card flex items-center justify-center text-muted mb-4">
        <Brain size={22} />
      </div>
      <h3 className="text-foreground text-sm font-medium mb-1">{title}</h3>
      <p className="text-muted text-sm mb-6 max-w-xs">{description}</p>
      {!isSearching && (
        <Button variant="primary" size="sm" onClick={onAddClick}>
          Add Content
        </Button>
      )}
    </div>
  );
}
