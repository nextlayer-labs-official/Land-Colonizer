'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiDelete, apiPatch } from '@/lib/api';
import { fmtINR, fmtDate, TYPE_LABEL, POSS_COLOR, POSS_LABEL } from './_components/shared';

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

function effBalance(r) {
  const actual  = Number(r.actual_price    || 0);
  const advance = Number(r.advance_payment || 0);
  const bk      = Number(r.booking_amount  || 0);
  let instPaid  = 0;
  if (r.installment) {
    for (let n = 1; n <= 24; n++) {
      if (r.installment[`inst_${n}_paid`]) instPaid += Number(r.installment[`inst_${n}_amount`] || 0);
    }
  }
  const bal = actual - advance - (r.booking_in_received !== false ? bk : 0);
  return Math.max(0, bal - instPaid);
}

function ConfirmModal({ title, message, confirmLabel, confirmClass, item, onClose, onConfirm, busy }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-8 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className={`px-4 h-8 text-sm rounded-lg text-white min-w-[90px] ${confirmClass}`}>
            {busy ? `${confirmLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SalesPage() {
  useAuth();
  const router = useRouter();
  const { can, me } = usePermissions();

  const [navigatingId, setNavigatingId] = useState(null);
  const [rows,    setRows]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [delModal,       setDelModal]       = useState(null);
  const [deleting,       setDeleting]       = useState(false);
  const [archModal,      setArchModal]      = useState(null);
  const [archiving,      setArchiving]      = useState(false);
  const [unarchModal,    setUnarchModal]    = useState(null);
  const [unarchiving,    setUnarchiving]    = useState(false);
  const [showArchived,   setShowArchived]   = useState(false);

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilter,   setShowFilter]   = useState(false);
  const [exportOpen,   setExportOpen]   = useState(false);
  const filterRef = useRef(null);
  const exportRef  = useRef(null);

  const LIMIT = 15;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: p, limit: LIMIT, archived: showArchived ? 'true' : 'false' });
      if (search)       q.set('search', search);
      if (statusFilter) q.set('status', statusFilter);
      const data = await apiGet(`/sales?${q}`);
      setRows(data.sales || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [search, statusFilter, showArchived]);

  useEffect(() => { load(1); }, [search, statusFilter, showArchived]);

  useEffect(() => {
    const h = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
      if (exportRef.current  && !exportRef.current.contains(e.target))  setExportOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleExport = async (format) => {
    setExportOpen(false);
    const q = new URLSearchParams({ page: 1, limit: 9999, archived: showArchived ? 'true' : 'false' });
    if (search)       q.set('search', search);
    if (statusFilter) q.set('status', statusFilter);
    const data  = await apiGet(`/sales?${q}`);
    const items = data.sales || [];
    const date  = new Date().toISOString().slice(0, 10);
    const HEADERS = ['Sale Code','Type','Inventory','Project','Customer','Phone','Broker','Actual Price','Booking','Balance','Possession','Status','Sale Date'];
    const toRow   = r => [
      r.sale_code || `SAL-${String(r.id).padStart(4,'0')}`,
      TYPE_LABEL[r.type] || r.type || '',
      r.inventory?.inventory_code || '',
      r.inventory?.project?.name || '',
      r.customer?.name || '',
      r.customer?.phone || '',
      r.broker?.name || r.broker_name || '',
      r.actual_price || 0,
      r.booking_amount || 0,
      effBalance(r),
      POSS_LABEL[r.possession] || r.possession || '',
      r.status || '',
      r.sale_date ? fmtDate(r.sale_date) : fmtDate(r.created_at),
    ];
    if (format === 'csv') {
      dlCSV(toCSV(HEADERS, items.map(toRow)), `sales_${date}.csv`);
    } else {
      await dlXlsx(items.map(r => Object.fromEntries(HEADERS.map((h, i) => [h, toRow(r)[i]]))), 'Sales', `sales_${date}.xlsx`);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await apiPatch(`/sales/${archModal.id}/archive`);
      setArchModal(null);
      load(rows.length === 1 && page > 1 ? page - 1 : page);
    } finally { setArchiving(false); }
  };

  const handleUnarchive = async () => {
    setUnarchiving(true);
    try {
      await apiPatch(`/sales/${unarchModal.id}/unarchive`);
      setUnarchModal(null);
      load(rows.length === 1 && page > 1 ? page - 1 : page);
    } finally { setUnarchiving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDelete(`/sales/${delModal.id}`);
      setDelModal(null);
      load(rows.length === 1 && page > 1 ? page - 1 : page);
    } finally { setDeleting(false); }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const canCreate  = can('SALE_CREATE')  || me?.is_system;
  const canArchive = can('SALE_ARCHIVE') || me?.is_system;
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* Control panel */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap">
        {canCreate && !showArchived && (
          <button onClick={() => router.push('/dashboard/sales/new')} className="btn-primary text-sm h-8 px-4">New</button>
        )}

        {/* Archived toggle */}
        <button
          onClick={() => { setShowArchived(v => !v); setSearch(''); setStatusFilter(''); }}
          className={`flex items-center gap-1.5 h-8 px-3 text-sm border rounded transition-colors font-medium ${showArchived ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12"/>
          </svg>
          {showArchived ? 'Archived' : 'Archive'}
        </button>

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

        {/* Filter dropdown (only when not in archived view) */}
        {!showArchived && (
          <div className="relative" ref={filterRef}>
            <button onClick={() => setShowFilter(v => !v)}
              className={`flex items-center gap-1 text-sm h-8 px-3 rounded border transition-colors ${statusFilter ? 'bg-[#875A7B]/10 border-[#875A7B]/30 text-[#875A7B] font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              Filters {statusFilter && '(1)'}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showFilter && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
                <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</p>
                {[['', 'All'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']].map(([v, label]) => (
                  <button key={v} onClick={() => { setStatusFilter(v); setShowFilter(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${statusFilter === v ? 'text-[#875A7B] font-medium' : 'text-gray-700'}`}>
                    {label}
                    {statusFilter === v && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {statusFilter && (
          <span className="inline-flex items-center gap-1 bg-[#875A7B]/10 text-[#875A7B] text-xs font-medium px-2 py-1 rounded-full">
            {statusFilter}
            <button onClick={() => setStatusFilter('')} className="hover:opacity-70">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        )}

        <div className="ml-auto relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sale, customer, broker…"
            className="text-sm border border-gray-200 rounded h-8 pl-8 pr-3 w-60 focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition" />
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
              {['Sale Code', 'Inventory', 'Project', 'Customer', 'Broker', 'Actual Price', 'Balance', 'Possession', 'Status', 'Date', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(7).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {Array(11).fill(0).map((__, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                    <p className="text-sm font-medium text-gray-500">{showArchived ? 'No archived sales' : 'No sales found'}</p>
                    {canCreate && !showArchived && <button onClick={() => router.push('/dashboard/sales/new')} className="btn-primary text-sm mt-1">New Sale</button>}
                  </div>
                </td>
              </tr>
            ) : rows.map(row => (
              <tr key={row.id}
                onClick={() => { NProgress.start(); setNavigatingId(row.id); router.push(`/dashboard/sales/${row.id}`); }}
                className={`border-b border-gray-100 transition-colors select-none ${navigatingId === row.id ? 'bg-[#875A7B]/8 pointer-events-none' : 'cursor-pointer hover:bg-gray-50'}`}>
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{row.sale_code || `SAL-${String(row.id).padStart(4,'0')}`}</span>
                  {row.type && <div className="mt-0.5 text-[10px] text-gray-400">{TYPE_LABEL[row.type] || row.type}</div>}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-gray-800 text-xs">{row.inventory?.inventory_code || '—'}</p>
                  {row.inventory?.plot_no && <p className="text-[10px] text-gray-400">Plot {row.inventory.plot_no}</p>}
                </td>
                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                  {row.inventory?.project ? (
                    <Link href={`/dashboard/projects/${row.inventory.project.id}`}
                      className="text-xs font-medium text-violet-700 hover:underline">
                      {row.inventory.project.name}
                    </Link>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-gray-800">{row.customer?.name || '—'}</p>
                  {row.customer?.phone && <p className="text-xs text-gray-400">{row.customer.phone}</p>}
                </td>
                <td className="px-3 py-2.5 text-gray-600">{row.broker?.name || row.broker_name || '—'}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-900">{row.actual_price ? fmtINR(row.actual_price) : '—'}</td>
                <td className="px-3 py-2.5 text-gray-700">{effBalance(row) > 0 ? fmtINR(effBalance(row)) : '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ${POSS_COLOR[row.possession] || 'bg-gray-50 text-gray-500 ring-gray-200'}`}>
                    {POSS_LABEL[row.possession] || row.possession || '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {row.registration_completed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Registered
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${row.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDate(row.sale_date || row.created_at)}</td>
                <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                  {navigatingId === row.id ? (
                    <svg className="w-4 h-4 animate-spin text-[#875A7B] inline-block" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/></svg>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      {canArchive && !showArchived && (
                        <button onClick={() => setArchModal(row)} className="text-amber-500 hover:text-amber-700 text-xs hover:bg-amber-50 px-2 py-1 rounded transition">Archive</button>
                      )}
                      {canArchive && showArchived && (
                        <button onClick={() => setUnarchModal(row)} className="text-sky-600 hover:text-sky-800 text-xs hover:bg-sky-50 px-2 py-1 rounded transition">Unarchive</button>
                      )}
                      {me?.is_system && showArchived && (
                        <button onClick={() => setDelModal(row)} className="text-red-400 hover:text-red-600 text-xs hover:bg-red-50 px-2 py-1 rounded transition">Delete</button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        title="Archive sale?"
        message={archModal ? `${archModal.sale_code || `Sale #${archModal.id}`} will be hidden from the active list.` : ''}
        confirmLabel="Archive"
        confirmClass="bg-amber-500 hover:bg-amber-600"
        item={archModal}
        onClose={() => setArchModal(null)}
        onConfirm={handleArchive}
        busy={archiving}
      />
      <ConfirmModal
        title="Unarchive sale?"
        message={unarchModal ? `${unarchModal.sale_code || `Sale #${unarchModal.id}`} will be restored to the active list.` : ''}
        confirmLabel="Unarchive"
        confirmClass="bg-sky-600 hover:bg-sky-700"
        item={unarchModal}
        onClose={() => setUnarchModal(null)}
        onConfirm={handleUnarchive}
        busy={unarchiving}
      />
      <ConfirmModal
        title="Delete sale?"
        message={delModal ? `${delModal.sale_code || `Sale #${delModal.id}`} will be permanently deleted.` : ''}
        confirmLabel="Delete"
        confirmClass="bg-red-500 hover:bg-red-600"
        item={delModal}
        onClose={() => setDelModal(null)}
        onConfirm={handleDelete}
        busy={deleting}
      />
    </div>
  );
}
