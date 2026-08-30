import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Sparkles,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ContentCard } from "@/components/ui/ContentCard";
import { ContentModal } from "@/components/ui/ContentModal";
import { ContentDetailModal } from "@/components/ui/ContentDetailModal";
import { Spinner } from "@/components/ui/Spinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { chatWithBrainStream, getAiQuota } from "@/lib/api";
import { useContentContext } from "@/hooks/useContentContext";
import { AI_QUOTA_KEY } from "@/hooks/useContent";
import type { ContentItem, ChatSource, ChatQuota, MatchSummary } from "@/types";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
  /** Every match above the floor. Arrives with the answer; never re-fetched. */
  allMatches?: MatchSummary[];
  totalMatches?: number;
  totalCapped?: boolean;
}

const LIMIT_REACHED =
  "Daily limit reached — resets at midnight UTC. Plain search still works.";

// The model cites its sources inline; the markers are machinery, not prose.
const stripCitations = (text: string): string =>
  text.replace(/\[\[[a-f0-9]{24}\]\]/g, "").replace(/[ \t]{2,}/g, " ");

/**
 * Fallback for a match the library has not loaded yet. Everything a match
 * summary does not carry is left empty rather than guessed.
 */
function matchToContentItem(match: MatchSummary): ContentItem {
  return {
    _id: match.contentId,
    title: match.title,
    description: "",
    link: match.link,
    type: match.type,
    status: "ready",
    topics: [],
    createdAt: match.createdAt,
    updatedAt: match.createdAt,
  };
}

function sourceToContentItem(source: ChatSource): ContentItem {
  return {
    _id: source._id,
    title: source.title,
    description: source.description,
    link: source.link,
    type: source.type,
    status: "ready",
    topics: source.topics ?? [],
    createdAt: source.createdAt,
    updatedAt: source.createdAt,
  };
}

interface StreamError extends Error {
  status?: number;
  used?: number;
  limit?: number;
}

