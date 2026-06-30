'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/api';
import {
  EMPTY, computed, fmtINR, fmtDate,
  TYPE_LABEL, POSS_COLOR, POSS_LABEL,
  CustomerPicker,
} from '../_components/shared';
import SaleFormBody from '../_components/SaleFormBody';

// ── Project Picker ────────────────────────────────────────────────────────────
function ProjectPicker({ current, onPick, onClose }) {
  const [search,  setSearch]  = useState('');
  const [items,   setItems]   = useState([]);
  const [loading, setLoad]    = useState(false);
  const [adding,  setAdding]  = useState(false);
  const [newName, setNewName] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const ref = useRef(null);
  const tmr = useRef(null);

  const fetch = useCallback(async (q = '') => {
    setLoad(true);
    try {
      const data = await apiGet(`/lookup/projects?search=${encodeURIComponent(q)}&limit=3`);
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally { setLoad(false); }
  }, []);

  useEffect(() => { fetch(''); }, [fetch]);

  useEffect(() => {
    clearTimeout(tmr.current);
    tmr.current = setTimeout(() => fetch(search), 300);
    return () => clearTimeout(tmr.current);
  }, [search, fetch]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const handleCreate = async () => {
    if (!newName.trim()) { setSaveErr('Name is required'); return; }
    setSaving(true); setSaveErr('');
    try {
      const p = await apiPost('/projects', { name: newName.trim(), status: 'OPEN' });
      onPick(p);
    } catch (e) { setSaveErr(e.message || 'Failed to create'); }
    finally { setSaving(false); }
  };

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
      {!adding ? (
        <>
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#875A7B]" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-center text-xs text-gray-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">No projects found</div>
            ) : items.map(p => (
              <button key={p.id} type="button" onClick={() => onPick(p)}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#875A7B]/5 transition border-b border-gray-50 last:border-0 ${current?.id === p.id ? 'bg-[#875A7B]/8' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-[#875A7B]">{p.project_code}</span>
                  <span className="font-medium text-gray-800">{p.name}</span>
                  {current?.id === p.id && <span className="ml-auto text-[10px] text-emerald-600 font-semibold">Current</span>}
                </div>
                {p.location && <p className="text-[10px] text-gray-400 mt-0.5">{p.location}</p>}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100">
            <button type="button" onClick={() => { setAdding(true); setNewName(search); setSaveErr(''); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#875A7B] hover:bg-[#875A7B]/5 transition font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add new project
            </button>
          </div>
        </>
      ) : (
        <div className="p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">New Project</p>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Project name *"
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#875A7B]" />
          {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setAdding(false); setSaveErr(''); }}
              className="flex-1 text-sm border border-gray-200 rounded py-1.5 text-gray-500 hover:bg-gray-50 transition">Cancel</button>
            <button type="button" onClick={handleCreate} disabled={saving}
              className="flex-1 text-sm rounded py-1.5 text-white font-medium disabled:opacity-60"
              style={{ backgroundColor: '#875A7B' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ORDINALS = [
  '1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th',
  '11th','12th','13th','14th','15th','16th','17th','18th','19th','20th',
];
const TYPE_ICON_COLOR = { PLOT: '#875A7B', SHOP: '#3b82f6', SHOP_WIRE: '#6366f1', PLOT_WIRE: '#8b5cf6' };
const TYPE_ICON_BG    = { PLOT: '#875A7B15', SHOP: '#3b82f615', SHOP_WIRE: '#6366f115', PLOT_WIRE: '#8b5cf615' };
const POSS_RING = {
  PENDING:  'ring-amber-200 bg-amber-50 text-amber-700',
  SYMBOLIC: 'ring-blue-200 bg-blue-50 text-blue-700',
  PHYSICAL: 'ring-emerald-200 bg-emerald-50 text-emerald-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyInst() {
  const d = { sl_no: '', installment_details: '' };
  for (let n = 1; n <= 20; n++) {
    d[`inst_${n}_amount`] = '';
    d[`inst_${n}_date`]   = '';
    d[`inst_${n}_paid`]   = false;
  }
  return d;
}
function instFromApi(inst) {
  if (!inst) return emptyInst();
  const d = { sl_no: inst.sl_no || '', installment_details: inst.installment_details || '' };
  for (let n = 1; n <= 20; n++) {
    d[`inst_${n}_amount`] = inst[`inst_${n}_amount`] != null ? String(inst[`inst_${n}_amount`]) : '';
    d[`inst_${n}_date`]   = inst[`inst_${n}_date`]?.split?.('T')?.[0] || '';
    d[`inst_${n}_paid`]   = Boolean(inst[`inst_${n}_paid`]);
  }
  return d;
}
function toFormState(data) {
  const inv = data.inventory || null;
  // Fall back to linked inventory's values for sales that predate the new area fields
  const fa  = data.front_area  != null ? String(data.front_area)  : (inv?.front_area  != null ? String(inv.front_area)  : '');
  const fad = data.front_area_details  || inv?.front_area_details || '';
  const ba  = data.back_area   != null ? String(data.back_area)   : (inv?.back_area   != null ? String(inv.back_area)   : '');
  const bad = data.back_area_details   || inv?.back_area_details  || '';
  const pr  = data.plot_rate   != null ? String(data.plot_rate)   : (inv?.rate        != null ? String(inv.rate)        : '');
  return {
    ...EMPTY, ...data,
    front_area:           fa,
    front_area_details:   fad,
    back_area:            ba,
    back_area_details:    bad,
    plot_rate:            pr,
    sale_date:            data.sale_date?.split?.('T')?.[0]            || '',
    payment_due_date:     data.payment_due_date?.split?.('T')?.[0]     || '',
    date_of_registration: data.date_of_registration?.split?.('T')?.[0] || '',
    _inventory: inv,
    _customer:  data.customer  || null,
    _broker:    data.broker    || null,
  };
}

// ── Sale Visual ───────────────────────────────────────────────────────────────
function SaleVisual({ form }) {
  const color = TYPE_ICON_COLOR[form.type] || '#875A7B';
  const bg    = TYPE_ICON_BG[form.type]    || '#875A7B15';
  const ps    = POSS_RING[form.possession] || POSS_RING.PENDING;

  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-[200px] select-none">
      {/* Icon circle */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: bg, border: `2px solid ${color}30` }}>
          <svg className="w-9 h-9" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        {/* status dot */}
        <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-white ${form.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      </div>

      {/* Sale code */}
      <div className="text-center">
        <p className="text-lg font-black" style={{ color }}>{form.sale_code || '—'}</p>
        {form.sl_no && <p className="text-xs text-gray-400 mt-0.5">SL: {form.sl_no}</p>}
      </div>

      {/* Badges */}
      <div className="flex flex-col items-center gap-1.5">
        {form.type && (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: bg, color }}>
            {TYPE_LABEL[form.type] || form.type}
          </span>
        )}
        {form.possession && (
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ring-1 ${ps}`}>
            {POSS_LABEL[form.possession] || form.possession}
          </span>
        )}
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${form.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
          {form.status === 'ACTIVE' ? '● Active' : '● Inactive'}
        </span>
      </div>
    </div>
  );
}

// ── Payment Progress Bar ──────────────────────────────────────────────────────
function PayBar({ received, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[9px] text-gray-400 mb-1"><span>Received</span><span>{pct}%</span></div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: '#875A7B' }} />
      </div>
    </div>
  );
}

// ── Single installment card ───────────────────────────────────────────────────
function InstCard({ n, label, form, editing, setF }) {
  const amt = form[`inst_${n}_amount`];
  const dt  = form[`inst_${n}_date`];
  const pd  = form[`inst_${n}_paid`];
  const hasData = !!(amt || dt);

  if (editing) {
    return (
      <div className={`rounded-xl border-2 p-3 space-y-2 transition ${pd ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={pd} onChange={e => setF(`inst_${n}_paid`, e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-emerald-600 cursor-pointer" />
            <span className={`text-[10px] font-semibold ${pd ? 'text-emerald-700' : 'text-gray-400'}`}>Paid</span>
          </label>
        </div>
        <input type="number" value={amt} onChange={e => setF(`inst_${n}_amount`, e.target.value)}
          placeholder="Amount ₹"
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/20 placeholder:text-gray-300" />
        <input type="date" value={dt} onChange={e => setF(`inst_${n}_date`, e.target.value)}
          className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/20" />
      </div>
    );
  }

  // View mode
  const cardCls = pd
    ? 'border-emerald-200 bg-emerald-50'
    : hasData
      ? 'border-amber-200 bg-amber-50'
      : 'border-gray-100 bg-gray-50';

  return (
    <div className={`rounded-xl border-2 p-3 ${cardCls}`}>
      <div className="flex items-start justify-between mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-wide ${pd ? 'text-emerald-600' : hasData ? 'text-amber-600' : 'text-gray-300'}`}>
          {label}
        </span>
        {pd ? (
          <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
            Paid
          </span>
        ) : hasData ? (
          <span className="text-[9px] font-bold text-amber-500 bg-amber-100 px-1.5 py-0.5 rounded-full">Due</span>
        ) : null}
      </div>
      <p className={`text-sm font-bold leading-tight ${pd ? 'text-emerald-700' : hasData ? 'text-gray-800' : 'text-gray-200'}`}>
        {amt ? `₹${Number(amt).toLocaleString('en-IN')}` : <span className="text-xs font-normal text-gray-200">—</span>}
      </p>
      {dt && <p className={`text-[10px] mt-1 ${pd ? 'text-emerald-500' : 'text-gray-400'}`}>{fmtDate(dt)}</p>}
    </div>
  );
}

// ── Installment Panel (tab content) ──────────────────────────────────────────
function InstallmentPanel({ saleId, canEdit, onTotalPaidChange }) {
  const [form,       setForm]       = useState(emptyInst());
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [totalPaid,  setTotalPaid]  = useState(0);
  const [balanceAmt, setBalanceAmt] = useState(0);
  const [customer,   setCustomer]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet(`/sales/${saleId}/installments`);
      setForm(instFromApi(d.installment));
      setTotalPaid(d.total_paid || 0);
      setBalanceAmt(d.balance_amount || 0);
      setCustomer(d.customer || null);
      onTotalPaidChange?.(d.total_paid || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [saleId]);

  useEffect(() => { load(); }, [load]);

  const setF = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      const d = await apiPut(`/sales/${saleId}/installments`, form);
      setForm(instFromApi(d.installment));
      setTotalPaid(d.total_paid || 0);
      setBalanceAmt(d.balance_amount || 0);
      onTotalPaidChange?.(d.total_paid || 0);
      setEditing(false); setSaved(true);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const remaining  = balanceAmt - totalPaid;
  const paidCount  = ORDINALS.filter((_, i) => form[`inst_${i + 1}_paid`]).length;
  const filledCount = ORDINALS.filter((_, i) => form[`inst_${i + 1}_amount`]).length;

  if (loading) return (
    <div className="p-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
      {Array(10).fill(0).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-5 space-y-5">

      {/* ── Top bar: customer + summary + actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">

        {/* Customer chip */}
        {customer && (
          <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
              {customer.name[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-blue-800 leading-tight">{customer.name}</p>
              <p className="text-[10px] text-blue-400">{customer.phone || customer.customer_code || 'Customer'}</p>
            </div>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-2 flex-1">
          {[
            { l: 'Balance Amount', v: fmtINR(balanceAmt), c: 'text-amber-700',   bg: 'bg-amber-50',   bd: 'border-amber-100' },
            { l: 'Total Paid',     v: fmtINR(totalPaid),  c: 'text-emerald-700', bg: 'bg-emerald-50', bd: 'border-emerald-100' },
            { l: 'Remaining',      v: fmtINR(remaining),  c: remaining > 0 ? 'text-red-600' : 'text-emerald-700',
              bg: remaining > 0 ? 'bg-red-50' : 'bg-emerald-50', bd: remaining > 0 ? 'border-red-100' : 'border-emerald-100' },
          ].map(({ l, v, c, bg, bd }) => (
            <div key={l} className={`${bg} border ${bd} rounded-xl p-3`}>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">{l}</p>
              <p className={`text-sm font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* Action button */}
        {canEdit && (
          <div className="flex items-start shrink-0">
            {editing ? (
              <div className="flex gap-2">
                <button onClick={() => { load(); setEditing(false); }}
                  className="h-8 px-3 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Discard</button>
                <button onClick={handleSave} disabled={saving}
                  className="h-8 px-4 text-xs rounded-lg text-white font-semibold" style={{ backgroundColor: '#875A7B' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Saved
                  </span>
                )}
                <button onClick={() => { setEditing(true); setSaved(false); }}
                  className="h-8 px-3 text-xs border border-[#875A7B] rounded-lg text-[#875A7B] hover:bg-[#875A7B]/5 font-medium flex items-center gap-1.5 transition">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  Edit
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SL No. + Details + progress ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        <div className="flex gap-3 flex-1">
          <div className="flex-1">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">SL. No.</p>
            {editing
              ? <input value={form.sl_no} onChange={e => setF('sl_no', e.target.value)} placeholder="SL No."
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#875A7B] bg-white" />
              : <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100 min-h-[32px]">{form.sl_no || '—'}</p>}
          </div>
          <div className="flex-1">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Details</p>
            {editing
              ? <input value={form.installment_details} onChange={e => setF('installment_details', e.target.value)} placeholder="Notes…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#875A7B] bg-white" />
              : <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100 min-h-[32px]">{form.installment_details || '—'}</p>}
          </div>
        </div>

        {/* Progress pill */}
        <div className="sm:w-48 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] text-gray-400 uppercase tracking-wide">Progress</span>
            <span className="text-xs font-bold text-[#875A7B]">{paidCount}/{filledCount || 20}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${filledCount ? Math.round((paidCount / filledCount) * 100) : 0}%` }} />
          </div>
          <p className="text-[9px] text-gray-400 mt-1">{paidCount} paid of {filledCount} set</p>
        </div>
      </div>

      {/* ── 20-card grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {ORDINALS.map((label, i) => (
          <InstCard key={i + 1} n={i + 1} label={label} form={form} editing={editing} setF={setF} />
        ))}
      </div>

    </div>
  );
}

// ── Sale Detail View (compact, read-only) ─────────────────────────────────────
function SaleDetailView({ form, linkedProject }) {
  const c      = computed(form);
  const noVal  = <span className="text-gray-300">—</span>;

  const Cell = ({ label, value, wide, money, accent }) => (
    <div className={wide ? 'col-span-2 sm:col-span-3' : ''}>
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`text-sm ${accent ? 'font-bold text-[#875A7B]' : 'text-gray-800'} ${money ? 'font-semibold tabular-nums' : ''}`}>
        {value ?? noVal}
      </p>
    </div>
  );

  const Section = ({ title, children }) => (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-2 mb-3 border-b border-gray-100">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">{children}</div>
    </div>
  );

  const v      = (n)  => n != null && n !== '' ? String(n) : null;
  const money  = (n)  => n != null && Number(n) ? fmtINR(n) : null;
  const dt     = (d)  => d ? fmtDate(d) : null;
  const pair   = (n, u) => n != null && Number(n) ? `${Number(n).toLocaleString('en-IN')}${u ? ' ' + u : ''}` : null;

  return (
    <div className="p-5 space-y-6">
      {/* Sale Info */}
      <Section title="Sale Information">
        <Cell label="Sale Date"   value={dt(form.sale_date)} />
        <Cell label="Type"        value={form.type ? (TYPE_LABEL[form.type] || form.type) : null} />
        <Cell label="SL No."      value={v(form.sl_no)} />
        {form.details && <Cell label="Details" value={v(form.details)} wide />}
        {linkedProject && (
          <div className="col-span-full sm:col-span-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Project</p>
            <Link href={`/dashboard/projects/${linkedProject.id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">
              {linkedProject.name}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </Link>
            {linkedProject.project_code && <p className="text-[10px] text-gray-400 mt-0.5">{linkedProject.project_code}</p>}
          </div>
        )}
      </Section>

      {/* Area */}
      <Section title={form._inventory ? 'Area Measurement · from inventory unit' : 'Area Measurement'}>
        <Cell label="Front Area"  value={pair(form.front_area, form.front_area_details)} />
        <Cell label="Back Area"   value={pair(form.back_area,  form.back_area_details)} />
        <Cell label="Total Area (F × B ÷ 9)"  value={pair(form.total_area ?? c.total_area, form.total_area_details || form.front_area_details)} accent />
        {form.total_area_details && <Cell label="Area Notes" value={v(form.total_area_details)} />}
        {form.registration_area && <Cell label="Registration Area" value={v(form.registration_area)} />}
      </Section>

      {/* Pricing */}
      <Section title="Pricing">
        <Cell label={form._inventory ? 'Plot Rate · from unit' : 'Plot Rate'} value={money(form.plot_rate)} money />
        <Cell label="Total Value"  value={money(form.total_value  ?? c.total_value)}  money />
        <Cell label="Selling Rate" value={money(form.selling_rate)} money />
        <Cell label="Actual Price" value={money(form.actual_price ?? c.actual_price)} money accent />
      </Section>

      {/* Payments */}
      <Section title="Payments">
        <Cell label="Booking Amount"  value={money(form.booking_amount)}  money />
        {form.booking_details && <Cell label="Booking Details" value={v(form.booking_details)} />}
        <Cell label="Advance Payment" value={money(form.advance_payment)} money />
        {form.advance_payment_details && <Cell label="Advance Details" value={v(form.advance_payment_details)} />}
        <Cell label="Balance Amount"  value={money(form.balance_amount ?? c.balance_amount)} money accent />
        {form.balance_amount_details && <Cell label="Balance Details" value={v(form.balance_amount_details)} />}
        {form.payment_due_date && <Cell label="Payment Due Date" value={dt(form.payment_due_date)} />}
      </Section>

      {/* Charges */}
      {(form.registration_charges || form.intkaal_charges || form.water_connection_charges || form.electricity_meter_charges) && (
        <Section title="Charges">
          {form.registration_charges     && <Cell label="Registration Charges"  value={money(form.registration_charges)}     money />}
          {form.registration_details     && <Cell label="Registration Details"  value={v(form.registration_details)} />}
          {form.intkaal_charges          && <Cell label="Intkaal Charges"       value={money(form.intkaal_charges)}          money />}
          {form.intkaal_details          && <Cell label="Intkaal Details"       value={v(form.intkaal_details)} />}
          {form.water_connection_charges && <Cell label="Water Connection"      value={money(form.water_connection_charges)} money />}
          {form.water_connection_details && <Cell label="Water Details"         value={v(form.water_connection_details)} />}
          {form.electricity_meter_charges && <Cell label="Electricity Meter"   value={money(form.electricity_meter_charges)} money />}
          {form.electricity_meter_details && <Cell label="Electricity Details" value={v(form.electricity_meter_details)} />}
        </Section>
      )}

      {/* Other Financial */}
      {(form.discount || form.brokerage || form.incentive || form.extra_income || form.net_amount) && (
        <Section title="Other Financial">
          {form.discount    && <Cell label="Discount"     value={money(form.discount)}    money />}
          {form.brokerage   && <Cell label="Brokerage"    value={money(form.brokerage)}   money />}
          {form.incentive   && <Cell label="Incentive"    value={money(form.incentive)}   money />}
          {form.extra_income && <Cell label="Extra Income" value={money(form.extra_income)} money />}
          {form.discount_details   && <Cell label="Discount Details"   value={v(form.discount_details)} />}
          {form.brokerage_details  && <Cell label="Brokerage Details"  value={v(form.brokerage_details)} />}
          {form.incentive_details  && <Cell label="Incentive Details"  value={v(form.incentive_details)} />}
          {form.extra_income_details && <Cell label="Extra Income Details" value={v(form.extra_income_details)} />}
          <Cell label="Net Amount" value={money(form.net_amount ?? c.net_amount)} money accent />
        </Section>
      )}

      {/* Broker */}
      {(form.broker_name || form.broker_details) && (
        <Section title="Broker">
          {form.broker_name    && <Cell label="Broker Name"    value={v(form.broker_name)} />}
          {form.broker_details && <Cell label="Broker Details" value={v(form.broker_details)} wide />}
        </Section>
      )}

      {/* Registration & Possession */}
      <Section title="Registration & Possession">
        <Cell label="Possession"          value={form.possession ? (POSS_LABEL[form.possession] || form.possession) : null} />
        {form.possession_detail       && <Cell label="Possession Detail"   value={v(form.possession_detail)} />}
        {form.date_of_registration    && <Cell label="Date of Registration" value={dt(form.date_of_registration)} />}
        {form.intkaal_number          && <Cell label="Intkaal Number"       value={v(form.intkaal_number)} />}
        {form.vasika                  && <Cell label="Vasika"               value={v(form.vasika)} />}
      </Section>

      {form.other_details && (
        <Section title="Other">
          <Cell label="Other Details" value={v(form.other_details)} wide />
        </Section>
      )}
    </div>
  );
}

// ── Delete Modal ──────────────────────────────────────────────────────────────
function DeleteModal({ open, onClose, onConfirm, deleting }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete sale?</h3>
        <p className="text-sm text-gray-500 mb-5">This sale and its installments will be permanently deleted.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-8 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="px-4 h-8 text-sm rounded-lg text-white bg-red-500 hover:bg-red-600 min-w-[90px]">{deleting?'Deleting…':'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Financials Tab ────────────────────────────────────────────────────────────
function FinancialsTab({ form, instPaid = 0 }) {
  const c = computed(form);
  const actual   = Number(form.actual_price  ?? c.actual_price  ?? 0);
  const total_v  = Number(form.total_value   ?? c.total_value   ?? 0);
  const balance  = Number(form.balance_amount ?? c.balance_amount ?? 0);
  const net      = Number(form.net_amount    ?? c.net_amount    ?? 0);
  const effBal   = Math.max(0, balance - instPaid);

  const Row = ({ label, value, sub, accent }) => (
    <div className={`flex items-center justify-between py-2.5 border-b border-gray-50 last:border-b-0 ${accent?'bg-[#875A7B]/3 -mx-4 px-4 rounded':''}`}>
      <div>
        <p className={`text-sm ${accent?'font-bold text-[#875A7B]':'text-gray-700'}`}>{label}</p>
        {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      </div>
      <p className={`text-sm font-bold tabular-nums ${accent?'text-[#875A7B]':'text-gray-800'}`}>{value}</p>
    </div>
  );

  const Hdr = ({ children }) => <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-5 mb-2 first:mt-0">{children}</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5">
      {/* Area & Value */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <Hdr>Area Measurement{form._inventory ? ' · from inventory unit' : ''}</Hdr>
        <Row label="Front Area" value={form.front_area ? `${Number(form.front_area).toLocaleString('en-IN')} ${form.front_area_details||''}`.trim() : '—'} />
        <Row label="Back Area"  value={form.back_area  ? `${Number(form.back_area).toLocaleString('en-IN')}  ${form.back_area_details||''}`.trim()  : '—'} />
        {(() => { const f = parseFloat(form.front_area)||0, b = parseFloat(form.back_area)||0; const stored = parseFloat(form.total_area || c.total_area || 0); const t = f && b ? parseFloat((f*(b/9)).toFixed(4)) : stored; return <Row label="Total Area" value={t ? `${t.toLocaleString('en-IN')} ${form.front_area_details||form.total_area_details||''}`.trim() : '—'} sub="Front × (Back ÷ 9)" accent />; })()}
        {form.registration_area && <Row label="Registration Area" value={`${form.registration_area}`} />}
        <Hdr>Pricing{form._inventory ? ' · Plot Rate from unit' : ''}</Hdr>
        <Row label="Plot Rate"    value={form.plot_rate    ? fmtINR(form.plot_rate)    : '—'} sub="/unit" />
        <Row label="Total Value"  value={total_v  ? fmtINR(total_v)  : '—'} sub="Total Area × Plot Rate" />
        <Row label="Selling Rate" value={form.selling_rate ? fmtINR(form.selling_rate) : '—'} sub="/unit" />
        <Row label="Actual Price" value={actual  ? fmtINR(actual)  : '—'} sub="Total Area × Selling Rate" accent />
      </div>

      {/* Payments & Charges */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <Hdr>Payments</Hdr>
        <Row label="Booking Amount"   value={form.booking_amount   ? fmtINR(form.booking_amount)   : '—'} sub={form.booking_details||''} />
        <Row label="Advance Payment"  value={form.advance_payment  ? fmtINR(form.advance_payment)  : '—'} sub={form.advance_payment_details||''} />
        <Row label="Balance Amount"   value={balance ? fmtINR(balance) : '—'} sub="Actual Price − Advance" />
        {instPaid > 0 && <Row label="Instalments Paid" value={fmtINR(instPaid)} sub="Total paid via instalments" />}
        {instPaid > 0 && <Row label="Remaining Balance" value={fmtINR(effBal)} sub="Balance − Instalments Paid" accent />}
        {form.payment_due_date && <Row label="Payment Due" value={fmtDate(form.payment_due_date)} />}

        <Hdr>Charges</Hdr>
        {form.registration_charges      && <Row label="Registration Charges"      value={fmtINR(form.registration_charges)}      sub={form.registration_details||''} />}
        {form.intkaal_charges            && <Row label="Intkaal Charges"            value={fmtINR(form.intkaal_charges)}            sub={form.intkaal_details||''} />}
        {form.water_connection_charges   && <Row label="Water Connection"           value={fmtINR(form.water_connection_charges)}   sub={form.water_connection_details||''} />}
        {form.electricity_meter_charges  && <Row label="Electricity Meter"          value={fmtINR(form.electricity_meter_charges)}  sub={form.electricity_meter_details||''} />}

        <Hdr>Other</Hdr>
        {form.discount   && <Row label="Discount"    value={fmtINR(form.discount)}   sub={form.discount_details||''} />}
        {form.brokerage  && <Row label="Brokerage"   value={fmtINR(form.brokerage)}  sub={form.brokerage_details||''} />}
        {form.incentive  && <Row label="Incentive"   value={fmtINR(form.incentive)}  sub={form.incentive_details||''} />}
        {form.extra_income && <Row label="Extra Income" value={fmtINR(form.extra_income)} sub={form.extra_income_details||''} />}

        <Hdr>Net</Hdr>
        <Row label="Net Amount" value={net ? fmtINR(net) : '—'} sub="Booking + Advance + Charges" accent />

        {(form.date_of_registration || form.intkaal_number || form.vasika) && (
          <>
            <Hdr>Registration</Hdr>
            {form.intkaal_number      && <Row label="Intkaal Number" value={form.intkaal_number} />}
            {form.vasika              && <Row label="Vasika"         value={form.vasika} />}
            {form.date_of_registration && <Row label="Date of Reg."  value={fmtDate(form.date_of_registration)} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Status colors ─────────────────────────────────────────────────────────────
const BOOKING_STATUS_CLS = {
  PENDING:   'bg-amber-50 text-amber-700 ring-amber-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REFUNDED:  'bg-red-50 text-red-500 ring-red-200',
};

// ── BookingPanel ──────────────────────────────────────────────────────────────
function BookingPanel({ saleId, canEdit, onConfirmed }) {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [deleting,   setDeleting]   = useState(null);
  const [error,    setError]    = useState('');

  const emptyForm = { _customer: null, customer_id: '', booking_amount: '', notes: '' };
  const [addForm, setAddForm] = useState(emptyForm);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBookings(await apiGet(`/sales/${saleId}/bookings`)); }
    catch (e) { setError(e.message); }
    finally   { setLoading(false); }
  }, [saleId]);

  useEffect(() => { load(); }, [load]);

  const handleAddSave = async () => {
    setSaving(true); setError('');
    try {
      await apiPost(`/sales/${saleId}/bookings`, {
        customer_id:    addForm.customer_id || null,
        booking_amount: addForm.booking_amount || null,
        notes:          addForm.notes || null,
      });
      setAddForm(emptyForm); setShowAdd(false);
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeleting(id); setError('');
    try { await apiDelete(`/sales/${saleId}/bookings/${id}`); await load(); }
    catch (e) { setError(e.message); }
    finally { setDeleting(null); }
  };

  const handleConfirm = async (id, advance_payment) => {
    setConfirming(id); setError('');
    try {
      await apiPost(`/sales/${saleId}/bookings/${id}/confirm`, { advance_payment: advance_payment || null });
      onConfirmed?.();
      await load();
    } catch (e) { setError(e.message); }
    finally { setConfirming(null); }
  };

  const isConfirmed = bookings.some(b => b.status === 'CONFIRMED');
  const bookedCustomerIds = bookings.map(b => b.customer_id).filter(Boolean);

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Customer Bookings</h3>
          <p className="text-xs text-gray-400 mt-0.5">Add interested customers, then confirm one to close the sale.</p>
        </div>
        {canEdit && !isConfirmed && (
          <button onClick={() => { setShowAdd(true); setError(''); }}
            className="h-8 px-3 text-xs font-semibold rounded-lg text-white flex items-center gap-1.5"
            style={{ backgroundColor: '#875A7B' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add Booking
          </button>
        )}
      </div>

      {isConfirmed && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <svg className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-700">Sale confirmed</p>
            <p className="text-xs text-emerald-600 mt-0.5">Payments, Charges, Other Financial and Registration &amp; Possession sections are now available. Go to <strong>Sale Details → Edit Sale</strong> to enter financial details.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">{error}</div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="border border-[#875A7B]/30 rounded-xl p-4 bg-[#875A7B]/5 space-y-3">
          <p className="text-xs font-bold text-gray-700">New Booking</p>

          <CustomerPicker
            value={addForm._customer}
            onPick={(c) => setAddForm(p => ({ ...p, customer_id: c.id, _customer: c }))}
            onClear={() => setAddForm(p => ({ ...p, customer_id: '', _customer: null }))}
            excludeIds={bookedCustomerIds}
          />

          <input
            type="number"
            value={addForm.booking_amount}
            onChange={e => setAddForm(p => ({ ...p, booking_amount: e.target.value }))}
            placeholder="Booking amount (₹)"
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#875A7B]"
          />
          <textarea
            value={addForm.notes}
            onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Notes…"
            rows={2}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#875A7B] resize-none"
          />
          <div className="flex gap-2">
            <button onClick={handleAddSave} disabled={saving}
              className="h-7 px-4 text-xs font-semibold rounded-lg text-white" style={{ backgroundColor: '#875A7B' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setShowAdd(false); setAddForm(emptyForm); }}
              className="h-7 px-3 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bookings table */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <p className="text-sm">No bookings yet</p>
          <p className="text-xs mt-1">Add interested customers using the button above.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {bookings.map((b, idx) => (
            <BookingRow key={b.id} booking={b} idx={idx}
              canEdit={canEdit} isConfirmed={isConfirmed}
              onConfirm={(advance) => handleConfirm(b.id, advance)} confirming={confirming === b.id}
              onDelete={() => handleDelete(b.id)}    deleting={deleting === b.id}
              saleId={saleId} onSaved={load}
              excludeCustomerIds={bookedCustomerIds.filter(id => id !== b.customer_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingRow({ booking: b, idx, canEdit, isConfirmed, onConfirm, confirming, onDelete, deleting, saleId, onSaved, excludeCustomerIds }) {
  const [editing,     setEditing]     = useState(false);
  const [confirming2, setConfirming2] = useState(false); // inline confirm panel
  const [advance,     setAdvance]     = useState('');
  const [form,        setForm]        = useState({
    _customer:      b.customer || null,
    customer_id:    b.customer_id || '',
    booking_amount: b.booking_amount != null ? String(b.booking_amount) : '',
    notes:          b.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const base  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      await fetch(`${base}/sales/${saleId}/bookings/${b.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ customer_id: form.customer_id || null, booking_amount: form.booking_amount || null, notes: form.notes || null }),
      });
      setEditing(false); await onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const cls = BOOKING_STATUS_CLS[b.status] || 'bg-gray-50 text-gray-500 ring-gray-200';

  if (editing) {
    return (
      <div className="p-4 bg-[#875A7B]/5 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-gray-600">Booking #{idx + 1}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${cls}`}>{b.status}</span>
        </div>
        <CustomerPicker
          value={form._customer}
          onPick={(c) => setForm(p => ({ ...p, customer_id: c.id, _customer: c }))}
          onClear={() => setForm(p => ({ ...p, customer_id: '', _customer: null }))}
          excludeIds={excludeCustomerIds}
        />
        <input type="number" value={form.booking_amount} onChange={e => setForm(p => ({ ...p, booking_amount: e.target.value }))}
          placeholder="Amount ₹" className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#875A7B]" />
        <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes…" rows={2}
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#875A7B] resize-none" />
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="h-7 px-3 text-xs font-semibold rounded-lg text-white" style={{ backgroundColor: '#875A7B' }}>
            {saving ? 'Saving…' : 'Update'}
          </button>
          <button onClick={() => setEditing(false)} className="h-7 px-3 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={`p-4 flex items-start gap-3 ${b.status === 'CONFIRMED' ? 'bg-emerald-50/60' : b.status === 'REFUNDED' ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
      {/* Index */}
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
        style={{ backgroundColor: '#875A7B15', color: '#875A7B' }}>
        {idx + 1}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          {b.customer ? (
            <span className="text-sm font-semibold text-gray-800">{b.customer.name}</span>
          ) : (
            <span className="text-sm text-gray-400 italic">No customer</span>
          )}
          {b.customer?.customer_code && <span className="text-[10px] text-gray-400">· {b.customer.customer_code}</span>}
          {b.customer?.phone && <span className="text-[10px] text-gray-400">· {b.customer.phone}</span>}
        </div>
        {b.booking_amount != null && (
          <p className="text-xs text-gray-600"><span className="font-medium text-[#875A7B]">{fmtINR(b.booking_amount)}</span> booking amount</p>
        )}
        {b.notes && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{b.notes}</p>}
      </div>

      {/* Status + Actions */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${cls}`}>{b.status}</span>
        {canEdit && b.status === 'PENDING' && !isConfirmed && !confirming2 && (
          <div className="flex gap-1.5">
            <button onClick={() => setEditing(true)}
              className="h-6 px-2 text-[10px] border border-gray-200 rounded text-gray-500 hover:bg-gray-50">Edit</button>
            <button onClick={onDelete} disabled={deleting}
              className="h-6 px-2 text-[10px] border border-red-100 rounded text-red-400 hover:bg-red-50">
              {deleting ? '…' : 'Delete'}
            </button>
            <button onClick={() => { setConfirming2(true); setAdvance(''); }}
              className="h-6 px-2.5 text-[10px] font-bold rounded text-white"
              style={{ backgroundColor: '#875A7B' }}>
              Confirm Sale
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Inline advance panel */}
    {confirming2 && (
      <div className="border-t border-[#875A7B]/20 bg-[#875A7B]/5 px-4 py-3 space-y-2.5">
        <p className="text-xs font-bold text-gray-700">Confirm sale with {b.customer?.name || 'this customer'}</p>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Advance Payment Received (₹)</label>
          <input
            autoFocus
            type="number"
            value={advance}
            onChange={e => setAdvance(e.target.value)}
            placeholder="Enter advance amount…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/20"
          />
          {b.booking_amount != null && (
            <p className="text-[10px] text-gray-400 mt-1">Booking amount: {fmtINR(b.booking_amount)}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { onConfirm(advance); setConfirming2(false); }}
            disabled={confirming}
            className="h-8 px-4 text-xs font-bold rounded-lg text-white flex items-center gap-1.5"
            style={{ backgroundColor: '#875A7B' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
            {confirming ? 'Confirming…' : 'Confirm & Close Sale'}
          </button>
          <button onClick={() => setConfirming2(false)}
            className="h-8 px-3 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SaleDetailPage() {
  useAuth();
  const router  = useRouter();
  const params  = useParams();
  const { can, me } = usePermissions();

  const [form,     setForm]     = useState({ ...EMPTY });
  const [original, setOriginal] = useState({ ...EMPTY });
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');
  const [showDel,  setShowDel]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab,           setTab]           = useState('details');
  const [totalInstPaid, setTotalInstPaid] = useState(0);
  const [projectOpen,   setProjectOpen]   = useState(false);
  const [linkedProject, setLinkedProject] = useState(null);
  const [projectSaving, setProjectSaving] = useState(false);

  const canEdit   = can('SALE_EDIT')   || me?.is_system;
  const canDelete = can('SALE_DELETE') || me?.is_system;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/sales/${params.id}`);
      const s = toFormState(data);
      setForm(s); setOriginal(s);
      setLinkedProject(data.inventory?.project || null);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => { setForm(p => ({ ...p, [key]: e.target.value })); setError(''); };

  const handlePickProject = async (project) => {
    setProjectOpen(false);
    if (!form._inventory?.id) return;
    setProjectSaving(true);
    try {
      await apiPut(`/inventory/${form._inventory.id}`, { project_id: project.id });
      setLinkedProject(project);
    } catch (e) { setError(e.message); }
    finally { setProjectSaving(false); }
  };
  const handleEdit    = () => { setEditing(true);  setSaved(false); setError(''); };
  const handleDiscard = () => { setForm(original); setEditing(false); setError(''); };
  const handleSave    = async () => {
    if (!form.sale_date)    { setError('Sale Date is required'); return; }
    if (!form.selling_rate) { setError('Selling Rate is required'); return; }
    setSaving(true); setError('');
    try {
      const { _inventory, _customer, _broker, ...payload } = form;
      await apiPut(`/sales/${params.id}`, payload);
      setEditing(false); setSaved(true);
      await load();
    } catch (e) { setError(e.message); }
    finally     { setSaving(false); }
  };
  const handleDelete = async () => {
    setDeleting(true);
    try { await apiDelete(`/sales/${params.id}`); router.push('/dashboard/sales'); }
    catch (e) { setError(e.message); setDeleting(false); setShowDel(false); }
  };

  if (loading) return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-200 h-12 animate-pulse" />
      <div className="p-4 space-y-4">
        <div className="h-56 bg-white rounded-xl border animate-pulse" />
        <div className="h-10 bg-white rounded-xl border animate-pulse" />
        <div className="h-80 bg-white rounded-xl border animate-pulse" />
      </div>
    </div>
  );

  const c          = computed(form);
  const actualP    = Number(form.actual_price   ?? c.actual_price   ?? 0);
  const balanceP   = Number(form.balance_amount ?? c.balance_amount ?? 0);
  const netP       = Number(form.net_amount     ?? c.net_amount     ?? 0);
  const bookingP   = Number(form.booking_amount  || 0);
  const advanceP   = Number(form.advance_payment || 0);
  const receivedP  = bookingP + advanceP;

  // Installment quick summary from form's linked installment (loaded from API via INCLUDE)
  const instRec   = form.installment || null;
  let instPaidCount = 0, instTotalCount = 0, instPaidAmt = 0;
  if (instRec) {
    for (let n = 1; n <= 20; n++) {
      if (instRec[`inst_${n}_amount`] != null) instTotalCount++;
      if (instRec[`inst_${n}_paid`]) { instPaidCount++; instPaidAmt += Number(instRec[`inst_${n}_amount`] || 0); }
    }
  }
  // Effective paid = live totalInstPaid (updated by InstallmentPanel), fallback to embedded instPaidAmt on first render
  const effectiveInstPaid   = totalInstPaid || instPaidAmt;
  const effectiveBalance    = Math.max(0, balanceP - effectiveInstPaid);
  const effectiveReceivedP  = receivedP + effectiveInstPaid;

  const confirmed = !!form.sale_confirmed;
  const TABS = [
    { id: 'details',      label: 'Sale Details' },
    { id: 'bookings',     label: 'Bookings' + (form.bookings?.length ? ` (${form.bookings.length})` : '') },
    { id: 'installments', label: 'Installments', locked: !confirmed },
    { id: 'financials',   label: 'Financials',   locked: !confirmed },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* ── Control bar ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0 text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
            <span className="mx-1 text-gray-300">›</span>
            <Link href="/dashboard/sales" className="hover:text-gray-700">Sales</Link>
            <span className="mx-1 text-gray-300">›</span>
            <span className="text-gray-800 font-medium truncate">{form.sale_code || `Sale #${params.id}`}</span>
          </nav>

          {saved && !editing && (
            <span className="text-xs text-emerald-600 flex items-center gap-1 shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Saved
            </span>
          )}

          <div className="flex gap-2 shrink-0">
            <Link href="/dashboard/sales"
              className="h-8 px-3 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>Back
            </Link>

            {/* Add to Project */}
            {form._inventory?.id && (
              <div className="relative">
                <button
                  onClick={() => setProjectOpen(v => !v)}
                  disabled={projectSaving}
                  className={`h-8 px-3 text-sm border rounded-lg flex items-center gap-1.5 transition ${linkedProject ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                  {projectSaving ? 'Saving…' : linkedProject ? linkedProject.name : 'Add to Project'}
                </button>
                {projectOpen && (
                  <ProjectPicker
                    current={linkedProject}
                    onPick={handlePickProject}
                    onClose={() => setProjectOpen(false)}
                  />
                )}
              </div>
            )}
            {editing ? (
              <>
                <button onClick={handleDiscard} disabled={saving} className="h-8 px-4 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Discard</button>
                <button onClick={handleSave}    disabled={saving} className="h-8 px-5 text-sm rounded-lg text-white font-semibold" style={{backgroundColor:'#875A7B'}}>
                  {saving?'Saving…':'Save'}
                </button>
              </>
            ) : (
              <>
                {canEdit && (
                  <button onClick={handleEdit} className="h-8 px-4 text-sm rounded-lg font-semibold text-white flex items-center gap-1.5" style={{backgroundColor:'#875A7B'}}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Edit Sale
                  </button>
                )}
                {canDelete && (
                  <button onClick={()=>setShowDel(true)} className="h-8 px-3 text-sm border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition">Delete</button>
                )}
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {error}
            <button onClick={()=>setError('')} className="ml-auto"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 space-y-4">

          {/* ── Hero card ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_260px] divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

              {/* Left: Visual */}
              <div className="p-5 bg-gray-50/40 flex items-center justify-center">
                <SaleVisual form={form} />
              </div>

              {/* Center: Key details */}
              <div className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                      {form.sale_code || `Sale #${params.id}`}
                      {editing && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>Editing</span>}
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">{form.sale_date ? `Sale date: ${fmtDate(form.sale_date)}` : 'No sale date'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                  {/* Inventory */}
                  {form._inventory && (
                    <div className="col-span-full sm:col-span-1">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Inventory Unit</p>
                      <Link href={`/dashboard/inventory/${form._inventory.id}`}
                        className="text-sm font-semibold text-[#875A7B] hover:underline flex items-center gap-1">
                        {form._inventory.inventory_code}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                      </Link>
                      <p className="text-[10px] text-gray-400">{form._inventory.plot_no||form._inventory.sl_no||''}</p>
                    </div>
                  )}

                  {/* Project */}
                  {linkedProject && (
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Project</p>
                      <Link href={`/dashboard/projects/${linkedProject.id}`}
                        className="text-sm font-semibold text-emerald-700 hover:underline flex items-center gap-1">
                        {linkedProject.name}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                      </Link>
                      {linkedProject.project_code && <p className="text-[10px] text-gray-400">{linkedProject.project_code}</p>}
                    </div>
                  )}

                  {/* Area from inventory/sale */}
                  {(form.front_area || form.back_area) && (
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Area (F × B)</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {form.front_area && form.back_area
                          ? `${Number(form.front_area).toLocaleString('en-IN')} × ${Number(form.back_area).toLocaleString('en-IN')}${form.front_area_details ? ` ${form.front_area_details}` : ''}`
                          : form.front_area || form.back_area || '—'}
                      </p>
                      {(() => { const f = parseFloat(form.front_area)||0, b = parseFloat(form.back_area)||0; const t = f && b ? parseFloat((f*(b/9)).toFixed(2)) : 0; return t ? <p className="text-[10px] text-gray-400">Total: {t.toLocaleString('en-IN')} {form.front_area_details||''}</p> : null; })()}
                    </div>
                  )}

                  {/* Plot Rate */}
                  {form.plot_rate && (
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Plot Rate</p>
                      <p className="text-sm font-semibold text-[#875A7B]">{fmtINR(form.plot_rate)}<span className="text-[10px] font-normal text-gray-400 ml-1">/unit</span></p>
                    </div>
                  )}

                  {/* Customer */}
                  {form._customer && (
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Customer</p>
                      <Link href={`/dashboard/customers/${form._customer.id}`}
                        className="text-sm font-semibold text-[#875A7B] hover:underline flex items-center gap-1">
                        {form._customer.name}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                      </Link>
                      <p className="text-[10px] text-gray-400">{form._customer.phone||form._customer.customer_code||''}</p>
                    </div>
                  )}

                  {/* Broker */}
                  {(form._broker || form.broker_name) && (
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Broker</p>
                      {form._broker
                        ? <Link href={`/dashboard/brokers/${form._broker.id}`} className="text-sm font-semibold text-[#875A7B] hover:underline">{form._broker.name}</Link>
                        : <p className="text-sm font-semibold text-gray-700">{form.broker_name}</p>}
                      <p className="text-[10px] text-gray-400">{form._broker?.broker_code||'Broker'}</p>
                    </div>
                  )}

                  {/* Type */}
                  {form.type && (
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Type</p>
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{backgroundColor:TYPE_ICON_BG[form.type]||'#875A7B15',color:TYPE_ICON_COLOR[form.type]||'#875A7B'}}>
                        {TYPE_LABEL[form.type]||form.type}
                      </span>
                    </div>
                  )}

                  {/* Possession */}
                  {form.possession && (
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Possession</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ring-1 ${POSS_RING[form.possession]||''}`}>
                        {POSS_LABEL[form.possession]}
                      </span>
                    </div>
                  )}

                  {/* Registration date */}
                  {form.date_of_registration && (
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Registered</p>
                      <p className="text-xs font-semibold text-emerald-700">{fmtDate(form.date_of_registration)}</p>
                    </div>
                  )}

                  {form.sl_no && (
                    <div><p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">SL No.</p><p className="text-sm text-gray-700">{form.sl_no}</p></div>
                  )}

                  {form.details && (
                    <div className="col-span-full">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Details</p>
                      <p className="text-xs text-gray-600 line-clamp-2">{form.details}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Financial KPIs */}
              <div className="p-5 space-y-2.5">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Financials</h3>

                <div className="bg-[#875A7B]/5 rounded-xl p-3 border border-[#875A7B]/10">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide">Actual Price</p>
                  <p className="text-xl font-black text-[#875A7B]">{fmtINR(actualP)}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-100">
                    <p className="text-[8px] text-gray-400 uppercase tracking-wide">Booking</p>
                    <p className="text-xs font-bold text-emerald-700">{fmtINR(bookingP)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                    <p className="text-[8px] text-gray-400 uppercase tracking-wide">Advance</p>
                    <p className="text-xs font-bold text-blue-700">{fmtINR(advanceP)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
                    <p className="text-[8px] text-gray-400 uppercase tracking-wide">Balance</p>
                    <p className="text-xs font-bold text-amber-700">{fmtINR(effectiveBalance)}</p>
                  </div>
                  <div className="bg-violet-50 rounded-lg p-2.5 border border-violet-100">
                    <p className="text-[8px] text-gray-400 uppercase tracking-wide">Net Amount</p>
                    <p className="text-xs font-bold text-violet-700">{fmtINR(netP)}</p>
                  </div>
                </div>

                {/* Payment progress */}
                {actualP > 0 && (
                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <PayBar received={effectiveReceivedP} total={actualP} />
                    <p className="text-[9px] text-gray-400 mt-1">{fmtINR(effectiveReceivedP)} received of {fmtINR(actualP)}</p>
                  </div>
                )}

                {/* Installments summary */}
                {instTotalCount > 0 && (
                  <div className="bg-violet-50 rounded-xl p-3 border border-violet-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide">Installments Paid</p>
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">{instPaidCount}/{instTotalCount}</span>
                    </div>
                    <p className="text-sm font-bold text-violet-700">{fmtINR(instPaidAmt)}</p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-gray-100 px-1">
              {TABS.map(t => t.locked ? (
                <div key={t.id}
                  title="Available after sale is confirmed"
                  className="px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-300 cursor-not-allowed flex items-center gap-1.5 select-none">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  {t.label}
                </div>
              ) : (
                <button key={t.id} onClick={() => { setTab(t.id); if(t.id!=='details') setEditing(false); }}
                  className={`px-5 py-3 text-sm font-medium transition border-b-2 -mb-px ${tab===t.id?'border-[#875A7B] text-[#875A7B]':'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab: Sale Details */}
            {tab === 'details' && (
              editing ? (
                <div className="p-6">
                  <SaleFormBody form={form} set={set} setForm={setForm} showFinancials={!!form.sale_confirmed} />
                  <div className="flex justify-end gap-2 mt-6 pt-5 border-t border-gray-100">
                    <button onClick={handleDiscard} className="h-8 px-4 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Discard</button>
                    <button onClick={handleSave} disabled={saving} className="h-8 px-5 text-sm rounded-lg text-white font-semibold" style={{backgroundColor:'#875A7B'}}>
                      {saving?'Saving…':'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <SaleDetailView form={form} linkedProject={linkedProject} />
              )
            )}

            {/* Tab: Bookings */}
            {tab === 'bookings' && (
              <BookingPanel
                saleId={params.id}
                canEdit={canEdit}
                onConfirmed={async () => {
                  await load();
                  setTab('details');
                  setEditing(true);
                }}
              />
            )}

            {/* Tab: Installments */}
            {tab === 'installments' && (
              <div className="p-5">
                <InstallmentPanel saleId={params.id} canEdit={canEdit} onTotalPaidChange={setTotalInstPaid} />
              </div>
            )}

            {/* Tab: Financials */}
            {tab === 'financials' && (
              <FinancialsTab form={form} instPaid={effectiveInstPaid} />
            )}

          </div>

        </div>
      </div>

      <DeleteModal open={showDel} onClose={()=>setShowDel(false)} onConfirm={handleDelete} deleting={deleting} />
    </div>
  );
}
