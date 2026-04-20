import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resetPassword as apiResetPassword } from '../../../api/auth.api';
import { useThemeSystem } from '../../../hooks/useThemeSystem';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useThemeSystem();

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return t('auth.error.passwordTooShort');
    if (!/[a-z]/.test(pwd)) return t('auth.error.passwordNoLowercase');
    if (!/[A-Z]/.test(pwd)) return t('auth.error.passwordNoUppercase');
    if (!/[0-9]/.test(pwd)) return t('auth.error.passwordNoDigit');
    if (!/[@#$%^&+=!]/.test(pwd)) return t('auth.error.passwordNoSpecial');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(t('auth.error.invalidResetToken'));
      return;
    }

    const pwdError = validatePassword(newPassword);
    if (pwdError) { setError(pwdError); return; }

    if (newPassword !== confirmPassword) {
      setError(t('auth.error.passwordMismatch'));
      return;
    }

    setIsLoading(true);
    try {
      await apiResetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: unknown) {
      type ApiResponse = { status?: number };
      const status = (err as { response?: ApiResponse })?.response?.status;
      if (status === 400 || status === 404) {
        setError(t('auth.error.invalidResetToken'));
      } else {
        setError(t('auth.error.resetFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-primary border border-surface-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-colors';

  return (
    <div className="min-h-screen w-full bg-surface-primary overflow-y-auto">

      <div className="sticky top-0 z-10 flex justify-end items-center gap-1 px-4 py-2 bg-surface-primary border-b border-surface-border/50">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <div className="flex items-start justify-center px-4 py-8 min-h-[calc(100vh-3rem)]">
        <div className="w-full max-w-md">

          <div className="flex flex-col items-center mb-8">
            <img src="/logoTitle.svg" alt="LibreUML" className="w-14 h-14 mb-4 drop-shadow-lg" />
            <h1 className="text-2xl font-bold text-text-primary">
              {success ? t('auth.resetPasswordSuccess') : t('auth.resetPasswordTitle')}
            </h1>
            <p className="text-sm text-text-muted mt-1 text-center">
              {success ? t('auth.resetPasswordSuccessMessage') : t('auth.resetPasswordSubtitle')}
            </p>
          </div>

          <div className="bg-surface-secondary border border-surface-border rounded-xl p-6">
            {success ? (
              <div className="space-y-4">
                <div className="flex justify-center py-4">
                  <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-400" aria-hidden="true" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/login', { replace: true })}
                  className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm font-medium text-white transition-colors"
                >
                  {t('auth.forgotPasswordBackToLogin')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-3">
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1"
                  >
                    {t('auth.newPasswordLabel')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('auth.newPasswordPlaceholder')}
                      autoComplete="new-password"
                      aria-required="true"
                      autoFocus
                      className={inputClass}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-1">{t('auth.password.requirements')}</p>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1"
                  >
                    {t('auth.confirmPasswordLabel')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('auth.confirmPasswordPlaceholder')}
                      autoComplete="new-password"
                      aria-required="true"
                      className={inputClass}
                    />
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                  )}
                  {isLoading ? t('auth.resetPasswordSaving') : t('auth.resetPasswordButton')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
