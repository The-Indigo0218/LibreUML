import { Laptop, XCircle } from "lucide-react";
import { useState } from "react";

const TEXTS = {
  es: {
    title: "Solo Desktop",
    message: "LibreUML es una herramienta de ingeniería que requiere precisión. Por favor, abre esta web en una computadora para diseñar tus diagramas.",
    footer: "Resolución actual no soportada"
  },
  en: {
    title: "Desktop Only",
    message: "LibreUML is an engineering tool that requires precision. Please open this app on a computer to design your diagrams.",
    footer: "Current resolution not supported"
  }
};

export default function MobileGuard() {
  const [lang] = useState<'es' | 'en'>(() => {
    if (typeof navigator === 'undefined') return 'en';
    
    const browserLang = navigator.language || (navigator.languages && navigator.languages[0]) || '';
    return browserLang.startsWith('es') ? 'es' : 'en';
  });

  const t = TEXTS[lang];

  return (
    <div className="fixed inset-0 z-9999 flex flex-col items-center justify-center p-6 text-center bg-gray-900 text-white md:hidden">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-500/20 rounded-full animate-pulse">
            <Laptop className="w-12 h-12 text-blue-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-3">{t.title}</h2>
        
        <p className="text-gray-400 mb-6 leading-relaxed">
          {t.message}
        </p>

        <div className="flex items-center justify-center gap-2 text-xs text-red-400 font-mono bg-red-900/20 p-2 rounded">
          <XCircle className="w-4 h-4" />
          {t.footer}
        </div>
      </div>
    </div>
  );
}