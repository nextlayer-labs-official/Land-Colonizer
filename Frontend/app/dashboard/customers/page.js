'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiDelete } from '@/lib/api';
import { AvatarCircle, fmtDate } from './_components/shared';

function toCSV(headers, rows) {
  const esc = v => { const s = v == null ? '' : String(v); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s; };
  return [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
}
function dlCSV(csv, name) { const b = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); }
async function dlXlsx(rows, sheet, name) {
  const mod = await import('xlsx');
  const X   = mod.default || mod;
  const ws  = X.utils.json_to_sheet(rows);
  const wb  = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, sheet);
  const buf  = X.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
import NProgress from 'nprogress';
import Pagination from '@/components/Pagination';

function DeleteModal({ item, onClose, onConfirm, deleting }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete customer?</h3>
        <p className="text-sm text-gray-500 mb-2">
          <strong>{item.name}</strong> will be permanently deleted.
        </p>
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-5">This action cannot be undone — deleted data cannot be recovered.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-9 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 h-9 text-sm rounded-lg text-white bg-red-500 hover:bg-red-600 font-semibold transition disabled:opacity-60 min-w-[90px]">
            {deleting ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  useAuth();
  const router = useRouter();
  const { can, me } = usePermissions();

  const [navigatingId, setNavigatingId] = useState(null);
  const [rows,     setRows]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState([]);
  const [delModal, setDelModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search,     setSearch]     = useState('');
  const [statusF,    setStatusF]    = useState('');
  const [showF,      setShowF]      = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const filterRef = useRef(null);
  const exportRef  = useRef(null);

  const LIMIT = 15;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: p, limit: LIMIT });
      if (search)  q.set('search', search);
      if (statusF) q.set('status', statusF);
      const data = await apiGet(`/customers?${q}`);
      setRows(data.customers || []);
      setTotal(data.total    || 0);
      setPage(p);
      setSelected([]);
    } finally { setLoading(false); }
  }, [search, statusF]);

  useEffect(() => { load(1); }, [search, statusF]);

  useEffect(() => {
    const h = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowF(false);
      if (exportRef.current  && !exportRef.current.contains(e.target))  setExportOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleExport = async (format) => {
    setExportOpen(false);
    const q = new URLSearchParams({ page: 1, limit: 9999 });
    if (search)  q.set('search', search);
    if (statusF) q.set('status', statusF);
    const data  = await apiGet(`/customers?${q}`);
    const items = data.customers || [];
    const date  = new Date().toISOString().slice(0, 10);
    const HEADERS = ['Code','Name','Phone','Email','Address','Type','Sales Count','Status','Created'];
    const toRow   = r => [
      r.customer_code || `CUS-${String(r.id).padStart(4,'0')}`,
      r.name || '', r.phone || '', r.email || '', r.address || '',
      r.type === 'COMPANY' ? 'Company' : 'Individual',
      r._count?.sales ?? 0, r.status || '', fmtDate(r.created_at),
    ];
    if (format === 'csv') {
      dlCSV(toCSV(HEADERS, items.map(toRow)), `customers_${date}.csv`);
    } else {
      await dlXlsx(items.map(r => Object.fromEntries(HEADERS.map((h, i) => [h, toRow(r)[i]]))), 'Customers', `customers_${date}.xlsx`);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDelete(`/customers/${delModal.id}`);
      setDelModal(null);
      load(rows.length === 1 && page > 1 ? page - 1 : page);
    } finally { setDeleting(false); }
  };

  const toggleSelect = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll    = () => setSelected(selected.length === rows.length ? [] : rows.map(r => r.id));
  const totalPages   = Math.ceil(total / LIMIT);
  const canCreate    = can('CUSTOMER_CREATE') || me?.is_system;
  const canDelete    = can('CUSTOMER_DELETE') || me?.is_system;
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* Control panel */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap">
        {canCreate && (
          <button onClick={() => router.push('/dashboard/customers/new')} className="btn-primary text-sm h-8 px-4">
            New
          </button>
        )}
        {selected.length > 0 && canDelete && (
          <button onClick={() => setDelModal(rows.find(r => r.id === selected[0]))} className="btn-danger text-sm h-8 px-3">
            Delete ({selected.length})
          </button>
        )}

        {/* Export */}
        <div className="relative" ref={exportRef}>
          <button onClick={() => setExportOpen(v => !v)}
            className="flex items-center gap-1.5 h-8 px-3 text-sm border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {exportOpen && (
            <div className="absolute left-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
              <button onClick={() => handleExport('csv')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">CSV</span>Export CSV
              </button>
              <button onClick={() => handleExport('excel')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">XLS</span>Export Excel
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Filters */}
        <div className="relative" ref={filterRef}>
          <button onClick={() => setShowF(v => !v)}
            className={`flex items-center gap-1 text-sm h-8 px-3 rounded border transition-colors ${statusF ? 'bg-[#875A7B]/10 border-[#875A7B]/30 text-[#875A7B] font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Filters
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showF && (
            <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
              <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</p>
              {[['', 'All'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']].map(([v, label]) => (
                <button key={v} onClick={() => { setStatusF(v); setShowF(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${statusF === v ? 'text-[#875A7B] font-medium' : 'text-gray-700'}`}>
                  {label}
                  {statusF === v && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                </button>
              ))}
            </div>
          )}
        </div>

        {statusF && (
          <span className="inline-flex items-center gap-1 bg-[#875A7B]/10 text-[#875A7B] text-xs font-medium px-2 py-1 rounded-full">
            {statusF}
            <button onClick={() => setStatusF('')}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </span>
        )}

        <div className="ml-auto relative">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search customers…"
            className="text-sm border border-gray-200 rounded h-8 pl-8 pr-3 w-56 focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition" />
          <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="w-px h-5 bg-gray-200 shrink-0" />
        <Pagination page={page} totalPages={totalPages} total={total} from={from} to={to} loading={loading} onPage={load} />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={selected.length === rows.length && rows.length > 0} onChange={toggleAll}
                  className="rounded border-gray-300 text-[#875A7B] focus:ring-[#875A7B]" />
              </th>
              {['Code', 'Customer', 'Phone', 'Email', 'Address', 'Type', 'Sales', 'Status', 'Created'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-3" />{Array(9).fill(0).map((__, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="py-20 text-center">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-500">No customers yet</p>
                  {canCreate && <button onClick={() => router.push('/dashboard/customers/new')} className="btn-primary text-sm">New Customer</button>}
                </div>
              </td></tr>
            ) : (
              rows.map(row => (
                <tr key={row.id}
                  onClick={() => { NProgress.start(); setNavigatingId(row.id); router.push(`/dashboard/customers/${row.id}`); }}
                  className={`border-b border-gray-100 transition-colors select-none ${navigatingId === row.id ? 'bg-[#875A7B]/8 pointer-events-none' : `cursor-pointer ${selected.includes(row.id) ? 'bg-[#875A7B]/5' : 'hover:bg-gray-50'}`}`}>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)}
                      className="rounded border-gray-300 text-[#875A7B] focus:ring-[#875A7B]" />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-1.5 py-0.5 rounded">
                      {row.customer_code || `CUS-${String(row.id).padStart(4,'0')}`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <AvatarCircle name={row.name} />
                      <span className="font-medium text-gray-900">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{row.phone || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600">{row.email || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[160px] truncate">{row.address || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500">{row.type === 'COMPANY' ? 'Company' : 'Individual'}</td>
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
                  <td className="px-3 py-2.5 text-right">
                    {navigatingId === row.id && (
                      <svg className="w-4 h-4 animate-spin text-[#875A7B] inline-block" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/></svg>
                    )}
                    {!navigatingId && <span className="text-gray-400 text-xs whitespace-nowrap">{fmtDate(row.created_at)}</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DeleteModal item={delModal} onClose={() => setDelModal(null)} onConfirm={handleDelete} deleting={deleting} />
    </div>
  );
}
