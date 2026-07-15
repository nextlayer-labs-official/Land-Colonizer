'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost } from '@/lib/api';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const restored     = searchParams.get('restored') === '1';

  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/auth/login', form);
      localStorage.setItem('token', data.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {restored && (
        <div className="px-3 py-2.5 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
          Database restored successfully. Please log in again.
        </div>
      )}
      {error && (
        <div className="px-3 py-2.5 rounded bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@company.com"
          required
          autoFocus
          className="ams-input"
        />
      </div>

      <div>
        <div className="mb-1.5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
        </div>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="••••••••"
          required
          className="ams-input"
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-1">
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--ams-bg)' }}>
      <div className="w-full max-w-sm">

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

          {/* Brand strip */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 text-white text-xl font-black"
              style={{ backgroundColor: 'var(--ams-primary)' }}>
              A
            </div>
            <h1 className="text-xl font-bold text-gray-800">Welcome back</h1>
            <p className="text-xs text-gray-400 mt-0.5">Sign in to your account</p>
          </div>

          <div className="px-8 py-6">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>

      </div>
    </div>
  );
}
