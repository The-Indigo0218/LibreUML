import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  if (!user) return null;

  const initials = getInitials(user.fullName);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors text-white text-xs font-semibold select-none shrink-0"
        title={user.fullName}
        aria-label={t('auth.userMenu.avatarAlt')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {initials}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 bg-surface-secondary border border-surface-border rounded-lg shadow-xl py-1 z-50"
        >
          {/* User info */}
          <div className="px-3 py-2.5 border-b border-surface-border">
            <p className="text-sm font-medium text-text-primary truncate">{user.fullName}</p>
            <p className="text-xs text-text-muted truncate mt-0.5">{user.email}</p>
          </div>

          {/* Navigation items */}
          <div className="py-1">
            <button
              role="menuitem"
              onClick={() => { setIsOpen(false); navigate('/settings'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left"
            >
              <User className="w-4 h-4 shrink-0" />
              {t('auth.userMenu.profile')}
            </button>
            <button
              role="menuitem"
              onClick={() => { setIsOpen(false); navigate('/settings'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left"
            >
              <Settings className="w-4 h-4 shrink-0" />
              {t('auth.userMenu.settings')}
            </button>
          </div>

          <div className="border-t border-surface-border py-1">
            <button
              role="menuitem"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-surface-hover hover:text-red-300 transition-colors text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {t('auth.userMenu.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
