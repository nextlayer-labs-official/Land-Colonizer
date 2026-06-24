'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import { apiPost } from '@/lib/api';
import { EMPTY } from '../_components/shared';
import BrokerFormBody from '../_components/BrokerFormBody';

export default function NewBrokerPage() {
  useAuth();
  const router = useRouter();
  const [form,   setForm]   = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (key) => (e) => { setForm(p => ({ ...p, [key]: e.target.value })); setError(''); };

  const handleSave = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const b = await apiPost('/brokers', form);
      router.push(`/dashboard/brokers/${b.id}`);
    } catch (e) { setError(e.message); }
    finally     { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0 text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
            <span className="text-gray-300 mx-0.5">›</span>
            <Link href="/dashboard/brokers" className="hover:text-gray-700">Brokers</Link>
            <span className="text-gray-300 mx-0.5">›</span>
            <span className="text-gray-700 font-medium">New Broker</span>
          </nav>
          <div className="flex gap-2 shrink-0">
            <Link href="/dashboard/brokers" className="h-8 px-3 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center">Cancel</Link>
            <button onClick={handleSave} disabled={saving} className="h-8 px-5 text-sm rounded-lg text-white font-semibold" style={{ backgroundColor: '#875A7B' }}>
              {saving ? 'Saving…' : 'Save Broker'}
            </button>
          </div>
        </div>
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900 mb-5">New Broker</h1>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <BrokerFormBody form={form} set={set} />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Link href="/dashboard/brokers" className="h-9 px-5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center">Cancel</Link>
            <button onClick={handleSave} disabled={saving} className="h-9 px-6 text-sm rounded-lg text-white font-semibold" style={{ backgroundColor: '#875A7B' }}>
              {saving ? 'Saving…' : 'Save Broker'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
