import { Brain, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import type { FilterType } from "@/components/layout/Sidebar";

interface EmptyStateProps {
  filter: FilterType;
  isSearching: boolean;
  hasAnyContent: boolean;
  onAddClick: () => void;
}

export function EmptyState({
  filter,
  isSearching,
  hasAnyContent,
  onAddClick,
}: EmptyStateProps) {
  const navigate = useNavigate();

  // Someone with an empty library searched for something they never saved.
  // Telling them "no matches" is the wrong answer to that.
  const isEmptyLibrary = !hasAnyContent;
  const showNoMatches = isSearching && hasAnyContent;

  const title = showNoMatches
    ? "No matches"
    : isEmptyLibrary
      ? "Your brain is empty"
      : `No ${filter} content yet`;

  const description = showNoMatches
    ? "Nothing you saved matched those words."
    : isEmptyLibrary
      ? "Save your first item and it becomes findable months later."
      : "Start saving content to build your second brain";

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-12 h-12 rounded-xl border border-border bg-bg-card flex items-center justify-center text-muted mb-4">
        <Brain size={22} />
      </div>
      <h3 className="text-foreground text-sm font-medium mb-1">{title}</h3>
      <p className="text-muted text-sm mb-6 max-w-xs">{description}</p>

      {showNoMatches ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate("/search")}
        >
          <Sparkles size={13} className="mr-1.5" />
          Try AI search
        </Button>
      ) : (
        <Button variant="primary" size="sm" onClick={onAddClick}>
          Add Content
        </Button>
      )}
    </div>
  );
}
