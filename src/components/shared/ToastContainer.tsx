import { createPortal } from "react-dom";
import { X, Info } from "lucide-react";
import { useToastStore } from "../../store/toast.store";

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-8 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-3 bg-[#1a2235] border border-[#2d3f5c] text-slate-300 text-xs px-4 py-3 rounded-lg shadow-2xl pointer-events-auto w-80"
        >
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
          <span className="flex-1 leading-relaxed">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-slate-600 hover:text-slate-300 transition-colors -mt-0.5"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
