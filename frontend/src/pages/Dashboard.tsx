import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ContentCard } from "@/components/ui/ContentCard";
import { ContentModal } from "@/components/ui/ContentModal";
import { ContentDetailModal } from "@/components/ui/ContentDetailModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { useContentContext } from "@/hooks/useContentContext";
import { useSearch, MIN_QUERY_LENGTH } from "@/hooks/useSearch";
import type { ContentItem } from "@/types";

export default function Dashboard() {
  const { contents, isLoading, error, deleteItem } = useContentContext();
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Searching goes through the server so the clause ladder applies; browsing
  // by type stays a local filter over the loaded library.
  const search = useSearch(searchQuery);

  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      {({ activeFilter, isAddModalOpen, onAddModalClose, onAddClick }) => {
        const byType = (items: ContentItem[]) =>
          activeFilter === "all" || activeFilter === "search"
            ? items
            : items.filter((c) => c.type === activeFilter);

        const filtered = search.isActive
          ? byType(search.results)
          : byType(contents);
        const suggestions = search.isActive ? byType(search.suggestions) : [];

        const showSpinner = search.isActive ? search.isSearching : isLoading;
        const errorMessage = search.isActive ? search.error : error;
        const showResults = !showSpinner && !errorMessage;
        const isEmpty = filtered.length === 0 && suggestions.length === 0;

        const grid = (items: ContentItem[]) => (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
          >
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
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
                    onDelete={() => setDeleteTarget(item)}
                    onClick={(i) => setDetailItem(i)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        );

        return (
          <>
            <div className="p-4 sm:p-6">
              {/* The server rejects anything shorter, so say so rather than
                  firing a request that can only come back 400. */}
              {search.tooShort && (
                <p className="text-muted text-[13px] pb-4">
                  Keep typing — a search needs at least {MIN_QUERY_LENGTH}{" "}
                  characters.
                </p>
              )}

              {showSpinner && (
                <div className="flex items-center justify-center py-24">
                  <Spinner size={20} />
                </div>
              )}

              {!showSpinner && errorMessage && (
                <div className="flex items-center justify-center py-24">
                  <p className="text-destructive text-sm">{errorMessage}</p>
                </div>
              )}

              {showResults && isEmpty && !search.tooShort && (
                <EmptyState
                  filter={activeFilter}
                  isSearching={search.isActive}
                  hasAnyContent={contents.length > 0}
                  onAddClick={onAddClick}
                />
              )}

              {/* A search that returns the whole library should look deliberate
                  rather than broken. */}
              {showResults && !isEmpty && (
                <p className="text-muted text-[13px] pb-3">
                  {filtered.length} {filtered.length === 1 ? "item" : "items"}
                </p>
              )}

              {showResults && filtered.length > 0 && grid(filtered)}

              {/* Fuzzy guesses stay in their own section; interleaving them
                  passes a near-miss off as a match. */}
              {showResults && suggestions.length > 0 && (
                <div className={filtered.length > 0 ? "mt-8" : ""}>
                  <p className="text-muted text-[13px] pb-3">
                    {filtered.length === 0
                      ? "No exact matches — did you mean:"
                      : "Similar items"}
                  </p>
                  {grid(suggestions)}
                </div>
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

            <ContentDetailModal
              isOpen={Boolean(detailItem)}
              item={detailItem}
              onClose={() => setDetailItem(null)}
              onEdit={(i) => setEditItem(i)}
            />

            <ConfirmDialog
              isOpen={Boolean(deleteTarget)}
              title="Delete this item?"
              message={`"${deleteTarget?.title ?? ""}" will be removed from your brain permanently. This cannot be undone.`}
              onConfirm={() => {
                if (deleteTarget) deleteItem(deleteTarget._id);
                setDeleteTarget(null);
              }}
              onCancel={() => setDeleteTarget(null)}
            />
          </>
        );
      }}
    </DashboardLayout>
  );
}
