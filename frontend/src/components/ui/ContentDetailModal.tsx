import { motion, AnimatePresence } from "framer-motion";
import { X, Pencil, ExternalLink } from "lucide-react";
import { YoutubeIcon, XIcon, GithubIcon } from "@/components/ui/BrandIcons";
import { FileText, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ContentItem, ContentType } from "@/types";

interface Props {
  isOpen: boolean;
  item: ContentItem | null;
  onClose: () => void;
  onEdit: (item: ContentItem) => void;
}

const typeStripColor: Record<ContentType, string> = {
  youtube: "bg-type-youtube",
  twitter: "bg-type-twitter",
  github: "bg-type-github",
  text: "",
  others: "bg-type-others",
};

const typeLabel: Record<ContentType, string> = {
  youtube: "YouTube",
  twitter: "X",
  github: "GitHub",
  text: "Note",
  others: "Link",
};

function TypeIcon({ type }: { type: ContentType }) {
  const cls = "shrink-0";
  if (type === "youtube") return <YoutubeIcon size={14} className={cls} />;
  if (type === "twitter") return <XIcon size={14} className={cls} />;
  if (type === "github") return <GithubIcon size={14} className={cls} />;
  if (type === "text") return <FileText size={14} className={cls} />;
  return <LinkIcon size={14} className={cls} />;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ContentDetailModal({ isOpen, item, onClose, onEdit }: Props) {
  if (!item) return null;

  const hasStrip = item.type !== "text";

  const handleEdit = () => {
    onClose();
    onEdit(item);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="detail-modal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="w-full max-w-lg bg-bg-card border border-border rounded-xl shadow-2xl pointer-events-auto flex flex-col max-h-[85vh] overflow-hidden relative"
            >
              {/* Type colour strip */}
              {hasStrip && (
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${typeStripColor[item.type]}`}
                />
              )}

              {/* Header */}
              <div
                className={`flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-bg-secondary rounded-t-xl shrink-0 ${hasStrip ? "pl-6" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <h2 className="text-foreground text-[15px] font-medium leading-snug break-words">
                    {item.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 text-muted">
                    <TypeIcon type={item.type} />
                    <span className="text-[12px]">{typeLabel[item.type]}</span>
                    <span className="text-[12px] text-muted/50">·</span>
                    <span className="text-[12px] font-mono text-muted/50">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-muted hover:text-foreground transition-colors shrink-0 mt-0.5"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div
                className={`flex-1 overflow-y-auto p-5 ${hasStrip ? "pl-6" : ""}`}
              >
                {/* Description */}
                <div className="mb-4">
                  <p className="text-muted text-[11px] uppercase tracking-wide mb-1.5">
                    {item.type === "text" ? "Content" : "Description"}
                  </p>
                  <p className="text-foreground text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                    {item.description || (
                      <span className="text-muted italic">No description</span>
                    )}
                  </p>
                </div>

                {/* Link */}
                {item.link && (
                  <div>
                    <p className="text-muted text-[11px] uppercase tracking-wide mb-1.5">
                      Link
                    </p>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent-hover text-[13px] font-mono break-all transition-colors"
                    >
                      {item.link}
                    </a>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className={`flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-bg-secondary rounded-b-xl shrink-0 ${hasStrip ? "pl-6" : ""}`}
              >
                <Button variant="ghost" size="sm" onClick={handleEdit}>
                  <Pencil size={13} className="mr-1.5" />
                  Edit
                </Button>
                {item.link && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.open(item.link, "_blank")}
                  >
                    <ExternalLink size={13} className="mr-1.5" />
                    Open Link
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
