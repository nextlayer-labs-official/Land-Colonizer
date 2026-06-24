'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiDelete } from '@/lib/api';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtINR  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtNum  = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const TYPE_BADGE = {
  LAND: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  SHOP: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  PLOT: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
};

function getStage(row) {
  const pct = Number(row.percentage_paid || 0);
  if (pct >= 100 && row.registration_date) return 'Completed';
  if (row.registration_date) return 'Registered';
  if (pct > 0) return 'In Progress';
  return 'Draft';
}

const STAGE_COLOR = {
  Draft:       'text-gray-500',
  'In Progress': 'text-amber-600',
  Registered:  'text-blue-600',
  Completed:   'text-emerald-600',
};

// ─── Delete confirm ────────────────────────────────────────────────────────────
function DeleteModal({ item, onClose, onConfirm, deleting }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete record?</h3>
        <p className="text-sm text-gray-500 mb-5">
          <strong>{item.plot_no || item.sl_no || `Record #${item.id}`}</strong> will be permanently deleted.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="btn-danger text-sm min-w-[90px]">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main list page ────────────────────────────────────────────────────────────
export default function PurchasesPage() {
  useAuth();
  const router = useRouter();
  const { can, me } = usePermissions();

  const [rows,     setRows]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState([]);
  const [delModal, setDelModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // filters state
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef(null);

  const LIMIT = 15;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: p, limit: LIMIT });
      if (search)     q.set('search', search);
      if (typeFilter) q.set('type',   typeFilter);
      const data = await apiGet(`/purchases?${q}`);
      setRows(data.purchases || []);
      setTotal(data.total    || 0);
      setPage(p);
      setSelected([]);
    } finally { setLoading(false); }
  }, [search, typeFilter]);

  useEffect(() => { load(1); }, [search, typeFilter]);

  // close filter dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDelete(`/purchases/${delModal.id}`);
      setDelModal(null);
      load(rows.length === 1 && page > 1 ? page - 1 : page);
    } finally { setDeleting(false); }
  };

  const toggleSelect  = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll     = () => setSelected(selected.length === rows.length ? [] : rows.map(r => r.id));
  const totalPages    = Math.ceil(total / LIMIT);
  const canCreate     = can('PURCHASE_CREATE') || me?.is_system;
  const canEdit       = can('PURCHASE_EDIT')   || me?.is_system;
  const canDelete     = can('PURCHASE_DELETE') || me?.is_system;

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* ── Odoo-style control panel ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap">

        {/* Action buttons */}
        {canCreate && (
          <button
            onClick={() => router.push('/dashboard/purchases/new')}
            className="btn-primary text-sm h-8 px-4"
          >
            New
          </button>
        )}

        {selected.length > 0 && canDelete && (
          <button
            onClick={() => setDelModal(rows.find(r => r.id === selected[0]))}
            className="btn-danger text-sm h-8 px-3"
          >
            Delete ({selected.length})
          </button>
        )}

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Filters dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilter(v => !v)}
            className={`flex items-center gap-1 text-sm h-8 px-3 rounded border transition-colors ${
              typeFilter ? 'bg-[#875A7B]/10 border-[#875A7B]/30 text-[#875A7B] font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Filters
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showFilter && (
            <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
              <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</p>
              {[['', 'All Types'], ['PLOT', 'Plot'], ['LAND', 'Land'], ['SHOP', 'Shop']].map(([v, label]) => (
                <button key={v} onClick={() => { setTypeFilter(v); setShowFilter(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${typeFilter === v ? 'text-[#875A7B] font-medium' : 'text-gray-700'}`}>
                  {label}
                  {typeFilter === v && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                </button>
              ))}
              {typeFilter && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { setTypeFilter(''); setShowFilter(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50">
                    Clear Filter
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {typeFilter && (
          <span className="inline-flex items-center gap-1 bg-[#875A7B]/10 text-[#875A7B] text-xs font-medium px-2 py-1 rounded-full">
            Type: {typeFilter}
            <button onClick={() => setTypeFilter('')} className="hover:opacity-70">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        )}

        {/* Search bar (right-aligned) */}
        <div className="ml-auto relative">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search…"
            className="text-sm border border-gray-200 rounded h-8 pl-8 pr-3 w-52 focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              <th className="w-10 px-3 py-2.5 text-left">
                <input type="checkbox"
                  checked={selected.length === rows.length && rows.length > 0}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-[#875A7B] focus:ring-[#875A7B]" />
              </th>
              {[
                ['Code', ''],
                ['Category', ''],
                ['Type', ''],
                ['Plot No', ''],
                ['Location', ''],
                ['Area', 'text-right'],
                ['Rate', 'text-right'],
                ['Total Amount', 'text-right'],
                ['Balance', 'text-right'],
                ['% Paid', ''],
                ['Reg. Date', ''],
                ['Stage', ''],
              ].map(([h, align]) => (
                <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${align} text-left`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array(7).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-3" />
                  {Array(12).fill(0).map((__, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-500">No records found</p>
                    {canCreate && (
                      <button onClick={() => router.push('/dashboard/purchases/new')} className="btn-primary text-sm mt-1">
                        New Purchase
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const stage   = getStage(row);
                const pct     = Math.min(100, Math.max(0, row.percentage_paid || 0));
                const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-[#875A7B]';
                const isSel   = selected.includes(row.id);

                return (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/dashboard/purchases/${row.id}`)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${isSel ? 'bg-[#875A7B]/5' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleSelect(row.id)}
                        className="rounded border-gray-300 text-[#875A7B] focus:ring-[#875A7B]" />
                    </td>
                    <td className="px-3 py-2.5">
                      {row.purchase_code
                        ? <span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{row.purchase_code}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.purchase_category === 'DIVIDED' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-gray-50 text-gray-500 ring-1 ring-gray-200'}`}>
                        {row.purchase_category === 'DIVIDED' ? 'Divided' : 'Single'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {row.type && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE[row.type]}`}>
                          {row.type}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{row.plot_no || row.sl_no || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[140px] truncate">{row.location || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {row.purchased_area ? `${fmtNum(row.purchased_area)}${row.purchased_area_details ? ` ${row.purchased_area_details}` : ''}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{row.rate ? fmtINR(row.rate) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fmtINR(row.total_amount)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{fmtINR(row.balance_to_pay)}</td>
                    <td className="px-3 py-2.5 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(row.registration_date)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium ${STAGE_COLOR[stage]}`}>{stage}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Odoo-style footer pagination ── */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-sm shrink-0">
        <span className="text-gray-500 text-xs">
          {total === 0 ? '0 records' : `${from}–${to} / ${fmtNum(total)}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => load(page - 1)} disabled={page === 1 || loading}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <DeleteModal item={delModal} onClose={() => setDelModal(null)} onConfirm={handleDelete} deleting={deleting} />
    </div>
  );
}
