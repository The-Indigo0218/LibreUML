// src/features/auth/components/ThemeSwitcher.tsx
//
// Toggles between light/dark theme in useSettingsStore.
// Visual CSS implementation is deferred to Phase 4; this just persists the preference.

import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../store/settingsStore';

export default function ThemeSwitcher() {
  const { t } = useTranslation();
  const theme    = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const isDark = theme === 'dark';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? t('settings.themeLight') : t('settings.themeDark')}
      title={isDark ? t('settings.themeLight') : t('settings.themeDark')}
      className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5" aria-hidden="true" />
      ) : (
        <Moon className="w-3.5 h-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
