'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiPut, apiDelete } from '@/lib/api';
import { EMPTY, fmtDate, fmtINR } from '../_components/shared';
import BrokerFormBody from '../_components/BrokerFormBody';

function LinkedRecordsPanel({ sales, purchases, brokerName }) {
  const [tab, setTab] = useState('sales');
  const tabs = [
    { key: 'sales',     label: 'Linked Sales',     count: sales.length },
    { key: 'purchases', label: 'Linked Purchases',  count: purchases.length },
  ];
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition border-b-2 -mb-px ${
              tab === t.key
                ? 'border-[#875A7B] text-[#875A7B]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            {t.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              tab === t.key ? 'bg-[#875A7B]/10 text-[#875A7B]' : 'bg-gray-100 text-gray-400'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Sales table */}
      {tab === 'sales' && (
        sales.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No sales linked to this broker.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['#', 'Sale Code', 'Unit', 'Customer', 'Amount', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.map((s, i) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">
                      {s.sale_code || `SAL-${String(s.id).padStart(4,'0')}`}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{s.inventory?.inventory_code || '—'}{s.inventory?.plot_no ? ` · Plot ${s.inventory.plot_no}` : ''}</td>
                  <td className="px-4 py-2.5 text-gray-700 font-medium">{s.customer?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700 font-semibold tabular-nums">{fmtINR(s.actual_price)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {s.status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/dashboard/sales/${s.id}`} className="text-xs text-[#875A7B] hover:underline font-medium">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {/* Purchases table */}
      {tab === 'purchases' && (
        purchases.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No purchases linked to this broker.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['#', 'Purchase Code', 'Location', 'Type', 'Role', 'Amount', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map((p, i) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">
                      {p.purchase_code || `PUR-${String(p.id).padStart(4,'0')}`}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-[140px] truncate">{p.location || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 capitalize">{p.type ? p.type.charAt(0) + p.type.slice(1).toLowerCase() : '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.purchase_broker_name === brokerName ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                      {p.purchase_broker_name === brokerName ? 'Purchase' : 'Sell'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 font-semibold tabular-nums">{fmtINR(p.purchase_price)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {p.status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/dashboard/purchases/${p.id}`} className="text-xs text-[#875A7B] hover:underline font-medium">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

function DeleteModal({ open, onClose, onConfirm, deleting }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete this broker?</h3>
        <p className="text-sm text-gray-500 mb-2">This broker will be permanently deleted. Associated sales will lose the broker link.</p>
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-5">This action cannot be undone — deleted data cannot be recovered.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-9 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 h-9 text-sm rounded-lg text-white bg-red-500 hover:bg-red-600 font-semibold transition disabled:opacity-60 min-w-[90px]">{deleting ? 'Deleting…' : 'Yes, Delete'}</button>
        </div>
      </div>
    </div>
  );
}

export default function BrokerDetailPage() {
  useAuth();
  const router = useRouter();
  const params = useParams();
  const { can, me } = usePermissions();

  const [form,     setForm]     = useState({ ...EMPTY });
  const [original, setOriginal] = useState({ ...EMPTY });
  const [broker,   setBroker]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');
  const [showDel,  setShowDel]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit   = me?.is_system;
  const canDelete = me?.is_system;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/brokers/${params.id}`);
      setBroker(data);
      const f = { name: data.name || '', phone: data.phone || '', email: data.email || '', details: data.details || '', status: data.status || 'ACTIVE' };
      setForm(f);
      setOriginal(f);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => { setForm(p => ({ ...p, [key]: e.target.value })); setError(''); };

  const handleEdit    = () => { setEditing(true); setSaved(false); setError(''); };
  const handleDiscard = () => { setForm(original); setEditing(false); setError(''); };
  const handleSave    = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      await apiPut(`/brokers/${params.id}`, form);
      setEditing(false); setSaved(true);
      await load();
    } catch (e) { setError(e.message); }
    finally     { setSaving(false); }
  };
  const handleDelete = async () => {
    setDeleting(true);
    try { await apiDelete(`/brokers/${params.id}`); router.push('/dashboard/brokers'); }
    catch (e) { setError(e.message); setDeleting(false); setShowDel(false); }
  };

  if (loading) return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between">
        <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="flex gap-2"><div className="h-8 w-20 bg-gray-100 rounded animate-pulse" /></div>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div className="h-48 bg-white rounded-xl border border-gray-200 animate-pulse" />
        <div className="h-64 bg-white rounded-xl border border-gray-200 animate-pulse" />
      </div>
    </div>
  );

  const sales     = broker?.sales     || [];
  const purchases = broker?.purchases || [];

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* Control bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0 text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
            <span className="text-gray-300 mx-0.5">›</span>
            <Link href="/dashboard/brokers" className="hover:text-gray-700">Brokers</Link>
            <span className="text-gray-300 mx-0.5">›</span>
            <span className="text-gray-700 font-medium">Broker Details</span>
          </nav>

          {saved && !editing && (
            <span className="text-xs text-emerald-600 flex items-center gap-1 shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved
            </span>
          )}

          {editing ? (
            <div className="flex gap-2 shrink-0">
              <button onClick={handleDiscard} className="h-8 px-4 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Discard</button>
              <button onClick={handleSave} disabled={saving} className="h-8 px-5 text-sm rounded-lg text-white font-semibold" style={{ backgroundColor: '#875A7B' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 shrink-0">
              <Link href="/dashboard/brokers" className="h-8 px-3 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Back
              </Link>
              {canEdit && (
                <button onClick={handleEdit} className="h-8 px-4 text-sm rounded-lg font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: '#875A7B' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Edit
                </button>
              )}
              {canDelete && (
                <button onClick={() => setShowDel(true)} className="h-8 px-3 text-sm border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition">Delete</button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Header + summary stat chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ backgroundColor: '#875A7B' }}>
              {broker?.name?.[0]?.toUpperCase() || 'B'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{broker?.name}</h1>
              <p className="text-sm text-gray-400">{broker?.broker_code}</p>
            </div>
            <span className={`ml-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${broker?.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${broker?.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {broker?.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            </span>
            {editing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Editing
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              {[
                { l: 'Sales',     v: sales.length,     c: 'text-violet-700 bg-violet-50 border-violet-100' },
                { l: 'Purchases', v: purchases.length, c: 'text-amber-700  bg-amber-50  border-amber-100'  },
                { l: 'Since',     v: fmtDate(broker?.created_at), c: 'text-gray-600 bg-gray-50 border-gray-100' },
              ].map(({ l, v, c }) => (
                <div key={l} className={`border rounded-lg px-3 py-1.5 text-center min-w-[70px] ${c}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{l}</p>
                  <p className="text-sm font-bold leading-tight">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Details form */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <BrokerFormBody form={form} set={set} readOnly={!editing} />
            {editing && (
              <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
                <button onClick={handleDiscard} className="h-8 px-4 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Discard</button>
                <button onClick={handleSave} disabled={saving} className="h-8 px-5 text-sm rounded-lg text-white font-semibold" style={{ backgroundColor: '#875A7B' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {/* Linked records — tab panel */}
          <LinkedRecordsPanel sales={sales} purchases={purchases} brokerName={broker?.name} />

        </div>
      </div>

      <DeleteModal open={showDel} onClose={() => setShowDel(false)} onConfirm={handleDelete} deleting={deleting} />
    </div>
  );
}
