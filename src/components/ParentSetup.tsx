import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { cn } from '../lib/utils';
import { signUp, toAuthErrorMessage, useAuthSession } from '../auth';

interface ParentSetupProps {
  onBack: () => void;
  onComplete: () => void;
}

export function ParentSetup({ onBack, onComplete }: ParentSetupProps) {
  const { session, loading: sessionLoading, error: sessionError } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) onComplete();
  }, [onComplete, session]);

  const handleNext = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data, error: signUpError } = await signUp({ email: email.trim(), password });
      if (signUpError) setError(toAuthErrorMessage(signUpError));
      else if (data.session) onComplete();
      else setError('註冊成功，請先完成 Email 驗證，再登入。');
    } catch (signUpError) {
      setError(toAuthErrorMessage(signUpError));
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleNext} className="flex flex-col min-h-[100dvh] bg-blue-50 p-6">
      <button type="button" onClick={onBack} className="self-start p-2 text-blue-600 mb-8 rounded-full hover:bg-blue-100 transition-colors">
        <ArrowLeft size={24} />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-6">
          <KeyRound size={40} />
        </div>
        <h2 className="text-2xl font-bold text-blue-900 mb-2">建立家長帳號</h2>
        <p className="text-blue-600 text-center mb-8">建立 Supabase 帳號以跨裝置保存登入狀態。</p>

        <div className="w-full space-y-4">
          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1 px-1">Email</label>
            <input type="email" required autoComplete="email" placeholder="家長 Email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} className="w-full p-4 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg" />
          </div>
          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1 px-1">密碼</label>
            <input type="password" required minLength={6} autoComplete="new-password" placeholder="至少 6 碼" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className="w-full p-4 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg" />
          </div>

          {(error || sessionError) && <p role="alert" className="text-red-500 text-sm mt-2 px-1">{error || sessionError}</p>}

          <button
            onClick={handleNext}
            className={cn(
              "w-full p-4 rounded-xl text-white font-medium text-lg transition-all",
              email && password && !sessionLoading && !submitting ? "bg-blue-500 hover:bg-blue-600 active:scale-[0.98]" : "bg-blue-300 cursor-not-allowed"
            )}
            disabled={!email || !password || sessionLoading || submitting}
          >
            {submitting ? '建立中…' : '建立帳號'}
          </button>
        </div>
      </div>
    </form>
  );
}
