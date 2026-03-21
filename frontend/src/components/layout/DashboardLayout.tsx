import { useState } from "react";
import { Sidebar, type FilterType } from "./Sidebar";
import { TopBar } from "./TopBar";

interface DashboardLayoutProps {
  children: (props: {
    activeFilter: FilterType;
    searchQuery: string;
    onAddClick: () => void;
    isAddModalOpen: boolean;
    onAddModalClose: () => void;
  }) => React.ReactNode;
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

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopBar
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onAddClick={() => setIsAddModalOpen(true)}
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="flex-1 overflow-y-auto bg-background">
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
