import { Menu, Plus, Search } from "lucide-react";
import type { FilterType } from "./Sidebar";

interface TopBarProps {
  onOpenSidebar: () => void;
  onAddClick: () => void;
  activeFilter: FilterType;
  searchQuery: string;
  onSearchChange: (val: string) => void;
}

const filterLabels: Record<FilterType, string> = {
  all: "All Items",
  youtube: "YouTube",
  twitter: "X (Twitter)",
  github: "GitHub",
  text: "Text Notes",
  others: "Others",
  search: "Search",
};

export function TopBar({
  onOpenSidebar,
  onAddClick,
  activeFilter,
  searchQuery,
  onSearchChange,
}: TopBarProps) {
  return (
    <div className="h-13 w-full shrink-0 border-b border-border bg-background flex items-center px-4 gap-3 sticky top-0 z-30 select-none">
      {/* Mobile menu toggle */}
      <button
        onClick={onOpenSidebar}
        className="md:hidden text-muted hover:text-foreground transition-colors shrink-0"
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumb — hidden on mobile */}
      <span className="hidden md:block text-foreground text-[14px] font-medium shrink-0">
        {filterLabels[activeFilter]}
      </span>

      {/* Search bar */}
      <div className="flex-1 flex items-center max-w-120 mx-auto relative">
        <Search
          size={14}
          className="absolute left-3 text-muted pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search your brain…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 bg-bg-input border border-border rounded-sm pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Add button */}
      <button
        onClick={onAddClick}
        className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-sm bg-bg-secondary border border-border text-accent hover:bg-bg-card transition-colors text-[13px] font-medium"
      >
        <Plus size={14} />
        <span className="hidden sm:inline">Add</span>
      </button>
    </div>
  );
}
