'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiDelete } from '@/lib/api';
import NProgress from 'nprogress';
import Pagination from '@/components/Pagination';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function BrokersPage() {
  useAuth();
  const router = useRouter();
  const { can, me } = usePermissions();

  const [navigatingId, setNavigatingId] = useState(null);
  const [rows,    setRows]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [delId,   setDelId]   = useState(null);
  const [deleting, setDeleting] = useState(false);
  const LIMIT = 15;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: p, limit: LIMIT });
      if (search) q.set('search', search);
      const data = await apiGet(`/brokers?${q}`);
      setRows(data.brokers || []);
      setTotal(data.total  || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, [search]);

  const handleDelete = async () => {
    setDeleting(true);
    try { await apiDelete(`/brokers/${delId}`); setDelId(null); load(rows.length === 1 && page > 1 ? page - 1 : page); }
    finally { setDeleting(false); }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const canCreate  = me?.is_system;
  const canDelete  = me?.is_system;
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap">
        {canCreate && (
          <button onClick={() => router.push('/dashboard/brokers/new')} className="btn-primary text-sm h-8 px-4">New</button>
        )}
        <div className="ml-auto relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search broker…"
            className="text-sm border border-gray-200 rounded h-8 pl-8 pr-3 w-52 focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition" />
          <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="w-px h-5 bg-gray-200 shrink-0" />
        <Pagination page={page} totalPages={totalPages} total={total} from={from} to={to} loading={loading} onPage={load} />
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              {['Code', 'Name', 'Phone', 'Email', 'Sales', 'Status', 'Created', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array(6).fill(0).map((_, i) => (
              <tr key={i} className="border-b border-gray-100">
                {Array(8).fill(0).map((__, j) => <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
              </tr>
            )) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-20 text-center">
                  <p className="text-sm text-gray-400 mb-2">No brokers found</p>
                  {canCreate && <button onClick={() => router.push('/dashboard/brokers/new')} className="btn-primary text-sm">New Broker</button>}
                </td>
              </tr>
            ) : rows.map(row => (
              <tr key={row.id}
                onClick={() => { NProgress.start(); setNavigatingId(row.id); router.push(`/dashboard/brokers/${row.id}`); }}
                className={`border-b border-gray-100 transition-colors select-none ${navigatingId === row.id ? 'bg-[#875A7B]/8 pointer-events-none' : 'cursor-pointer hover:bg-gray-50'}`}>
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{row.broker_code || `BRK-${String(row.id).padStart(4,'0')}`}</span>
                </td>
                <td className="px-3 py-2.5 font-medium text-gray-900">{row.name}</td>
                <td className="px-3 py-2.5 text-gray-600">{row.phone || '—'}</td>
                <td className="px-3 py-2.5 text-gray-600">{row.email || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                    {row._count?.sales ?? 0} sale{(row._count?.sales ?? 0) !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${row.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-400">{fmtDate(row.created_at)}</td>
                <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                  {navigatingId === row.id ? (
                    <svg className="w-4 h-4 animate-spin text-[#875A7B] inline-block" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/></svg>
                  ) : canDelete && (
                    <button onClick={() => setDelId(row.id)} className="text-red-400 hover:text-red-600 text-xs hover:bg-red-50 px-2 py-1 rounded transition">Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDelId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Delete broker?</h3>
            <p className="text-sm text-gray-500 mb-5">This broker will be permanently deleted.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDelId(null)} className="px-4 h-8 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 h-8 text-sm rounded-lg text-white bg-red-500 hover:bg-red-600 min-w-[90px]">{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