export default function Search() {
  const { contents, deleteItem } = useContentContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState("");

  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  // The matches came down with the answer, so expanding never hits the network.
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: quotaData } = useQuery({
    queryKey: AI_QUOTA_KEY,
    queryFn: getAiQuota,
    staleTime: 60000,
  });

  // Written back to the cache, not component state: this page unmounts on a tab
  // switch, and local state would fall back to the count cached at mount.
  const setQuota = (next: ChatQuota) =>
    queryClient.setQueryData(AI_QUOTA_KEY, next);

  const used = quotaData?.used ?? 0;
  const limit = quotaData?.limit ?? 0;
  const isLimitReached = limit > 0 && used >= limit;

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // A request still in flight when the page unmounts would set state on a dead
  // component and keep the server generating into a closed connection.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const sendMessage = async (query: string) => {
    setChatError("");
    setIsChatting(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // The placeholder is appended up front so tokens have somewhere to land.
    let index = -1;
    setMessages((prev) => {
      index = prev.length;
      return [...prev, { role: "assistant", text: "" }];
    });

    try {
      await chatWithBrainStream(
        { query },
        (text) => {
          setMessages((prev) =>
            prev.map((msg, i) =>
              i === index ? { ...msg, text: msg.text + text } : msg,
            ),
          );
        },
        (done) => {
          setQuota(done.quota);
          setMessages((prev) =>
            prev.map((msg, i) =>
              i === index
                ? {
                    ...msg,
                    text: done.text ?? msg.text,
                    sources: done.sources,
                    allMatches: done.allMatches,
                    totalMatches: done.totalMatches,
                    totalCapped: done.totalCapped,
                  }
                : msg,
            ),
          );
        },
        controller.signal,
      );
    } catch (err) {
      if (controller.signal.aborted) return;

      const error = err as StreamError;
      if (error.status === 429) {
        setQuota({ used: error.used ?? limit, limit: error.limit ?? limit });
        setChatError(LIMIT_REACHED);
      } else {
        setChatError(error.message || "Search failed");
      }

      // Drop the empty placeholder rather than leave a blank bubble behind.
      setMessages((prev) =>
        prev.filter((_, i) => i !== index || prev[i]?.text),
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsChatting(false);
      chatInputRef.current?.focus();
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = chatInput.trim();
    if (!query || isChatting || isLimitReached) return;

    setMessages((prev) => [...prev, { role: "user", text: query }]);
    setChatInput("");
    await sendMessage(query);
  };

  const clearChat = () => {
    setMessages([]);
    setChatError("");
    setExpanded({});
  };

  const handleDeleteFromSource = (id: string) => {
    deleteItem(id);
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        sources: msg.sources?.filter((s) => s._id !== id),
        allMatches: msg.allMatches?.filter((m) => m.contentId !== id),
        // Only the answers that actually matched it lose a match.
        totalMatches: msg.allMatches?.some((m) => m.contentId === id)
          ? Math.max((msg.totalMatches ?? 0) - 1, 0)
          : msg.totalMatches,
      })),
    );
  };

  const lastIndex = messages.length - 1;
  const byId = new Map(contents.map((item) => [item._id, item]));

  return (
    <DashboardLayout>
      {({ isAddModalOpen, onAddModalClose }) => (
        <div className="flex flex-col h-full">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  <div className="w-10 h-10 rounded-xl border border-border bg-bg-card flex items-center justify-center text-accent mb-3">
                    <Sparkles size={18} />
                  </div>
                  <h3 className="text-foreground text-sm font-medium mb-1">
                    Ask your Brain
                  </h3>
                  <p className="text-muted text-sm max-w-xs">
                    Describe something you saved, even vaguely. AI finds the
                    items that match and tells you why each one did.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, i) => {
                  const sourcedIds = new Set(
                    (msg.sources ?? []).map((s) => s._id),
                  );
                  const rest = (msg.allMatches ?? []).filter(
                    (m) => !sourcedIds.has(m.contentId),
                  );
                  const total = msg.totalMatches ?? 0;
                  const sourceCount = msg.sources?.length ?? 0;
                  // A capped total is a lower bound, shown as "17+".
                  const totalLabel = `${total}${msg.totalCapped ? "+" : ""}`;
                  const hasMore = total > sourceCount && rest.length > 0;
                  const isExpanded = Boolean(expanded[i]);

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[90%] sm:max-w-[75%] lg:max-w-[65%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-accent text-background"
                            : "bg-bg-card border border-border text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">
                          {msg.role === "assistant"
                            ? stripCitations(msg.text)
                            : msg.text}
                        </p>

                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 border-t border-border pt-3">
                            <p className="text-muted text-[11px] font-mono mb-2">
                              Here is the relevant content
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {msg.sources.map((source) => (
                                <ContentCard
                                  key={source._id}
                                  item={sourceToContentItem(source)}
                                  onEdit={(item) => setEditItem(item)}
                                  onDelete={() =>
                                    setDeleteTarget(sourceToContentItem(source))
                                  }
                                  onClick={(item) => setDetailItem(item)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {sourceCount > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {hasMore ? (
                              <>
                                <p className="text-muted text-[12px]">
                                  Found {totalLabel} matches. Showing the{" "}
                                  {sourceCount} closest.
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpanded((prev) => ({
                                      ...prev,
                                      [i]: !prev[i],
                                    }))
                                  }
                                  className="flex items-center gap-1 text-accent hover:text-accent-hover text-[12px] transition-colors"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp size={13} />
                                      Hide
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={13} />
                                      Show all {totalLabel}
                                    </>
                                  )}
                                </button>
                              </>
                            ) : (
                              <p className="text-muted text-[12px]">
                                Showing all {totalLabel}{" "}
                                {total === 1 ? "match" : "matches"}.
                              </p>
                            )}
                          </div>
                        )}

                        {hasMore && isExpanded && (
                          <div className="mt-3 border-t border-border pt-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {rest.map((match) => {
                                // The library is already loaded, so a match
                                // resolves to the full item and behaves like
                                // every other card.
                                const item =
                                  byId.get(match.contentId) ??
                                  matchToContentItem(match);
                                return (
                                  <ContentCard
                                    key={item._id}
                                    item={item}
                                    onEdit={(i) => setEditItem(i)}
                                    onDelete={() => setDeleteTarget(item)}
                                    onClick={(i) => setDetailItem(i)}
                                  />
                                );
                              })}
                            </div>
                            {/* Capped server-side; past it, browsing is plain
                                search's job. */}
                            {total > (msg.allMatches?.length ?? 0) && (
                              <p className="mt-2 text-muted/70 text-[11px]">
                                Showing the first {msg.allMatches?.length} — use
                                search to browse everything.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {isChatting && messages[lastIndex]?.text === "" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-muted"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {chatError && (
                <p className="text-destructive text-sm text-center">
                  {chatError}
                </p>
              )}

              <div ref={chatBottomRef} />
            </div>

            <div className="shrink-0 border-t border-border px-4 sm:px-6 py-3">
              <form onSubmit={handleChat} className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearChat}
                    title="Clear chat"
                    className="text-muted hover:text-foreground transition-colors shrink-0"
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder="Describe something you saved..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isChatting || isLimitReached}
                  className="flex-1 h-9 bg-bg-input border border-border rounded-sm px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isChatting || isLimitReached || !chatInput.trim()}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-sm bg-accent text-background hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isChatting ? <Spinner size={14} /> : <Send size={14} />}
                </button>
              </form>

              {/* A dead end with no alternative reads as a broken app. */}
              {isLimitReached ? (
                <p className="mt-2 text-muted text-[12px]">
                  {LIMIT_REACHED}{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    Go to search
                  </button>
                </p>
              ) : (
                limit > 0 && (
                  <p className="mt-2 text-muted text-[12px]">
                    {used} / {limit} AI searches today
                  </p>
                )
              )}
            </div>
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
            onEdit={(item) => setEditItem(item)}
          />

          <ConfirmDialog
            isOpen={Boolean(deleteTarget)}
            title="Delete this item?"
            message={`"${deleteTarget?.title ?? ""}" will be removed from your brain permanently. This cannot be undone.`}
            onConfirm={() => {
              if (deleteTarget) handleDeleteFromSource(deleteTarget._id);
              setDeleteTarget(null);
            }}
            onCancel={() => setDeleteTarget(null)}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
