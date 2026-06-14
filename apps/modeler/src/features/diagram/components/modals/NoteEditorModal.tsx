import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

interface NoteEditorModalProps {
  isOpen: boolean;
  initialTitle: string;
  initialContent: string;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
}

export default function NoteEditorModal({
  isOpen,
  initialTitle,
  initialContent,
  onClose,
  onSave,
}: NoteEditorModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setContent(initialContent);
      setTimeout(() => contentRef.current?.focus(), 50);
    }
  }, [isOpen, initialTitle, initialContent]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(title.trim() || "Note", content);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-primary border border-surface-border rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

        <div className="px-4 py-3 border-b border-surface-border flex justify-between items-center bg-surface-secondary/50">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">
            {t("noteEditorModal.title")}
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              {t("noteEditorModal.titleLabel")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("noteEditorModal.titlePlaceholder")}
              className="w-full bg-surface-secondary border border-surface-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500"
              onKeyDown={(e) => { if (e.key === 'Enter') contentRef.current?.focus(); }}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              {t("noteEditorModal.contentLabel")}
            </label>
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("noteEditorModal.contentPlaceholder")}
              rows={6}
              className="w-full bg-surface-secondary border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500 resize-none font-mono"
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSave(); }}
            />
            <p className="text-[10px] text-text-muted mt-1">{t("noteEditorModal.shortcutHint")}</p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-surface-border flex justify-end gap-2 bg-surface-secondary/30">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-text-secondary border border-surface-border rounded hover:bg-surface-hover transition-colors"
          >
            {t("noteEditorModal.cancel")}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded hover:bg-indigo-500 transition-colors"
          >
            {t("noteEditorModal.save")}
          </button>
        </div>

      </div>
    </div>
  );
}
