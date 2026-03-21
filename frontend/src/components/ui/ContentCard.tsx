import { useState } from "react";
import { Pencil, Trash2, MoreHorizontal, ExternalLink } from "lucide-react";
import { YoutubeIcon, XIcon, GithubIcon } from "@/components/ui/BrandIcons";
import { FileText, Link as LinkIcon } from "lucide-react";
import type { ContentItem, ContentType, ProcessingStatus } from "@/types";

interface ContentCardProps {
  item: ContentItem;
  onEdit: (item: ContentItem) => void;
  onDelete: (id: string) => void;
}

const typeStripColor: Record<ContentType, string> = {
  youtube: "bg-type-youtube",
  twitter: "bg-type-twitter",
  github: "bg-type-github",
  text: "",
  others: "bg-type-others",
};

const statusDotColor: Record<ProcessingStatus, string> = {
  ready: "bg-status-ready",
  pending: "bg-status-pending animate-pulse",
  retrying: "bg-status-processing animate-pulse",
  failed: "bg-status-failed",
};

const statusLabel: Record<ProcessingStatus, string> = {
  ready: "Ready",
  pending: "Processing",
  retrying: "Retrying",
  failed: "Failed",
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

export function ContentCard({ item, onEdit, onDelete }: ContentCardProps) {
  const [hovered, setHovered] = useState(false);
  const hasStrip = item.type !== "text";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative rounded-lg border flex flex-col overflow-hidden transition-all duration-150 ${
        hovered
          ? "bg-bg-card-hover border-border-hover shadow-lg"
          : "bg-bg-card border-border"
      }`}
    >
      {/* Type colour strip */}
      {hasStrip && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-0.75 ${typeStripColor[item.type]}`}
        />
      )}

      <div
        className={`flex flex-col gap-1.5 p-3 h-full ${hasStrip ? "pl-4" : ""}`}
      >
        {/* Row 1 — title + actions */}
        <div className="flex items-start justify-between gap-2 min-h-5">
          <h3 className="text-foreground text-[14px] font-medium leading-tight line-clamp-1 flex-1 pt-px">
            {item.title}
          </h3>

          <div className="shrink-0 flex items-center h-5">
            {hovered ? (
              <div className="flex items-center gap-2 text-muted">
                <button
                  onClick={() => onEdit(item)}
                  className="hover:text-foreground transition-colors"
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => onDelete(item._id)}
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
            ) : (
              <MoreHorizontal size={15} className="text-muted" />
            )}
          </div>
        </div>

        {/* Row 2 — description */}
        <p className="text-muted text-[13px] leading-snug line-clamp-2 min-h-9">
          {item.description || "No description"}
        </p>

        {/* Row 3 — link */}
        {item.link ? (
          <p className="text-muted/50 text-[11px] font-mono truncate">
            {item.link}
          </p>
        ) : (
          <div className="h-4" />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Row 4 — status + date + type icon */}
        <div className="flex items-center justify-between pt-1">
          <div
            className="flex items-center gap-1.5"
            title={`Status: ${statusLabel[item.status]}`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotColor[item.status]}`}
            />
            <span className="text-muted/50 text-[11px] font-mono">
              {statusLabel[item.status]}
            </span>
          </div>

          <div className="flex items-center gap-2 text-muted/50">
            <TypeIcon type={item.type} />
            <span className="text-[11px] font-mono">
              {formatDate(item.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
