import { Search, Box, CircleDot, BoxSelect, StickyNote, X } from "lucide-react";
import { useSpotlight } from "../../hooks/useSpotlight";
import { useTranslation } from "react-i18next";

export default function SpotlightModal() {
  const { t } = useTranslation();
  const {
    isOpen,
    setIsOpen,
    searchTerm,
    setSearchTerm,
    filteredNodes,
    onSelectNode,
  } = useSpotlight();

  if (!isOpen) return null;

  // Helper for the icon based on type/stereotype
  const getNodeIcon = (type: string, stereotype?: string) => {
    if (type === "umlNote")
      return <StickyNote className="w-4 h-4 text-uml-note-border" />;
    if (stereotype === "interface")
      return <CircleDot className="w-4 h-4 text-uml-interface-border" />;
    if (stereotype === "abstract")
      return <BoxSelect className="w-4 h-4 text-uml-abstract-border" />;
    return <Box className="w-4 h-4 text-uml-class-border" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Container */}
      <div className="w-full max-w-xl bg-surface-primary border border-surface-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-200">
        {/* Header with Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border bg-surface-secondary/50">
          <Search className="w-5 h-5 text-text-muted" />
          <input
            autoFocus
            type="text"
            placeholder={t('modals.spotlight.placeholder')}
            className="flex-1 bg-transparent border-none outline-none text-text-primary placeholder-text-muted text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-surface-border bg-surface-hover px-1.5 font-mono text-[10px] font-medium text-text-muted opacity-100">
              <span className="text-xs">{t('modals.spotlight.esc')}</span>
            </kbd>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Result List */}
        <div className="max-h-96 overflow-y-auto custom-scrollbar p-2">
          {filteredNodes.length > 0 ? (
            filteredNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-hover transition-colors group text-left"
              >
                <div className="p-2 rounded-md bg-surface-secondary border border-surface-border group-hover:border-uml-class-border/30 transition-colors">
                  {getNodeIcon(node.type || "umlClass", node.data.stereotype)}
                </div>

                <div className="flex-1 truncate">
                  <span className="block font-medium text-text-primary group-hover:text-uml-class-border transition-colors">
                    {node.data.label || "Untitled"}
                  </span>
                  {node.type === "umlNote" && (
                    <span className="text-xs text-text-muted truncate block max-w-md">
                      {node.data.content || "Empty note..."}
                    </span>
                  )}
                  {node.type !== "umlNote" && (
                    <span className="text-xs text-text-muted font-mono">
                      {node.data.stereotype || "class"}
                    </span>
                  )}
                </div>

                <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                  {t('modals.spotlight.jumpTo')}
                </span>
              </button>
            ))
          ) : (
            <div className="py-12 text-center text-text-muted">
              <p>{t('modals.spotlight.noResults', { searchTerm })}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-surface-secondary px-4 py-2 border-t border-surface-border flex justify-between items-center text-xs text-text-muted">
          <span>{filteredNodes.length} {t('modals.spotlight.elementsFound')}</span>
          <div className="flex gap-2">
            <span>
             {t('modals.spotlight.navigate')} <kbd>↑</kbd> <kbd>↓</kbd>
            </span>
            <span>
              {t('modals.spotlight.select')} <kbd>↵</kbd>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
