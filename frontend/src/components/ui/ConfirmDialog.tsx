import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: Props) {
  // Escape is the expected way out of a destructive prompt.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — above the other modals so it can confirm from within one */}
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onCancel}
            className="fixed inset-0 bg-black/80 z-[60]"
          />

          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="confirm-modal"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-sm bg-bg-card border border-border rounded-xl shadow-2xl pointer-events-auto"
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 shrink-0 rounded-lg border border-border bg-bg-secondary flex items-center justify-center text-destructive">
                    <AlertTriangle size={15} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-foreground text-[15px] font-medium">
                      {title}
                    </h2>
                    <p className="text-muted text-[13px] leading-relaxed mt-1 break-words">
                      {message}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-5">
                  <Button variant="ghost" size="sm" onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onConfirm}
                    autoFocus
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
