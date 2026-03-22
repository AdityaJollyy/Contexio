import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ContentCard } from "@/components/ui/ContentCard";
import { ContentModal } from "@/components/ui/ContentModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useContentContext } from "@/hooks/useContentContext";
import type { ContentItem } from "@/types";

export default function Dashboard() {
  const { contents, isLoading, error, deleteItem } = useContentContext();
  const [editItem, setEditItem] = useState<ContentItem | null>(null);

  return (
    <DashboardLayout>
      {({
        activeFilter,
        searchQuery,
        isAddModalOpen,
        onAddModalClose,
        onAddClick,
      }) => {
        const byType =
          activeFilter === "all" || activeFilter === "search"
            ? contents
            : contents.filter((c) => c.type === activeFilter);

        const filtered = searchQuery.trim()
          ? byType.filter(
              (c) =>
                c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.description.toLowerCase().includes(searchQuery.toLowerCase()),
            )
          : byType;

        return (
          <>
            <div className="p-4 sm:p-6">
              {isLoading && (
                <div className="flex items-center justify-center py-24">
                  <Spinner size={20} />
                </div>
              )}

              {!isLoading && error && (
                <div className="flex items-center justify-center py-24">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              {!isLoading && !error && filtered.length === 0 && (
                <EmptyState
                  filter={activeFilter}
                  isSearching={Boolean(searchQuery.trim())}
                  onAddClick={onAddClick}
                />
              )}

              {!isLoading && !error && filtered.length > 0 && (
                <motion.div
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                >
                  <AnimatePresence mode="popLayout">
                    {filtered.map((item) => (
                      <motion.div
                        key={item._id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                      >
                        <ContentCard
                          item={item}
                          onEdit={(i) => setEditItem(i)}
                          onDelete={deleteItem}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>

            <ContentModal
              isOpen={isAddModalOpen || Boolean(editItem)}
              onClose={() => {
                if (editItem) {
                  setEditItem(null);
                } else {
                  onAddModalClose();
                }
              }}
              editItem={editItem}
            />
          </>
        );
      }}
    </DashboardLayout>
  );
}
