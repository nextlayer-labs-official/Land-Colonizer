'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPost } from '@/lib/api';

const EMPTY = { name: '', location: '', status: 'OPEN' };

export default function NewProjectPage() {
  const router = useRouter();
  const [form,   setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Project name is required'); return; }
    setSaving(true); setError('');
    try {
      const p = await apiPost('/projects', form);
      router.push(`/dashboard/projects/${p.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create project');
      setSaving(false);
    }
  };

  const inp = 'w-full h-10 border border-gray-200 rounded-xl px-3 text-sm focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/20 bg-white';

  return (
    <div className="p-4 pb-10 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/projects" className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </Link>
        <div>
          <h1 className="text-xl font-black text-gray-900">New Project</h1>
          <p className="text-xs text-gray-400">Create a real estate project</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
            Project Name <span className="text-red-400">*</span>
          </label>
          <input value={form.name} onChange={set('name')} placeholder="e.g. Green Valley Phase 1" className={inp} />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Location</label>
          <input value={form.location} onChange={set('location')} placeholder="City, area or address…" className={inp} />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
          <select value={form.status} onChange={set('status')} className={inp}>
            <option value="OPEN">Open</option>
            <option value="ONGOING">Ongoing</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Link href="/dashboard/projects"
            className="flex-1 h-10 flex items-center justify-center text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 h-10 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
            style={{ backgroundColor: '#875A7B' }}>
            {saving ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
