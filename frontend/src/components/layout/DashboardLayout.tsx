import { useState } from "react";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
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
