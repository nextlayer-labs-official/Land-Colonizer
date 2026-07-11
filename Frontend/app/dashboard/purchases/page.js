'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiDelete, apiPost, apiPatch } from '@/lib/api';
import NProgress from 'nprogress';
import Pagination from '@/components/Pagination';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtINR  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtNum  = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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

const TYPE_BADGE = {
  LAND: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  SHOP: 'bg-blue-50    text-blue-700    ring-1 ring-blue-200',
  PLOT: 'bg-violet-50  text-violet-700  ring-1 ring-violet-200',
  FLAT: 'bg-orange-50  text-orange-700  ring-1 ring-orange-200',
};

function effPct(row) {
  const total  = Number(row.total_amount || 0);
  const effBal = Number(row.effective_balance ?? row.balance_to_pay ?? 0);
  return total > 0 ? Math.min(100, Math.max(0, ((total - effBal) / total) * 100)) : 0;
}

function getStage(row) {
  const pct = effPct(row);
  if (row.registration_completed && pct >= 100) return 'Completed';
  if (row.registration_completed) return 'Registered';
  if (pct > 0) return 'In Progress';
  return 'Draft';
}

const STAGE_COLOR = {
  Draft:       'text-gray-500',
  'In Progress': 'text-amber-600',
  Registered:  'text-blue-600',
  Completed:   'text-emerald-600',
};

