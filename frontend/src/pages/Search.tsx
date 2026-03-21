import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search as SearchIcon, Send, Sparkles, RotateCcw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ContentCard } from "@/components/ui/ContentCard";
import { ContentModal } from "@/components/ui/ContentModal";
import { Spinner } from "@/components/ui/Spinner";
import { regularSearch, chatWithBrain } from "@/lib/api";
import { useContent } from "@/hooks/useContent";
import type { ContentItem, ChatSource } from "@/types";
import axios from "axios";

type Mode = "search" | "chat";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
}

export default function Search() {
  const [mode, setMode] = useState<Mode>("search");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState("");

  // Edit modal
  const [editItem, setEditItem] = useState<ContentItem | null>(null);

  const { fetchContents, deleteItem } = useContent();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchError("");
    setIsSearching(true);
    setHasSearched(true);
    try {
      const data = await regularSearch(searchQuery);
      setSearchResults(data.contents);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setSearchError(err.response?.data?.message ?? "Search failed");
      } else {
        setSearchError("Something went wrong");
      }
    } finally {
      setIsSearching(false);
    }
  };

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
      if (axios.isAxiosError(err)) {
        setChatError(err.response?.data?.message ?? "Chat failed");
      } else {
        setChatError("Something went wrong");
      }
    } finally {
      setIsChatting(false);
      chatInputRef.current?.focus();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setChatError("");
  };

  return (
    <DashboardLayout>
      {({ isAddModalOpen, onAddModalClose }) => (
        <div className="flex flex-col h-full">
          {/* Mode tabs + header */}
          <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-border shrink-0">
            <h1 className="text-foreground text-[15px] font-medium mb-4">
              Search
            </h1>
            <div className="flex items-center gap-1 bg-bg-secondary border border-border rounded-md p-1 w-fit">
              {(["search", "chat"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm transition-colors ${
                    mode === m
                      ? "bg-bg-card text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {m === "search" ? (
                    <SearchIcon size={13} />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  {m === "search" ? "Search" : "Ask AI"}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Search mode */}
            {mode === "search" && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex-1 overflow-y-auto px-4 sm:px-6 py-4"
              >
                {/* Search input */}
                <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                  <div className="relative flex-1">
                    <SearchIcon
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    />
                    <input
                      type="text"
                      placeholder="Search by title or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-9 bg-bg-input border border-border rounded-sm pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-9 px-4 bg-accent text-background rounded-sm text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                  >
                    {isSearching ? <Spinner size={14} /> : "Search"}
                  </button>
                </form>

                {/* Error */}
                {searchError && (
                  <p className="text-destructive text-sm mb-4">{searchError}</p>
                )}

                {/* Loading */}
                {isSearching && (
                  <div className="flex justify-center py-12">
                    <Spinner size={20} />
                  </div>
                )}

                {/* No results */}
                {!isSearching && hasSearched && searchResults.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-muted text-sm">
                      No results found for "{searchQuery}"
                    </p>
                  </div>
                )}

                {/* Results grid */}
                {!isSearching && searchResults.length > 0 && (
                  <div>
                    <p className="text-muted text-xs font-mono mb-3">
                      {searchResults.length} result
                      {searchResults.length !== 1 ? "s" : ""}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {searchResults.map((item) => (
                        <ContentCard
                          key={item._id}
                          item={item}
                          onEdit={(i) => setEditItem(i)}
                          onDelete={async (id) => {
                            await deleteItem(id);
                            setSearchResults((prev) =>
                              prev.filter((r) => r._id !== id),
                            );
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Chat mode */}
            {mode === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0"
              >
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
                  {/* Empty state */}
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                      <div className="w-10 h-10 rounded-xl border border-border bg-bg-card flex items-center justify-center text-accent mb-3">
                        <Sparkles size={18} />
                      </div>
                      <h3 className="text-foreground text-sm font-medium mb-1">
                        Ask your Brain
                      </h3>
                      <p className="text-muted text-sm max-w-xs">
                        Ask anything about your saved content. AI will find the
                        most relevant items and answer from them.
                      </p>
                    </div>
                  )}

                  {/* Messages */}
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
                          className={`max-w-[80%] sm:max-w-[65%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-accent text-background"
                              : "bg-bg-card border border-border text-foreground"
                          }`}
                        >
                          <p>{msg.text}</p>

                          {/* Sources */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                              <p className="text-muted text-[11px] font-mono mb-1">
                                Sources
                              </p>
                              {msg.sources.map((source) => (
                                <a
                                  key={source._id}
                                  href={source.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-accent hover:text-accent-hover text-[12px] truncate transition-colors"
                                >
                                  {source.title}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Typing indicator */}
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

                  {/* Chat error */}
                  {chatError && (
                    <p className="text-destructive text-sm text-center">
                      {chatError}
                    </p>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* Chat input bar */}
                <div className="shrink-0 border-t border-border px-4 sm:px-6 py-3">
                  <form
                    onSubmit={handleChat}
                    className="flex items-center gap-2"
                  >
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Edit modal */}
          <ContentModal
            isOpen={Boolean(editItem)}
            onClose={() => setEditItem(null)}
            onSuccess={fetchContents}
            editItem={editItem}
          />

          {/* Add modal from topbar */}
          <ContentModal
            isOpen={isAddModalOpen}
            onClose={onAddModalClose}
            onSuccess={fetchContents}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
