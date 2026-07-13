'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiDelete } from '@/lib/api';
import { STATUS_RING, UNIT_TYPE_RING, fmtINR, fmtNum } from './_components/shared';
import NProgress from 'nprogress';
import Pagination from '@/components/Pagination';

function buildRows(data) {
  return data.map(r => {
    const f = parseFloat(r.front_area) || 0;
    const b = parseFloat(r.back_area)  || 0;
    const totalArea = f && b ? parseFloat((f * (b / 9)).toFixed(2)) : (parseFloat(r.area) || 0);
    const areaUnit  = r.front_area_details || r.area_unit || '';
    return {
      Code:        r.inventory_code || '',
      Type:        r.type           || '',
      Purchase:    r.purchase?.purchase_code || '',
      Location:    r.location       || '',
      'SL No':     r.sl_no          || '',
      'Plot No':   r.plot_no        || '',
      'Total Area': totalArea       || '',
      'Area Unit': areaUnit,
      Rate:        r.rate           || '',
      Status:      r.status         || '',
    };
  });
}

function exportCSV(data) {
  const rows    = buildRows(data);
  const headers = Object.keys(rows[0] || { Code:'',Type:'',Purchase:'',Location:'','SL No':'','Plot No':'','Total Area':'','Area Unit':'',Rate:'',Status:'' });
  const escape  = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines   = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `inventory_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

async function exportExcel(data) {
  const mod  = await import('xlsx');
  const XLSX = mod.default || mod;
  const rows = buildRows(data);
  const ws   = XLSX.utils.json_to_sheet(rows);
  const wb   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `inventory_${new Date().toISOString().slice(0,10)}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

function DeleteModal({ item, onClose, onConfirm, deleting }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete unit?</h3>
        <p className="text-sm text-gray-500 mb-2">
          <strong>{item.inventory_code || item.plot_no || `Unit #${item.id}`}</strong> will be permanently deleted.
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

export default function InventoryPage() {
  useAuth();
  const router = useRouter();
  const { can, me } = usePermissions();

  const [navigatingId, setNavigatingId] = useState(null);
  const [rows,      setRows]      = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [delModal,  setDelModal]  = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [exporting, setExporting] = useState(false);

  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [showFilter,   setShowFilter]   = useState(false);
  const filterRef = useRef(null);

  const LIMIT = 15;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: p, limit: LIMIT });
      if (search)       q.set('search',    search);
      if (statusFilter) q.set('status',    statusFilter);
      if (typeFilter)   q.set('type', typeFilter);
      const data = await apiGet(`/inventory?${q}`);
      setRows(data.inventory || []);
      setTotal(data.total    || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [search, statusFilter, typeFilter]);

  useEffect(() => { load(1); }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    const h = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDelete(`/inventory/${delModal.id}`);
      setDelModal(null);
      load(rows.length === 1 && page > 1 ? page - 1 : page);
    } finally { setDeleting(false); }
  };

  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchExportData = async () => {
    const q = new URLSearchParams({ page: 1, limit: 10000 });
    if (search)       q.set('search', search);
    if (statusFilter) q.set('status', statusFilter);
    if (typeFilter)   q.set('type',   typeFilter);
    const data = await apiGet(`/inventory?${q}`);
    return data.inventory || [];
  };

  const handleExport = async (format) => {
    setExportOpen(false);
    setExporting(true);
    try {
      const rows = await fetchExportData();
      if (format === 'excel') await exportExcel(rows);
      else exportCSV(rows);
    } finally { setExporting(false); }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const canDelete  = can('INVENTORY_DELETE') || me?.is_system;
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  const activeFilters = [statusFilter, typeFilter].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* Control panel */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap">
        <div className="w-px h-5 bg-gray-200 mx-1 hidden sm:block" />

        {/* Filters */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilter(v => !v)}
            className={`flex items-center gap-1 text-sm h-8 px-3 rounded border transition-colors ${activeFilters ? 'bg-[#875A7B]/10 border-[#875A7B]/30 text-[#875A7B] font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Filters {activeFilters > 0 && `(${activeFilters})`}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showFilter && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
              <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</p>
              {[['', 'All'], ['AVAILABLE', 'Available'], ['RESERVED', 'Reserved'], ['SOLD', 'Sold'], ['REGISTERED', 'Registered']].map(([v, label]) => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${statusFilter === v ? 'text-[#875A7B] font-medium' : 'text-gray-700'}`}>
                  {label}
                  {statusFilter === v && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                </button>
              ))}
              <div className="border-t border-gray-100 my-1" />
              <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Unit Type</p>
              {[['', 'All Types'], ['PLOT', 'Plot'], ['SHOP', 'Shop'], ['LAND', 'Land'], ['FLAT', 'Flat'], ['PLOT_WIRE', 'Plot Wire'], ['SHOP_WIRE', 'Shop Wire']].map(([v, label]) => (
                <button key={v} onClick={() => setTypeFilter(v)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${typeFilter === v ? 'text-[#875A7B] font-medium' : 'text-gray-700'}`}>
                  {label}
                  {typeFilter === v && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                </button>
              ))}
              {activeFilters > 0 && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { setStatusFilter(''); setTypeFilter(''); setShowFilter(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50">Clear All Filters</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {statusFilter && (
          <span className="inline-flex items-center gap-1 bg-[#875A7B]/10 text-[#875A7B] text-xs font-medium px-2 py-1 rounded-full">
            Status: {statusFilter}
            <button onClick={() => setStatusFilter('')} className="hover:opacity-70">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        )}
        {typeFilter && (
          <span className="inline-flex items-center gap-1 bg-[#875A7B]/10 text-[#875A7B] text-xs font-medium px-2 py-1 rounded-full">
            Type: {typeFilter}
            <button onClick={() => setTypeFilter('')} className="hover:opacity-70">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        )}

        {/* Export dropdown */}
        <div className="ml-auto relative" ref={exportRef}>
          <div className={`flex items-center rounded border border-gray-200 overflow-hidden ${exporting || total === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 text-sm h-8 px-3 text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {exporting ? 'Exporting…' : 'Export'}
            </button>
            <button
              onClick={() => setExportOpen(v => !v)}
              className="flex items-center h-8 px-2 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
              <button onClick={() => handleExport('csv')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">CSV</span> Export as CSV
              </button>
              <button onClick={() => handleExport('excel')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">XLS</span> Export as Excel
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code, plot no, location…"
            className="text-sm border border-gray-200 rounded h-8 pl-8 pr-3 w-52 focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition" />
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
              {['Unit', 'Purchase', 'SL No', 'Plot No', 'Location', 'Total Area', 'Rate', 'Status', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(7).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {Array(9).fill(0).map((__, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-sm font-medium text-gray-500">No inventory units found</p>
                    <p className="text-xs text-gray-400">Units are added from the Purchase page</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.id}
                  onClick={() => { NProgress.start(); setNavigatingId(row.id); router.push(`/dashboard/inventory/${row.id}`); }}
                  className={`border-b border-gray-100 transition-colors select-none ${navigatingId === row.id ? 'bg-[#875A7B]/8 pointer-events-none' : 'cursor-pointer hover:bg-gray-50'}`}>
                  <td className="px-3 py-2.5">
                    <span className="block font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded w-fit mb-1">
                      {row.inventory_code || `INV-${String(row.id).padStart(4,'0')}`}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ring-1 ${UNIT_TYPE_RING[row.type] || ''}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[160px]">
                    <p className="truncate font-medium text-gray-800">{row.purchase?.purchase_code || `Purchase #${row.purchase_id}`}</p>
                    {row.purchase?.location && <p className="text-xs text-gray-400 truncate">{row.purchase.location}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{row.sl_no || '—'}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900">{row.plot_no || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[140px]">
                    <span className="truncate block">{row.location || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                    {(() => {
                      const f = parseFloat(row.front_area) || 0;
                      const b = parseFloat(row.back_area)  || 0;
                      const t = f && b ? parseFloat((f * (b / 9)).toFixed(2)) : parseFloat(row.area) || 0;
                      const u = row.front_area_details || row.area_unit || '';
                      return t ? <span className="font-medium">{fmtNum(t)}<span className="text-gray-400 text-xs ml-1">{u}</span></span> : '—';
                    })()}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                    {row.rate ? <span className="font-medium text-[#875A7B]">{fmtINR(row.rate)}</span> : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ${STATUS_RING[row.status] || ''}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    {navigatingId === row.id ? (
                      <svg className="w-4 h-4 animate-spin text-[#875A7B] inline-block" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/></svg>
                    ) : canDelete && row.status !== 'SOLD' && row.status !== 'RESERVED' && row.status !== 'REGISTERED' && (
                      <button onClick={() => setDelModal(row)}
                        className="text-red-400 hover:text-red-600 text-xs hover:bg-red-50 px-2 py-1 rounded transition">
                        Delete
                      </button>
                    )}
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