// ─── Archive / Unarchive confirm ──────────────────────────────────────────────
function ArchiveModal({ item, onClose, onConfirm, archiving }) {
  if (!item) return null;
  const count = item.items?.length ?? 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Archive {count === 1 ? 'purchase' : `${count} purchases`}?</h3>
        <p className="text-sm text-gray-500 mb-4">
          {count === 1 ? 'This purchase' : `These ${count} purchases`} will be hidden from the list.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={onConfirm} disabled={archiving} className="px-4 h-8 text-sm rounded-lg text-white bg-amber-500 hover:bg-amber-600 min-w-[90px]">
            {archiving ? 'Archiving…' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnarchiveModal({ item, onClose, onConfirm, unarchiving }) {
  if (!item) return null;
  const count = item.items?.length ?? 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Unarchive {count === 1 ? 'purchase' : `${count} purchases`}?</h3>
        <p className="text-sm text-gray-500 mb-4">
          {count === 1 ? 'This purchase' : `These ${count} purchases`} will be restored to the active list.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={onConfirm} disabled={unarchiving} className="px-4 h-8 text-sm rounded-lg text-white bg-sky-600 hover:bg-sky-700 min-w-[90px]">
            {unarchiving ? 'Unarchiving…' : 'Unarchive'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm ────────────────────────────────────────────────────────────
function DeleteModal({ item, onClose, onConfirm, deleting, error }) {
  if (!item) return null;
  const count = item.items?.length ?? 0;
  const hasLinked = item.items?.some(r => (r._count?.inventory || 0) > 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Delete {count === 1 ? 'purchase' : `${count} purchases`}?</h3>
        <p className="text-sm text-gray-500 mb-2">
          {count === 1 ? 'This purchase' : `These ${count} purchases`} will be permanently deleted and cannot be recovered.
        </p>
        {hasLinked && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Any linked inventory units will also be deleted.
          </p>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          {!error && (
            <button onClick={onConfirm} disabled={deleting} className="btn-danger text-sm min-w-[90px]">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const CSV_HEADERS = ['type','purchase_category','sl_no','plot_no','location','purchased_area','purchased_area_details','rate','advance_paid','seller_details','purchase_broker_name','sell_broker_name','brokerage','extra_expenses','registration_charges','other_details'];
const CSV_LABELS  = ['Type(PLOT/LAND/SHOP)','Category(SINGLE/DIVIDED)','SL No','Plot No','Location','Purchased Area','Area Unit','Rate(₹)','Advance Paid(₹)','Seller Details','Purchase Broker','Sell Broker','Brokerage(₹)','Extra Expenses(₹)','Reg Charges(₹)','Other Details'];

function downloadTemplate() {
  const lines = [
    CSV_LABELS.join(','),
    'PLOT,SINGLE,SL-001,P-42,Chennai,1200,sq.yd,5000,100000,Seller Name,Broker Name,,,,,',
    'LAND,DIVIDED,SL-002,,Bangalore,5,acres,250000,500000,Seller Name 2,,Sell Broker,10000,5000,,Additional notes here',
  ];
  const csv  = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'purchase_import_template.csv'; a.click();
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj  = {};
    CSV_HEADERS.forEach((h, idx) => { obj[h] = vals[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}

function ImportModal({ open, onClose, onImported }) {
  const [step,     setStep]     = useState('upload'); // upload | preview | result
  const [rows,     setRows]     = useState([]);
  const [importing,setImporting]= useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');
  const fileRef = useRef(null);

  const reset = () => { setStep('upload'); setRows([]); setResult(null); setError(''); };
  const close = () => { reset(); onClose(); };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      if (parsed.length === 0) { setError('No data rows found in file.'); return; }
      setRows(parsed); setStep('preview'); setError('');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true); setError('');
    try {
      const res = await apiPost('/purchases/import', { purchases: rows });
      setResult(res); setStep('result');
      if (res.created > 0) onImported();
    } catch (e) { setError(e.message || 'Import failed'); }
    finally { setImporting(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
        style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-base font-black text-gray-900">Import Purchases</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === 'upload' ? 'Upload a CSV file to bulk import purchases' :
               step === 'preview' ? `${rows.length} row${rows.length !== 1 ? 's' : ''} ready to import` :
               'Import complete'}
            </p>
          </div>
          <button onClick={close} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* Upload step */}
          {step === 'upload' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Download the template first, fill in your data, then upload the file below.
              </div>
              <button onClick={downloadTemplate}
                className="flex items-center gap-2 h-9 px-4 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Download Template CSV
              </button>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-[#875A7B] hover:bg-[#875A7B]/5 transition-colors">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                <p className="text-sm font-semibold text-gray-500">Click to upload CSV</p>
                <p className="text-xs text-gray-400 mt-1">Only .csv files are supported</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              </div>
              {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>}
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-bold uppercase tracking-wider">#</th>
                    {['Type','Category','SL No','Plot No','Location','Area','Unit','Rate','Advance','Seller'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-gray-400 font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-[#875A7B]">{r.type || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.purchase_category || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.sl_no || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.plot_no || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{r.location || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.purchased_area || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-400">{r.purchased_area_details || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.rate ? `₹${Number(r.rate).toLocaleString('en-IN')}` : '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.advance_paid ? `₹${Number(r.advance_paid).toLocaleString('en-IN')}` : '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{r.seller_details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Result step */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${result.created > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {result.created > 0
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>}
                </svg>
                <div>
                  <p className="font-bold">{result.created} purchase{result.created !== 1 ? 's' : ''} imported successfully</p>
                  {result.brokersCreated?.length > 0 && (
                    <p className="text-sm mt-0.5">{result.brokersCreated.length} new broker{result.brokersCreated.length !== 1 ? 's' : ''} created: {result.brokersCreated.join(', ')}</p>
                  )}
                  {result.errors?.length > 0 && <p className="text-sm mt-0.5">{result.errors.length} row{result.errors.length !== 1 ? 's' : ''} failed</p>}
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-1">
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">Failed Rows</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">Row {e.row}: {e.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          {step === 'preview' && (
            <button onClick={() => { setStep('upload'); if (fileRef.current) fileRef.current.value = ''; }}
              className="h-9 px-4 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-white font-medium transition">
              ← Back
            </button>
          )}
          {step !== 'preview' && <div />}
          <div className="flex items-center gap-2">
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button onClick={close} className="h-9 px-4 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-white font-medium transition">
              {step === 'result' ? 'Close' : 'Cancel'}
            </button>
            {step === 'preview' && (
              <button onClick={handleImport} disabled={importing}
                className="h-9 px-5 text-sm rounded-xl text-white font-semibold hover:opacity-90 transition disabled:opacity-60"
                style={{ backgroundColor: '#875A7B' }}>
                {importing ? 'Importing…' : `Import ${rows.length} Row${rows.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
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

  const [navigatingId, setNavigatingId] = useState(null);
  const [rows,     setRows]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState([]);
  const [delModal,    setDelModal]    = useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [delError,    setDelError]    = useState('');
  const [archModal,   setArchModal]   = useState(null);
  const [archiving,   setArchiving]   = useState(false);
  const [showImport,  setShowImport]  = useState(false);
  const [exportOpen,  setExportOpen]  = useState(false);

  // filters state
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef(null);
  const exportRef  = useRef(null);

  const LIMIT = 15;

  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: p, limit: LIMIT, archived: showArchived ? 'true' : 'false' });
      if (search)     q.set('search', search);
      if (typeFilter) q.set('type',   typeFilter);
      const data = await apiGet(`/purchases?${q}`);
      setRows(data.purchases || []);
      setTotal(data.total    || 0);
      setPage(p);
      setSelected([]);
    } finally { setLoading(false); }
  }, [search, typeFilter, showArchived]);

  useEffect(() => { load(1); }, [search, typeFilter, showArchived]);

  useEffect(() => {
    const h = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
      if (exportRef.current  && !exportRef.current.contains(e.target))  setExportOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const [unarchiving, setUnarchiving] = useState(false);
  const [unarchModal, setUnarchModal] = useState(null);

  const handleUnarchive = async () => {
    setUnarchiving(true);
    const ids = unarchModal.items.map(r => r.id);
    try {
      await Promise.all(ids.map(id => apiPatch(`/purchases/${id}/unarchive`)));
      setUnarchModal(null);
      setSelected([]);
      load(rows.length <= ids.length && page > 1 ? page - 1 : page);
    } finally { setUnarchiving(false); }
  };

  const handleExport = async (format) => {
    setExportOpen(false);
    const q = new URLSearchParams({ page: 1, limit: 9999, archived: showArchived ? 'true' : 'false' });
    if (search)     q.set('search', search);
    if (typeFilter) q.set('type',   typeFilter);
    const data  = await apiGet(`/purchases?${q}`);
    const items = data.purchases || [];
    const date  = new Date().toISOString().slice(0, 10);
    const HEADERS = ['Code','Category','Type','Plot No','Location','Area','Area Unit','Rate','Total Amount','Balance','% Paid','Reg Date','Stage','Seller','Purchase Broker','Sell Broker'];
    const toRow   = r => [
      r.purchase_code || '', r.purchase_category || '', r.type || '', r.plot_no || '',
      r.location || '', r.purchased_area || '', r.purchased_area_details || '',
      r.rate || '', r.total_amount || '', r.effective_balance ?? r.balance_to_pay ?? '',
      effPct(r).toFixed(1), r.registration_date ? fmtDate(r.registration_date) : '',
      getStage(r), r.seller_details || '', r.purchase_broker_name || '', r.sell_broker_name || '',
    ];
    if (format === 'csv') {
      dlCSV(toCSV(HEADERS, items.map(toRow)), `purchases_${date}.csv`);
    } else {
      await dlXlsx(items.map(r => Object.fromEntries(HEADERS.map((h, i) => [h, toRow(r)[i]]))), 'Purchases', `purchases_${date}.xlsx`);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    const ids = archModal.items.map(r => r.id);
    try {
      await Promise.all(ids.map(id => apiPatch(`/purchases/${id}/archive`)));
      setArchModal(null);
      setSelected([]);
      load(rows.length <= ids.length && page > 1 ? page - 1 : page);
    } finally { setArchiving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDelError('');
    const ids = delModal.items.map(r => r.id);
    try {
      const results = await Promise.allSettled(ids.map(id => apiDelete(`/purchases/${id}`)));
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        const msgs = [...new Set(failures.map(r => r.reason?.message || 'Delete failed'))];
        setDelError(msgs.join(' | '));
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        if (succeeded > 0) { setSelected([]); load(page); }
        return;
      }
      setDelModal(null);
      setSelected([]);
      load(rows.length <= ids.length && page > 1 ? page - 1 : page);
    } finally { setDeleting(false); }
  };

  const toggleSelect  = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll     = () => setSelected(selected.length === rows.length ? [] : rows.map(r => r.id));
  const totalPages    = Math.ceil(total / LIMIT);
  const canCreate     = can('PURCHASE_CREATE')  || me?.is_system;
  const canEdit       = can('PURCHASE_EDIT')    || me?.is_system;
  const canArchive    = can('PURCHASE_ARCHIVE') || me?.is_system;
  const canDelete     = can('PURCHASE_DELETE')  || me?.is_system;

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* ── Odoo-style control panel ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap">

        {/* Action buttons */}
        {canCreate && !showArchived && (
          <button
            onClick={() => router.push('/dashboard/purchases/new')}
            className="btn-primary text-sm h-8 px-4"
          >
            New
          </button>
        )}
        {canCreate && !showArchived && (
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 h-8 px-3 text-sm border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Import
          </button>
        )}

        {/* Archived toggle */}
        <button
          onClick={() => { setShowArchived(v => !v); setSearch(''); setTypeFilter(''); setSelected([]); }}
          className={`flex items-center gap-1.5 h-8 px-3 text-sm border rounded transition-colors font-medium ${showArchived ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12"/>
          </svg>
          {showArchived ? 'Archived' : 'Archive'}
        </button>

        {selected.length > 0 && canArchive && !showArchived && (
          <button
            onClick={() => setArchModal({ items: rows.filter(r => selected.includes(r.id)) })}
            className="h-8 px-3 text-sm rounded border border-amber-200 text-amber-600 hover:bg-amber-50 transition font-medium"
          >
            Archive ({selected.length})
          </button>
        )}
        {selected.length > 0 && canArchive && showArchived && (
          <button
            onClick={() => setUnarchModal({ items: rows.filter(r => selected.includes(r.id)) })}
            className="h-8 px-3 text-sm rounded border border-sky-200 text-sky-600 hover:bg-sky-50 transition font-medium"
          >
            Unarchive ({selected.length})
          </button>
        )}
        {selected.length > 0 && me?.is_system && (
          <button
            onClick={() => setDelModal({ items: rows.filter(r => selected.includes(r.id)) })}
            className="btn-danger text-sm h-8 px-3"
          >
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
              {[['', 'All Types'], ['PLOT', 'Plot'], ['LAND', 'Land'], ['SHOP', 'Shop'], ['FLAT', 'Flat']].map(([v, label]) => (
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
        <div className="w-px h-5 bg-gray-200 shrink-0" />
        <Pagination page={page} totalPages={totalPages} total={total} from={from} to={to} loading={loading} onPage={load} />
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
                    <p className="text-sm font-medium text-gray-500">{showArchived ? 'No archived purchases' : 'No records found'}</p>
                    {canCreate && !showArchived && (
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
                const pct     = effPct(row);
                const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-[#875A7B]';
                const isSel   = selected.includes(row.id);

                return (
                  <tr
                    key={row.id}
                    onClick={() => { NProgress.start(); setNavigatingId(row.id); router.push(`/dashboard/purchases/${row.id}`); }}
                    className={`border-b border-gray-100 transition-colors select-none ${navigatingId === row.id ? 'bg-[#875A7B]/8 pointer-events-none' : `cursor-pointer ${isSel ? 'bg-[#875A7B]/5' : 'hover:bg-gray-50'}`}`}
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
                    <td className="px-3 py-2.5 text-right text-gray-700">{fmtINR(row.effective_balance ?? row.balance_to_pay)}</td>
                    <td className="px-3 py-2.5 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(row.registration_date)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {navigatingId === row.id ? (
                        <svg className="w-4 h-4 animate-spin text-[#875A7B] inline-block" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/></svg>
                      ) : (
                        <span className={`text-xs font-medium ${STAGE_COLOR[stage]}`}>{stage}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ArchiveModal item={archModal} onClose={() => setArchModal(null)} onConfirm={handleArchive} archiving={archiving} />
      <UnarchiveModal item={unarchModal} onClose={() => setUnarchModal(null)} onConfirm={handleUnarchive} unarchiving={unarchiving} />
      <DeleteModal item={delModal} onClose={() => { setDelModal(null); setDelError(''); }} onConfirm={handleDelete} deleting={deleting} error={delError} />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} onImported={() => { load(1); }} />
    </div>
  );
}
