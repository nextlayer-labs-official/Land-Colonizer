'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiPost } from '@/lib/api';
import { EMPTY, computed, StatusPipeline } from '../_components/shared';
import PurchaseFormBody from '../_components/PurchaseFormBody';

export default function NewPurchasePage() {
  useAuth();
  const router    = useRouter();
  const { can, me } = usePermissions();

  const [form,   setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const canCreate = can('PURCHASE_CREATE') || me?.is_system;

  const set = (key) => (e) => {
    setForm(p => ({ ...p, [key]: e.target.value }));
    setError('');
  };

  const c = computed(form);

  const handleSave = async (andNew = false) => {
    setSaving(true); setError('');
    try {
      const created = await apiPost('/purchases', form);
      if (andNew) {
        setForm(EMPTY);        // reset for another entry
        setError('');
      } else {
        router.push(`/dashboard/purchases/${created.id}`);
      }
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => router.push('/dashboard/purchases');

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* ── Control panel ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm min-w-0 flex-1">
            <Link href="/dashboard/purchases"
              className="text-[#875A7B] hover:text-[#6d4a63] font-medium transition shrink-0">
              Purchases
            </Link>
            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-800 font-semibold">New</span>
          </nav>

          {/* Status pipeline (always Draft for new) */}
          <div className="hidden sm:block">
            <StatusPipeline current={0} />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDiscard}
              disabled={saving}
              className="h-8 px-4 text-sm border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="h-8 px-4 text-sm border border-[#875A7B] rounded text-[#875A7B] hover:bg-[#875A7B]/5 transition disabled:opacity-50 font-medium"
            >
              Save &amp; New
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="h-8 px-5 text-sm rounded text-white font-medium transition disabled:opacity-60"
              style={{ backgroundColor: '#875A7B' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Record header card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 px-6 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#875A7B]/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#875A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">New Purchase</h1>
              <p className="text-xs text-gray-400 mt-0.5">Fill in the details and save to create the record</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ring-1 ${
                form.type === 'LAND' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                form.type === 'SHOP' ? 'bg-blue-50 text-blue-700 ring-blue-200'          :
                                       'bg-violet-50 text-violet-700 ring-violet-200'
              }`}>{form.type}</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active
              </span>
            </div>
          </div>

          {/* Form fields card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
            <PurchaseFormBody form={form} set={set} setForm={setForm} c={c} readOnly={false} />
          </div>

          {/* Floating save bar at bottom */}
          <div className="mt-4 flex justify-end">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 px-4 py-3 flex items-center gap-3">
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="text-sm px-4 h-8 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="text-sm px-4 h-8 border border-[#875A7B] rounded text-[#875A7B] hover:bg-[#875A7B]/5 transition font-medium disabled:opacity-50"
              >
                Save &amp; New
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="text-sm px-5 h-8 rounded text-white font-medium transition disabled:opacity-60"
                style={{ backgroundColor: '#875A7B' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
