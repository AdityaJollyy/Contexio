import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sidebar, type FilterType } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { ReactNode } from "react";

interface RenderProps {
  activeFilter: FilterType;
  onAddClick: () => void;
  isAddModalOpen: boolean;
  onAddModalClose: () => void;
}

interface DashboardLayoutProps {
  children: (props: RenderProps) => ReactNode;
  // Controlled by the page, so the page can run hooks off the query at the top
  // level of its own component.
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

export function DashboardLayout({
  children,
  searchQuery = "",
  onSearchChange,
}: DashboardLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const filterParam = searchParams.get("filter") as FilterType | null;
  const activeFilter: FilterType = filterParam || "all";

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
          onSearchChange={onSearchChange ?? (() => {})}
        />

        <main className="flex-1 min-h-0 overflow-y-auto bg-background">
          {children({
            activeFilter,
            onAddClick: () => setIsAddModalOpen(true),
            isAddModalOpen,
            onAddModalClose: () => setIsAddModalOpen(false),
          })}
        </main>
      </div>
    </div>
  );
}
