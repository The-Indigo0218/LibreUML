import { useEffect } from "react";
import { CheckCircle, XCircle } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = "success", onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border ${
        type === "success" 
          ? "bg-surface-primary text-text-primary border-green-500/50 ring-1 ring-green-500/20" 
          : "bg-red-50 text-red-900 border-red-200"
      }`}>
        {type === "success" ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500" />
        )}
        <span className="font-medium text-sm">{message}</span>
      </div>
    </div>
  );
}