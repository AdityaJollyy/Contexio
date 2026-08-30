import { useState } from "react";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { YoutubeIcon, XIcon, GithubIcon } from "@/components/ui/BrandIcons";
import { FileText, Link as LinkIcon } from "lucide-react";
import type { ContentItem, ContentType } from "@/types";
import { useContentContext } from "@/hooks/useContentContext";

interface ContentCardProps {
  item: ContentItem;
  onEdit: (item: ContentItem) => void;
  onDelete: (id: string) => void;
  onClick: (item: ContentItem) => void;
}

const typeStripColor: Record<ContentType, string> = {
  youtube: "bg-type-youtube",
  twitter: "bg-type-twitter",
  github: "bg-type-github",
  text: "",
  others: "bg-type-others",
};

function TypeIcon({ type }: { type: ContentType }) {
  const cls = "shrink-0";
  if (type === "youtube") return <YoutubeIcon size={13} className={cls} />;
  if (type === "twitter") return <XIcon size={13} className={cls} />;
  if (type === "github") return <GithubIcon size={13} className={cls} />;
  if (type === "text") return <FileText size={13} className={cls} />;
  return <LinkIcon size={13} className={cls} />;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const NEEDS_ATTENTION =
  "Couldn't finish preparing this item for AI search. Tap for details.";

export function ContentCard({
  item,
  onEdit,
  onDelete,
  onClick,
}: ContentCardProps) {
  const { retryItem, isRetrying } = useContentContext();
  const [showFailure, setShowFailure] = useState(false);

  const hasStrip = item.type !== "text";
  const isWorking = item.status === "pending" || item.status === "processing";
  const hasFailed = item.status === "failed";
  // Two failures in a row means the service is down or out of quota for the
  // day, and a third click will not help.
  const canRetry = (item.manualRetries ?? 0) === 0;

  return (
    <div
      onClick={() => onClick(item)}
      className="group relative rounded-lg border bg-bg-card border-border hover:bg-bg-card-hover hover:border-border-hover hover:shadow-lg flex flex-col overflow-hidden transition-all duration-150 cursor-pointer"
    >
      {hasStrip && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-0.75 ${typeStripColor[item.type]}`}
        />
      )}

      <div
        className={`flex flex-col gap-1.5 p-3 h-full ${hasStrip ? "pl-4" : ""}`}
      >
        <div className="flex items-start justify-between gap-2 min-h-5">
          <h3 className="text-foreground text-[14px] font-medium leading-tight line-clamp-1 flex-1 pt-px">
            {item.title}
          </h3>
          <div className="shrink-0 flex items-center h-5">
            <div className="flex items-center gap-2 text-muted">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                className="hover:text-foreground transition-colors"
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item._id);
                }}
                className="hover:text-destructive transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-foreground transition-colors"
                  title="Open link"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        </div>

        <p className="text-muted text-[13px] leading-snug line-clamp-2 min-h-9">
          {item.description || "No description"}
        </p>

        {item.partial ? (
          <p className="text-muted/70 text-[11px] leading-snug line-clamp-2">
            Couldn't read this page — searchable from your title and note.
          </p>
        ) : item.link ? (
          <p className="text-muted/50 text-[11px] font-mono truncate">
            {item.link}
          </p>
        ) : (
          <div className="h-4" />
        )}

        <div className="flex-1" />

        {/* The left slot is empty for a ready item, so the row keeps its height
            and the date does not move. */}
        <div className="flex items-center justify-between gap-2 pt-1 text-muted/50">
          {isWorking ? (
            <span className="text-[11px]">Processing…</span>
          ) : hasFailed ? (
            <button
              type="button"
              title={`${item.failureReason ?? ""} ${NEEDS_ATTENTION}`.trim()}
              onClick={(e) => {
                e.stopPropagation();
                setShowFailure((open) => !open);
              }}
              className="flex items-center gap-1.5 text-[11px] text-warning hover:text-foreground transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
              Needs attention
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2 shrink-0">
            <TypeIcon type={item.type} />
            <span className="text-[11px] font-mono">
              {formatDate(item.createdAt)}
            </span>
          </div>
        </div>

        {/* Inline rather than a tooltip: hover does not exist on touch, and a
            floating element needs positioning that breaks on narrow screens. */}
        {hasFailed && showFailure && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-1 pt-2 border-t border-border flex flex-col gap-2"
          >
            <p className="text-muted text-[11px] leading-snug">
              {item.failureReason || "Something went wrong."}{" "}
              {canRetry
                ? "This only affects AI search — keyword search still finds this item."
                : "We tried again and it still didn't work. Please try tomorrow. Keyword search still finds this item."}
            </p>
            {canRetry && (
              <button
                type="button"
                disabled={isRetrying}
                onClick={() => retryItem(item._id)}
                className="self-start text-accent hover:text-accent-hover text-[11px] transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
