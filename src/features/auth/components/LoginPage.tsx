import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Mail, Lock, User, ChevronDown, HelpCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/auth.store';
import { getOAuthUrl, register as apiRegister } from '../../../api/auth.api';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';
import HelpModal from './HelpModal';

type Mode = 'login' | 'register';
type OAuthProvider = 'github' | 'google';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuth();
  const enterLocalMode = useAuthStore((s) => s.enterLocalMode);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'TEACHER' | 'DEVELOPER'>('STUDENT');
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    clearError();
    setFormError(null);
    try {
      const apiBase = import.meta.env.VITE_API_URL ?? '/api/v1';
      const callbackBase = apiBase.startsWith('/')
        ? `${window.location.origin}${apiBase}`
        : apiBase;
      const redirectUri = `${callbackBase}/oauth/${provider}/callback`;
      const { authorizationUrl } = await getOAuthUrl(provider, redirectUri);
      window.location.href = authorizationUrl;
    } catch {
      setOauthLoading(null);
      setFormError(t('auth.errorTitle'));
    }
  };

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return t('auth.error.passwordTooShort');
    if (!/[a-z]/.test(pwd)) return t('auth.error.passwordNoLowercase');
    if (!/[A-Z]/.test(pwd)) return t('auth.error.passwordNoUppercase');
    if (!/[0-9]/.test(pwd)) return t('auth.error.passwordNoDigit');
    if (!/[@#$%^&+=!]/.test(pwd)) return t('auth.error.passwordNoSpecial');
    return null;
  };

  const validate = (): boolean => {
    if (!email.trim() || !password.trim()) {
      setFormError(t('auth.requiredField'));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError(t('auth.error.invalidEmail'));
      return false;
    }
    if (mode === 'register' && !fullName.trim()) {
      setFormError(t('auth.requiredField'));
      return false;
    }
    if (mode === 'register') {
      const pwdError = validatePassword(password);
      if (pwdError) {
        setFormError(pwdError);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFormError(null);
    if (!validate()) return;

    try {
      if (mode === 'register') {
        try {
          await apiRegister({ fullName, email, password, role });
        } catch (regErr: unknown) {
          type FieldError = { field?: string; message?: string; defaultMessage?: string };
          type ApiResponse = { status?: number; data?: { errors?: FieldError[]; message?: string } };
          const resp = (regErr as { response?: ApiResponse })?.response;
          if (!resp) {
            setFormError(t('auth.error.networkError'));
            return;
          }
          if (resp.status === 400) {
            const errors = resp.data?.errors;
            if (Array.isArray(errors) && errors.length > 0) {
              const messages = errors
                .map((e) => e.message ?? e.defaultMessage)
                .filter(Boolean)
                .join('. ');
              setFormError(messages || t('auth.validation.failed'));
            } else {
              setFormError(resp.data?.message ?? t('auth.validation.failed'));
            }
            return;
          }
          if (resp.status === 409) {
            setFormError(t('auth.error.emailExists'));
            return;
          }
          if (resp.status === 500) {
            setFormError(t('auth.error.serverError'));
            return;
          }
          setFormError(resp.data?.message ?? t('auth.errorTitle'));
          return;
        }
      }
      await login(email, password);
      navigate('/', { replace: true });
    } catch (loginErr: unknown) {
      type ApiResponse = { status?: number; data?: { message?: string } };
      const resp = (loginErr as { response?: ApiResponse })?.response;
      if (!resp) {
        setFormError(t('auth.error.networkError'));
        return;
      }
      if (resp.status === 401) {
        setFormError(t('auth.error.invalidCredentials'));
        return;
      }
      if (resp.status === 500) {
        setFormError(t('auth.error.serverError'));
        return;
      }
    }
  };

  const handleContinueOffline = () => {
    enterLocalMode();
    navigate('/', { replace: true });
  };

  const handleModeToggle = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    clearError();
    setFormError(null);
  };

  const displayError = formError ?? error;
  const isSubmitting = isLoading && oauthLoading === null;

  return (
    /* Scrollable full-screen container — content remains accessible at 1366×768 */
    <div className="min-h-screen w-screen bg-surface-primary overflow-y-auto">

      {/* Utility bar — fixed to top-right of the page flow (not viewport-fixed) */}
      <div className="sticky top-0 z-10 flex justify-end items-center gap-1 px-4 py-2 bg-surface-primary border-b border-surface-border/50">
        <LanguageSwitcher />
        <ThemeSwitcher />
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label={t('help.title')}
          title={t('help.title')}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Centred content — py-8 gives breathing room when scrolling */}
      <div className="flex items-start justify-center px-4 py-8 min-h-[calc(100vh-3rem)]">
        <div className="w-full max-w-md">

          {/* Branding */}
          <div className="flex flex-col items-center mb-8">
            <img
              src="/logoTitle.svg"
              alt="LibreUML"
              className="w-14 h-14 mb-4 drop-shadow-lg"
            />
            <h1 className="text-2xl font-bold text-text-primary">
              {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
            </h1>
            <p className="text-sm text-text-muted mt-1 text-center">
              {mode === 'login' ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
            </p>
          </div>

          <div className="bg-surface-secondary border border-surface-border rounded-xl p-6 space-y-4">

            {/* OAuth buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleOAuthLogin('github')}
                disabled={oauthLoading !== null || isSubmitting}
                aria-label={oauthLoading === 'github' ? t('auth.redirecting', { provider: 'GitHub' }) : t('auth.continueWithGithub')}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-surface-primary border border-surface-border hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors text-sm font-medium text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === 'github' ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-text-primary" aria-hidden="true" />
                ) : (
                  <Github className="w-4 h-4" aria-hidden="true" />
                )}
                {oauthLoading === 'github'
                  ? t('auth.redirecting', { provider: 'GitHub' })
                  : t('auth.continueWithGithub')}
              </button>

              <button
                type="button"
                onClick={() => handleOAuthLogin('google')}
                disabled={oauthLoading !== null || isSubmitting}
                aria-label={oauthLoading === 'google' ? t('auth.redirecting', { provider: 'Google' }) : t('auth.continueWithGoogle')}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-surface-primary border border-surface-border hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors text-sm font-medium text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === 'google' ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-text-primary" aria-hidden="true" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {oauthLoading === 'google'
                  ? t('auth.redirecting', { provider: 'Google' })
                  : t('auth.continueWithGoogle')}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3" aria-hidden="true">
              <div className="flex-1 h-px bg-surface-border" />
              <span className="text-xs text-text-muted">{t('auth.orContinueWith')}</span>
              <div className="flex-1 h-px bg-surface-border" />
            </div>

            {/* Email / password form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-3">
              {mode === 'register' && (
                <>
                  <div>
                    <label
                      htmlFor="login-fullname"
                      className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1"
                    >
                      {t('auth.fullNameLabel')}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
                      <input
                        id="login-fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t('auth.fullNamePlaceholder')}
                        autoComplete="name"
                        aria-required="true"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-primary border border-surface-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-role"
                      className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1"
                    >
                      {t('auth.roleLabel')}
                    </label>
                    <div className="relative">
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
                      <select
                        id="login-role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as typeof role)}
                        className="w-full px-3 py-2.5 rounded-lg bg-surface-primary border border-surface-border text-sm text-text-primary appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-colors"
                      >
                        <option value="STUDENT">{t('auth.roleStudent')}</option>
                        <option value="TEACHER">{t('auth.roleTeacher')}</option>
                        <option value="DEVELOPER">{t('auth.roleDeveloper')}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1"
                >
                  {t('auth.emailLabel')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    autoComplete="email"
                    aria-required="true"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-primary border border-surface-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1"
                >
                  {t('auth.passwordLabel')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    aria-required="true"
                    aria-describedby={mode === 'register' ? 'password-hint' : undefined}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-primary border border-surface-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-colors"
                  />
                </div>
                {mode === 'register' && (
                  <p id="password-hint" className="text-xs text-text-muted mt-1">
                    {t('auth.password.requirements')}
                  </p>
                )}
              </div>

              {/* Error message — role="alert" announces to screen readers */}
              {displayError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{displayError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={oauthLoading !== null || isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                )}
                {isSubmitting
                  ? (mode === 'login' ? t('auth.signingIn') : t('auth.registering'))
                  : (mode === 'login' ? t('auth.loginButton') : t('auth.registerButton'))}
              </button>
            </form>

            {/* Mode toggle */}
            <button
              type="button"
              onClick={handleModeToggle}
              className="w-full text-sm text-text-muted hover:text-text-primary focus:outline-none focus:underline transition-colors text-center py-1"
            >
              {mode === 'login' ? t('auth.switchToRegister') : t('auth.switchToLogin')}
            </button>
          </div>

          {/* Continue offline */}
          <div className="mt-4 text-center pb-4">
            <button
              type="button"
              onClick={handleContinueOffline}
              className="text-sm text-text-muted hover:text-text-secondary focus:outline-none focus:underline transition-colors underline decoration-dotted underline-offset-2"
            >
              {t('auth.continueOffline')}
            </button>
            <p className="text-xs text-text-muted mt-1">{t('auth.offlineNote')}</p>
          </div>
        </div>
      </div>

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
