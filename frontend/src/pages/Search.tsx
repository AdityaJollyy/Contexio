import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, RotateCcw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ContentCard } from "@/components/ui/ContentCard";
import { ContentModal } from "@/components/ui/ContentModal";
import { ContentDetailModal } from "@/components/ui/ContentDetailModal";
import { Spinner } from "@/components/ui/Spinner";
import { chatWithBrain } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/errors";
import { useContentContext } from "@/hooks/useContentContext";
import type { ContentItem, ChatSource } from "@/types";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
}

function sourceToContentItem(source: ChatSource): ContentItem {
  return {
    _id: source._id,
    title: source.title,
    description: source.description,
    link: source.link,
    type: source.type,
    status: "ready",
    retryCount: 0,
    retryAfter: null,
    createdAt: source.createdAt,
    updatedAt: source.createdAt,
  };
}

export default function Search() {
  const { deleteItem } = useContentContext();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState("");

  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;
    setChatError("");

    const userMessage: ChatMessage = { role: "user", text: chatInput };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsChatting(true);

    try {
      const data = await chatWithBrain({ query: userMessage.text });
      const assistantMessage: ChatMessage = {
        role: "assistant",
        text: data.answer,
        sources: data.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setChatError(getApiErrorMessage(err, "Chat failed"));
    } finally {
      setIsChatting(false);
      chatInputRef.current?.focus();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setChatError("");
  };

  const handleDeleteFromSource = (id: string) => {
    deleteItem(id);
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        sources: msg.sources?.filter((s) => s._id !== id),
      })),
    );
  };

  return (
    <DashboardLayout>
      {({ isAddModalOpen, onAddModalClose }) => (
        <div className="flex flex-col h-full">

          {/* Chat area */}
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
                    Ask anything about your saved content. AI will find the most
                    relevant items and answer from them.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
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
                      <p className="whitespace-pre-wrap">{msg.text}</p>

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
                                onDelete={handleDeleteFromSource}
                                onClick={(item) => setDetailItem(item)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isChatting && (
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

            {/* Input */}
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
                  placeholder="Ask anything about your saved content..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isChatting}
                  className="flex-1 h-9 bg-bg-input border border-border rounded-sm px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isChatting || !chatInput.trim()}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-sm bg-accent text-background hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isChatting ? <Spinner size={14} /> : <Send size={14} />}
                </button>
              </form>
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
        </div>
      )}
    </DashboardLayout>
  );
}
