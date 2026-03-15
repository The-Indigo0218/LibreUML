import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FullScreenLoaderProps {
  isLoading: boolean;
}

export default function FullScreenLoader({ isLoading }: FullScreenLoaderProps) {
  const { t } = useTranslation();
  
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-4 p-8 bg-surface-primary border border-surface-border rounded-xl shadow-2xl">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-text-primary font-medium text-lg">
          {t('loading.file')}
        </p>
      </div>
    </div>
  );
}
