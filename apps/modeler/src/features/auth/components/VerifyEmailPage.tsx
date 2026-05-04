import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { verifyEmail as apiVerifyEmail } from '../../../api/auth.api';
import { useThemeSystem } from '../../../hooks/useThemeSystem';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useThemeSystem();

  useEffect(() => {
    if (!token) { setStatus('error'); return; }

    apiVerifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

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
              {status === 'loading' && t('auth.verifyEmailTitle')}
              {status === 'success' && t('auth.verifyEmailSuccess')}
              {status === 'error'   && t('auth.verifyEmailError')}
            </h1>
            <p className="text-sm text-text-muted mt-1 text-center">
              {status === 'loading' && t('auth.verifyEmailSubtitle')}
              {status === 'success' && t('auth.verifyEmailSuccessMessage')}
              {status === 'error'   && t('auth.verifyEmailErrorMessage')}
            </p>
          </div>

          <div className="bg-surface-secondary border border-surface-border rounded-xl p-6">

            {status === 'loading' && (
              <div className="flex justify-center py-6">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-border border-t-violet-500" aria-label="Loading" />
              </div>
            )}

            {status === 'success' && (
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
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="flex justify-center py-4">
                  <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-red-400" aria-hidden="true" />
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
