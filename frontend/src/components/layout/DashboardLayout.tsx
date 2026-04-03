import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sidebar, type FilterType } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { ReactNode } from "react";

interface RenderProps {
  activeFilter: FilterType;
  searchQuery: string;
  onAddClick: () => void;
  isAddModalOpen: boolean;
  onAddModalClose: () => void;
}

interface DashboardLayoutProps {
  children: (props: RenderProps) => ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Read filter from URL params, default to "all"
  const filterParam = searchParams.get("filter") as FilterType | null;
  const activeFilter: FilterType = filterParam || "all";

  // Update URL when filter changes
  const handleFilterChange = (filter: FilterType) => {
    if (filter === "all") {
      searchParams.delete("filter");
    } else {
      searchParams.set("filter", filter);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onAddClick={() => setIsAddModalOpen(true)}
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="flex-1 min-h-0 overflow-y-auto bg-background">
          {children({
            activeFilter,
            searchQuery,
            onAddClick: () => setIsAddModalOpen(true),
            isAddModalOpen,
            onAddModalClose: () => setIsAddModalOpen(false),
          })}
        </main>
      </div>
    </div>
  );
}
