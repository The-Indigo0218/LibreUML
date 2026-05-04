import { useTranslation } from "react-i18next";

export default function SleepScreen() {
  const { t } = useTranslation();

  const shortcuts = [
    { keys: ["Ctrl", "N"], description: t("sleepScreen.shortcuts.newFile") },
    { keys: ["Ctrl", "O"], description: t("sleepScreen.shortcuts.openFile") },
    { keys: ["Ctrl", "S"], description: t("sleepScreen.shortcuts.save") },
    { keys: ["Ctrl", "P"], description: t("sleepScreen.shortcuts.quickOpen") },
    { keys: ["Ctrl", "K"], description: t("sleepScreen.shortcuts.spotlight") },
    { keys: ["Ctrl", "E"], description: t("sleepScreen.shortcuts.export") },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-canvas-base relative">
      
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <img
          src="/logoTitle.svg"
          alt="LibreUML"
          className="w-96 h-96 object-contain grayscale"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center space-y-8 max-w-md">
        
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-text-muted">
            {t("sleepScreen.title")}
          </h2>
          <p className="text-sm text-text-muted opacity-70">
            {t("sleepScreen.subtitle")}
          </p>
        </div>

        <div className="w-full space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-4 py-2 rounded-lg bg-surface-secondary/50 border border-surface-border/30"
            >
              <span className="text-sm text-text-secondary">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <span key={keyIndex} className="flex items-center gap-1">
                    <kbd className="px-2 py-1 text-xs font-mono bg-surface-hover border border-surface-border rounded text-text-primary">
                      {key}
                    </kbd>
                    {keyIndex < shortcut.keys.length - 1 && (
                      <span className="text-text-muted text-xs">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>

      <div className="absolute bottom-8 text-center px-8">
        <p className="text-xs italic text-text-muted opacity-60 max-w-2xl">
          {t("sleepScreen.quote")}
        </p>
      </div>

    </div>
  );
}
