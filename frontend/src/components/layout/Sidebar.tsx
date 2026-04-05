import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  FileText,
  Link as LinkIcon,
  Sparkles,
  LogOut,
  X,
} from "lucide-react";
import { YoutubeIcon, XIcon, GithubIcon } from "@/components/ui/BrandIcons";
import { Logo } from "@/components/ui/Logo";
import { clearAuth, getUser } from "@/lib/auth";
import type { FilterType } from "@/types";

export type { FilterType };

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full text-left text-[14px] py-1.5 pl-3.5 border-l-2 transition-colors ${
        active
          ? "border-accent text-foreground"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      <span className={active ? "text-foreground" : "text-muted"}>{icon}</span>
      {label}
    </button>
  );
}

const libraryItems: { id: FilterType; label: string; icon: React.ReactNode }[] =
  [
    { id: "all", label: "All Items", icon: <Layers size={15} /> },
    { id: "youtube", label: "YouTube", icon: <YoutubeIcon size={15} /> },
    { id: "twitter", label: "X (Twitter)", icon: <XIcon size={15} /> },
    { id: "github", label: "GitHub", icon: <GithubIcon size={15} /> },
    { id: "text", label: "Text Notes", icon: <FileText size={15} /> },
    { id: "others", label: "Others", icon: <LinkIcon size={15} /> },
  ];

export function Sidebar({
  isOpen,
  onClose,
  activeFilter,
  onFilterChange,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = getUser();

  const isSearchPage = location.pathname === "/search";

  const handleLogout = () => {
    queryClient.clear(); // Clear all cached data to prevent stale data on next login
    clearAuth();
    navigate("/signin");
  };

  const handleFilterClick = (filter: FilterType) => {
    if (isSearchPage) {
      const filterParam = filter === "all" ? "" : `?filter=${filter}`;
      navigate(`/dashboard${filterParam}`);
    } else {
      onFilterChange(filter);
    }
    onClose();
  };

  const content = (
    <div className="w-55 shrink-0 border-r border-border bg-bg-secondary flex flex-col h-full select-none">
      {/* Header */}
      <div className="px-4 h-13 flex items-center justify-between border-b border-border">
        <Logo size="md" />
        <button
          onClick={onClose}
          className="md:hidden text-muted hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-5">
        {/* Library */}
        <div>
          <p className="px-4 mb-2 text-[11px] font-medium tracking-[0.08em] text-muted">
            LIBRARY
          </p>
          <nav className="flex flex-col gap-0.5">
            {libraryItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={!isSearchPage && activeFilter === item.id}
                onClick={() => handleFilterClick(item.id)}
              />
            ))}
          </nav>
        </div>

        {/* Tools */}
        <div>
          <p className="px-4 mb-2 text-[11px] font-medium tracking-[0.08em] text-muted">
            TOOLS
          </p>
          <nav className="flex flex-col gap-0.5">
            <NavItem
              icon={<Sparkles size={15} />}
              label="Ask AI"
              active={isSearchPage}
              onClick={() => {
                navigate("/search");
                onClose();
              }}
            />
          </nav>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <p className="text-foreground text-[13px] font-medium">
          {user?.username ?? "Guest"}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-muted text-[12px]">Personal</p>
          <button
            onClick={handleLogout}
            className="text-muted hover:text-foreground text-[12px] transition-colors flex items-center gap-1"
          >
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block h-screen sticky top-0">{content}</div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden"
            >
              {content}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
