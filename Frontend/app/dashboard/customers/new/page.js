'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiPost } from '@/lib/api';
import { EMPTY, AvatarCircle } from '../_components/shared';
import CustomerFormBody from '../_components/CustomerFormBody';

export default function NewCustomerPage() {
  useAuth();
  const router       = useRouter();
  const { can, me }  = usePermissions();

  const [form,   setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (key) => (e) => { setForm(p => ({ ...p, [key]: e.target.value })); setError(''); };

  const handleSave = async (andNew = false) => {
    if (!form.name?.trim()) { setError('Customer name is required'); return; }
    setSaving(true); setError('');
    try {
      const created = await apiPost('/customers', form);
      if (andNew) { setForm(EMPTY); }
      else        { router.push(`/dashboard/customers/${created.id}`); }
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap">
          <nav className="flex items-center gap-1 text-sm flex-1">
            <Link href="/dashboard/customers" className="text-[#875A7B] hover:text-[#6d4a63] font-medium transition">Customers</Link>
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-gray-800 font-semibold">New</span>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => router.push('/dashboard/customers')} disabled={saving}
              className="h-8 px-4 text-sm border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">Discard</button>
            <button onClick={() => handleSave(true)} disabled={saving}
              className="h-8 px-4 text-sm border border-[#875A7B] rounded text-[#875A7B] hover:bg-[#875A7B]/5 transition font-medium disabled:opacity-50">Save &amp; New</button>
            <button onClick={() => handleSave(false)} disabled={saving}
              className="h-8 px-5 text-sm rounded text-white font-medium transition disabled:opacity-60" style={{ backgroundColor: '#875A7B' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 px-6 py-4 flex items-center gap-4">
            <AvatarCircle name={form.name || 'N'} size="lg" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">{form.name || 'New Customer'}</h1>
              <p className="text-xs text-gray-400 mt-0.5">Fill in the details and save</p>
            </div>
            <div className="ml-auto">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium ring-1 ${form.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${form.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                {form.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
            <CustomerFormBody form={form} set={set} readOnly={false} />
          </div>
          <div className="mt-4 flex justify-end">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 px-4 py-3 flex items-center gap-3">
              <button onClick={() => router.push('/dashboard/customers')} className="text-sm px-4 h-8 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition">Discard</button>
              <button onClick={() => handleSave(true)} disabled={saving}
                className="text-sm px-4 h-8 border border-[#875A7B] rounded text-[#875A7B] hover:bg-[#875A7B]/5 transition font-medium">Save &amp; New</button>
              <button onClick={() => handleSave(false)} disabled={saving}
                className="text-sm px-5 h-8 rounded text-white font-medium" style={{ backgroundColor: '#875A7B' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
