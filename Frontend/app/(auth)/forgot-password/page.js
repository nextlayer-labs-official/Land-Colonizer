'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPost } from '@/lib/api';

const RESEND_SECONDS = 60;
const STEPS = ['Email', 'Verify', 'New password'];

function Steps({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-5" aria-label={`Step ${step + 1} of 3`}>
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${i <= step ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
              style={i <= step ? { backgroundColor: 'var(--ams-primary)' } : undefined}>
              {i < step ? '✓' : i + 1}
            </span>
            <span className={`text-[11px] font-medium ${i === step ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && <span className="w-5 h-px bg-gray-200" />}
        </div>
      ))}
    </div>
  );
}

function ForgotPasswordForm() {
  const router = useRouter();
  const [step,     setStep]     = useState(0); // 0 email · 1 code · 2 new password
  const [email,    setEmail]    = useState('');
  const [code,     setCode]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [info,     setInfo]     = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);
  const startCooldown = () => {
    setCooldown(RESEND_SECONDS);
    clearInterval(timer.current);
    timer.current = setInterval(() => setCooldown(s => { if (s <= 1) { clearInterval(timer.current); return 0; } return s - 1; }), 1000);
  };

  const run = async (fn) => {
    setLoading(true); setError('');
    try { await fn(); } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const sendCode = (e) => {
    e?.preventDefault();
    run(async () => {
      const d = await apiPost('/auth/forgot-password', { email });
      setInfo(d.message); setStep(1); setCode(''); startCooldown();
    });
  };

  const verifyCode = (e) => {
    e.preventDefault();
    run(async () => {
      await apiPost('/auth/verify-reset-code', { email, code });
      setInfo(''); setStep(2);
    });
  };

  const resetPassword = (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    run(async () => {
      await apiPost('/auth/reset-password', { email, code, password });
      router.push('/login?reset=1');
    });
  };

  return (
    <>
      <Steps step={step} />
      {info && step === 1 && (
        <div className="mb-4 px-3 py-2.5 rounded bg-green-50 border border-green-200 text-green-700 text-sm">{info}</div>
      )}
      {error && (
        <div className="mb-4 px-3 py-2.5 rounded bg-red-50 border border-red-200 text-red-600 text-sm" role="alert">{error}</div>
      )}

      {step === 0 && (
        <form onSubmit={sendCode} className="space-y-4">
          <p className="text-sm text-gray-500">Enter the email you sign in with. We&apos;ll send you a 6-digit code to reset your password.</p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="you@company.com" required autoFocus className="ams-input" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? 'Sending…' : 'Send code'}
          </button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-sm text-gray-500">Enter the code sent to <span className="font-semibold text-gray-700">{email}</span>.</p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Verification code</label>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus required
              onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              placeholder="000000" className="ams-input text-center text-lg tracking-[0.5em] font-semibold" />
          </div>
          <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full justify-center py-2.5">
            {loading ? 'Verifying…' : 'Verify code'}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setStep(0); setError(''); setInfo(''); }} className="text-gray-500 hover:text-gray-700">
              Use a different email
            </button>
            <button type="button" onClick={sendCode} disabled={loading || cooldown > 0}
              className="font-medium disabled:text-gray-400" style={cooldown > 0 ? undefined : { color: 'var(--ams-primary)' }}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={resetPassword} className="space-y-4">
          <p className="text-sm text-gray-500">Choose a new password for <span className="font-semibold text-gray-700">{email}</span>.</p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">New password</label>
            <input type={showPw ? 'text' : 'password'} value={password} autoFocus required autoComplete="new-password"
              onChange={e => { setPassword(e.target.value); setError(''); }} placeholder="At least 6 characters" className="ams-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Confirm new password</label>
            <input type={showPw ? 'text' : 'password'} value={confirm} required autoComplete="new-password"
              onChange={e => { setConfirm(e.target.value); setError(''); }} placeholder="Re-enter the password" className="ams-input" />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500 select-none">
            <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} /> Show passwords
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? 'Saving…' : 'Reset password'}
          </button>
        </form>
      )}
    </>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--ams-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 text-white text-xl font-black"
              style={{ backgroundColor: 'var(--ams-primary)' }}>
              A
            </div>
            <h1 className="text-xl font-bold text-gray-800">Forgot password</h1>
            <p className="text-xs text-gray-400 mt-0.5">Reset it with a code sent to your email</p>
          </div>
          <div className="px-8 py-6">
            <ForgotPasswordForm />
            <p className="mt-5 text-center text-xs text-gray-500">
              Remembered it? <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--ams-primary)' }}>Back to sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
