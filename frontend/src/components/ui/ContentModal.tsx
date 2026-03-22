import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { YoutubeIcon, XIcon, GithubIcon } from "@/components/ui/BrandIcons";
import { FileText, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createContent, updateContent } from "@/lib/api";
import type { ContentItem, ContentType } from "@/types";
import axios from "axios";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editItem?: ContentItem | null;
}

const typeOptions: { id: ContentType; label: string; icon: React.ReactNode }[] =
  [
    { id: "youtube", label: "YouTube", icon: <YoutubeIcon size={15} /> },
    { id: "twitter", label: "X", icon: <XIcon size={15} /> },
    { id: "github", label: "GitHub", icon: <GithubIcon size={15} /> },
    { id: "text", label: "Note", icon: <FileText size={15} /> },
    { id: "others", label: "Link", icon: <LinkIcon size={15} /> },
  ];

const needsLink: ContentType[] = ["youtube", "twitter", "github", "others"];

export function ContentModal({ isOpen, onClose, onSuccess, editItem }: Props) {
  const isEditing = Boolean(editItem);

  const [type, setType] = useState<ContentType>("youtube");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (editItem) {
      setType(editItem.type);
      setTitle(editItem.title);
      setLink(editItem.link ?? "");
      setDescription(editItem.description ?? "");
    } else {
      setType("youtube");
      setTitle("");
      setLink("");
      setDescription("");
    }
    setError("");
  }, [editItem, isOpen]);

  const handleClose = () => {
    setError("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (needsLink.includes(type) && !link.trim()) {
      setError("A URL is required for this content type");
      return;
    }

    const payload = {
      title,
      description,
      type,
      link: needsLink.includes(type) ? link : undefined,
    };

    setIsLoading(true);
    try {
      if (isEditing && editItem) {
        await updateContent(editItem._id, payload);
      } else {
        await createContent(payload);
      }
      onSuccess();
      handleClose();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? "Something went wrong");
      } else {
        setError("Something went wrong");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              className="w-full max-w-md bg-bg-card border border-border rounded-xl shadow-2xl pointer-events-auto flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-secondary rounded-t-xl shrink-0">
                <h2 className="text-foreground text-[15px] font-medium">
                  {isEditing ? "Edit Content" : "Add to your Brain"}
                </h2>
                <button
                  onClick={handleClose}
                  className="text-muted hover:text-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto p-5">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Type selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-sm">Content Type</label>
                    <div className="grid grid-cols-5 gap-2">
                      {typeOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setType(opt.id)}
                          className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-[4px] border text-xs transition-all duration-100 ${
                            type === opt.id
                              ? "border-accent text-accent bg-accent/10"
                              : "border-border text-muted hover:text-foreground hover:border-border-hover bg-bg-input"
                          }`}
                        >
                          {opt.icon}
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-sm">Title</label>
                    <Input
                      placeholder="e.g. React Server Components Explained"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  {/* Link */}
                  {needsLink.includes(type) && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-muted text-sm">URL</label>
                      <Input
                        placeholder="https://..."
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Description */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-sm">
                      {type === "text"
                        ? "Note Content"
                        : "Personal Note (Optional)"}
                    </label>
                    <textarea
                      placeholder={
                        type === "text"
                          ? "Write your thoughts..."
                          : "Why are you saving this?"
                      }
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full bg-bg-input border border-border rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent resize-none transition-colors"
                    />
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-destructive text-sm"
                    >
                      {error}
                    </motion.p>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isLoading}
                    >
                      {isEditing ? "Save Changes" : "Save"}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
