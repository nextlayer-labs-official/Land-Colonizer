'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import { apiPost } from '@/lib/api';
import { EMPTY } from '../_components/shared';
import SaleFormBody from '../_components/SaleFormBody';

export default function NewSalePage() {
  useAuth();
  const router = useRouter();
  const [form,   setForm]   = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (key) => (e) => { setForm(p => ({ ...p, [key]: e.target.value })); setError(''); };

  const handleSave = async () => {
    if (!form.inventory_id) { setError('Inventory unit is required'); return; }
    setSaving(true); setError('');
    try {
      const { _inventory, _customer, _broker, ...payload } = form;
      const s = await apiPost('/sales', payload);
      router.push(`/dashboard/sales/${s.id}`);
    } catch (e) { setError(e.message); }
    finally     { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* Control bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0 text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-700 transition">Dashboard</Link>
            <span className="text-gray-300 mx-0.5">›</span>
            <Link href="/dashboard/sales" className="hover:text-gray-700 transition">Sales</Link>
            <span className="text-gray-300 mx-0.5">›</span>
            <span className="text-gray-700 font-medium">New Sale</span>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/dashboard/sales"
              className="h-8 px-3 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5">
              Cancel
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="h-8 px-5 text-sm rounded-lg text-white font-semibold transition" style={{ backgroundColor: '#875A7B' }}>
              {saving ? 'Saving…' : 'Save Sale'}
            </button>
          </div>
        </div>
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900 mb-5">New Sale</h1>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <SaleFormBody form={form} set={set} setForm={setForm} showFinancials={false} />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Link href="/dashboard/sales" className="h-9 px-5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center">Cancel</Link>
            <button onClick={handleSave} disabled={saving}
              className="h-9 px-6 text-sm rounded-lg text-white font-semibold transition" style={{ backgroundColor: '#875A7B' }}>
              {saving ? 'Saving…' : 'Save Sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
