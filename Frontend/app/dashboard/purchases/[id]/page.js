'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiPut, apiDelete, apiPost } from '@/lib/api';
import { EMPTY, computed, getStageIndex, StatusPipeline, TYPE_RING, fmtINR, fmtNum, BrokerPicker } from '../_components/shared';

// ── Inline field atoms ─────────────────────────────────────────────────────────
function Label({ children }) {
  return <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{children}</p>;
}
function Val({ children, mono }) {
  return (
    <p className={`text-sm font-medium text-gray-800 ${mono ? 'font-mono' : ''}`}>
      {children || <span className="text-gray-300 font-normal">—</span>}
    </p>
  );
}
function FInput({ label, value, onChange, type = 'text', placeholder, readOnly }) {
  return (
    <div>
      <Label>{label}</Label>
      {readOnly
        ? <Val>{value}</Val>
        : <input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
            className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />}
    </div>
  );
}
function FSelect({ label, value, onChange, readOnly, children }) {
  return (
    <div>
      <Label>{label}</Label>
      {readOnly
        ? <Val>{value}</Val>
        : <select value={value} onChange={onChange}
            className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition">
            {children}
          </select>}
    </div>
  );
}
function FTextarea({ label, value, onChange, placeholder, rows = 2, readOnly }) {
  return (
    <div>
      <Label>{label}</Label>
      {readOnly
        ? <p className="text-sm text-gray-800 font-medium whitespace-pre-wrap min-h-[1.5rem]">{value || <span className="text-gray-300">—</span>}</p>
        : <textarea value={value ?? ''} onChange={onChange} placeholder={placeholder} rows={rows}
            className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition resize-none placeholder:text-gray-300" />}
    </div>
  );
}
function Card({ title, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {title && (
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</p>
          {action}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Installment helpers ────────────────────────────────────────────────────────
const ORDINALS = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th','13th','14th','15th','16th','17th','18th','19th','20th'];
function fmtDate(s) { if (!s) return ''; const d = new Date(s); return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); }
function emptyInst() {
  const d = { sl_no: '', installment_details: '' };
  for (let n = 1; n <= 20; n++) { d[`inst_${n}_amount`] = ''; d[`inst_${n}_date`] = ''; d[`inst_${n}_paid`] = false; }
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

function InstCard({ n, label, form, editing, setF }) {
  const amt = form[`inst_${n}_amount`];
  const dt  = form[`inst_${n}_date`];
  const pd  = form[`inst_${n}_paid`];
  const hasData = !!(amt || dt);
  if (editing) {
    return (
      <div className={`rounded-xl border-2 p-4 space-y-3 transition ${pd ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={pd} onChange={e => setF(`inst_${n}_paid`, e.target.checked)} className="w-4 h-4 rounded accent-emerald-600 cursor-pointer" />
            <span className={`text-xs font-semibold ${pd ? 'text-emerald-700' : 'text-gray-400'}`}>Paid</span>
          </label>
        </div>
        <input type="number" value={amt} onChange={e => setF(`inst_${n}_amount`, e.target.value)} placeholder="Amount ₹"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/20 placeholder:text-gray-300" />
        <input type="date" value={dt} onChange={e => setF(`inst_${n}_date`, e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/20" />
      </div>
    );
  }
  const cardCls = pd ? 'border-emerald-200 bg-emerald-50' : hasData ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50';
  return (
    <div className={`rounded-xl border-2 p-4 ${cardCls}`}>
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-bold uppercase tracking-wide ${pd ? 'text-emerald-600' : hasData ? 'text-amber-600' : 'text-gray-300'}`}>{label}</span>
        {pd ? (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>Paid
          </span>
        ) : hasData ? (
          <span className="text-[10px] font-bold text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full">Due</span>
        ) : null}
      </div>
      <p className={`text-base font-bold leading-tight ${pd ? 'text-emerald-700' : hasData ? 'text-gray-800' : 'text-gray-200'}`}>
        {amt ? `₹${Number(amt).toLocaleString('en-IN')}` : <span className="text-sm font-normal text-gray-200">—</span>}
      </p>
      {dt && <p className={`text-xs mt-1.5 ${pd ? 'text-emerald-500' : 'text-gray-400'}`}>{fmtDate(dt)}</p>}
    </div>
  );
}

function PurchaseInstallmentPanel({ purchaseId, canEdit, onTotalPaidChange }) {
  const [form,       setInstForm]  = useState(emptyInst());
  const [loading,    setLoading]   = useState(true);
  const [editing,    setEditing]   = useState(false);
  const [saving,     setSaving]    = useState(false);
  const [saved,      setSaved]     = useState(false);
  const [saveError,  setSaveError] = useState('');
  const [totalPaid,  setTotalPaid] = useState(0);
  const [balanceAmt, setBalance]   = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet(`/purchases/${purchaseId}/installments`);
      setInstForm(instFromApi(d.installment));
      setTotalPaid(d.total_paid || 0);
      setBalance(d.balance_amount || 0);
      onTotalPaidChange?.(d.total_paid || 0);
    } catch { /**/ }
    finally { setLoading(false); }
  }, [purchaseId]);

  useEffect(() => { load(); }, [load]);

  const setF = (key, val) => setInstForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaveError('');
    if (balanceAmt > 0) {
      let totalInstAmt = 0;
      for (let n = 1; n <= 20; n++) totalInstAmt += Number(form[`inst_${n}_amount`] || 0);
      if (totalInstAmt > balanceAmt) {
        setSaveError(`Total instalment amount (${fmtINR(totalInstAmt)}) exceeds the Instalment Balance (${fmtINR(balanceAmt)}). Please reduce the amounts.`);
        return;
      }
    }
    setSaving(true); setSaved(false);
    try {
      const d = await apiPut(`/purchases/${purchaseId}/installments`, form);
      setInstForm(instFromApi(d.installment));
      setTotalPaid(d.total_paid || 0);
      setBalance(d.balance_amount || 0);
      onTotalPaidChange?.(d.total_paid || 0);
      setEditing(false); setSaved(true);
    } catch { /**/ }
    finally { setSaving(false); }
  };

  const remaining   = balanceAmt - totalPaid;
  const paidCount   = ORDINALS.filter((_, i) => form[`inst_${i + 1}_paid`]).length;
  const filledCount = ORDINALS.filter((_, i) => form[`inst_${i + 1}_amount`]).length;

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array(8).fill(0).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-600 uppercase tracking-widest">Installment Schedule</p>
        {canEdit && (
          editing ? (
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex gap-2">
                <button onClick={() => { load(); setEditing(false); setSaveError(''); }} className="h-8 px-4 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Discard</button>
                <button onClick={handleSave} disabled={saving} className="h-8 px-5 text-sm rounded-lg text-white font-semibold" style={{ backgroundColor: '#875A7B' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              {saveError && <p className="text-[11px] text-red-500 text-right max-w-xs leading-tight">{saveError}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Saved</span>}
              <button onClick={() => { setEditing(true); setSaved(false); }} className="h-8 px-4 text-sm border border-[#875A7B] rounded-lg text-[#875A7B] hover:bg-[#875A7B]/5 font-medium flex items-center gap-2 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Edit
              </button>
            </div>
          )
        )}
      </div>
      <div className="p-6 space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { l: 'Instalment Balance Amount', v: fmtINR(balanceAmt), c: 'text-amber-700',   bg: 'bg-amber-50',   bd: 'border-amber-100' },
            { l: 'Total Paid',     v: fmtINR(totalPaid),  c: 'text-emerald-700', bg: 'bg-emerald-50', bd: 'border-emerald-100' },
            { l: 'Remaining',      v: fmtINR(remaining),  c: remaining > 0 ? 'text-red-600' : 'text-emerald-700',
              bg: remaining > 0 ? 'bg-red-50' : 'bg-emerald-50', bd: remaining > 0 ? 'border-red-100' : 'border-emerald-100' },
          ].map(({ l, v, c, bg, bd }) => (
            <div key={l} className={`${bg} border ${bd} rounded-xl p-4`}>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">{l}</p>
              <p className={`text-lg font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        {/* SL No + Details + Progress */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch">
          <div className="flex gap-4 flex-1">
            <div className="flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">SL. No.</p>
              {editing
                ? <input value={form.sl_no} onChange={e => setF('sl_no', e.target.value)} placeholder="SL No."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#875A7B] bg-white" />
                : <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 min-h-[38px]">{form.sl_no || '—'}</p>}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Details</p>
              {editing
                ? <input value={form.installment_details} onChange={e => setF('installment_details', e.target.value)} placeholder="Notes…"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#875A7B] bg-white" />
                : <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 min-h-[38px]">{form.installment_details || '—'}</p>}
            </div>
          </div>
          <div className="sm:w-52 bg-gray-50 border border-gray-100 rounded-xl px-5 py-3.5 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Progress</span>
              <span className="text-sm font-bold text-[#875A7B]">{paidCount}/{filledCount || 20}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${filledCount ? Math.round((paidCount / filledCount) * 100) : 0}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{paidCount} paid of {filledCount} set</p>
          </div>
        </div>
        {/* 20-slot grid — 4 columns max so cards breathe */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {ORDINALS.map((label, i) => (
            <InstCard key={i + 1} n={i + 1} label={label} form={form} editing={editing} setF={setF} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Delete modal ───────────────────────────────────────────────────────────────
function DeleteModal({ open, onClose, onConfirm, deleting }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete this record?</h3>
        <p className="text-sm text-gray-500 mb-5">This purchase will be permanently deleted and cannot be recovered.</p>
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

// ── Delete Unit modal ──────────────────────────────────────────────────────────
function DeleteUnitModal({ open, onClose, onConfirm, deleting, unitData }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete inventory unit?</h3>
        <p className="text-sm text-gray-500 mb-1">
          <span className="font-mono font-semibold text-[#875A7B]">{unitData?.inventory_code || `INV-${String(unitData?.id || '').padStart(4,'0')}`}</span>
          {unitData?.plot_no ? ` · Plot ${unitData.plot_no}` : ''}
        </p>
        <p className="text-sm text-gray-500 mb-5">This unit will be permanently deleted and cannot be recovered.</p>
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

// ── Add Unit modal (inline, no navigation) ────────────────────────────────────
const AREA_UNITS = ['gaj', 'acres', 'bigha'];
const UNIT_TYPES = ['PLOT', 'SHOP', 'LAND', 'FLAT'];

function AddUnitModal({ open, onClose, purchase, inventory = [], onCreated }) {
  const UNIT_EMPTY = { type: '', sl_no: '', location: '', plot_no: '', front_area: '', front_area_details: '', back_area: '', back_area_details: '', rate: '' };
  const [unit,   setUnit]   = useState(UNIT_EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const totalArea     = Number(purchase?.purchased_area || 0);
  const usedArea      = inventory.reduce((s, inv) => s + Number(inv.area || 0), 0);
  const remainingArea = parseFloat((totalArea - usedArea).toFixed(4));
  const areaUnit      = purchase?.purchased_area_details || '';
  const fa            = parseFloat(unit.front_area) || 0;
  const ba            = parseFloat(unit.back_area) || 0;
  const enteredArea   = fa && ba ? parseFloat((fa * (ba / 9)).toFixed(4)) : 0;
  const areaExceeds   = enteredArea > 0 && remainingArea > 0 && enteredArea > remainingArea;

  useEffect(() => {
    if (!open) return;
    setError('');
    setUnit({
      ...UNIT_EMPTY,
      type:                 purchase?.type     || 'PLOT',
      sl_no:                purchase?.sl_no    || '',
      location:             purchase?.location || '',
      plot_no:              purchase?.plot_no  || '',
      front_area_details:   purchase?.purchased_area_details || '',
      back_area_details:    purchase?.purchased_area_details || '',
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const set = (key) => (e) => { setUnit(p => ({ ...p, [key]: e.target.value })); setError(''); };

  const handleSave = async () => {
    if (!unit.rate || Number(unit.rate) <= 0) {
      setError('Plot Rate is required.');
      return;
    }
    if (areaExceeds) {
      setError(`Computed area (${enteredArea} ${areaUnit}) exceeds remaining ${remainingArea} ${areaUnit}.`);
      return;
    }
    setSaving(true); setError('');
    try {
      await apiPost('/inventory', { ...unit, purchase_id: purchase.id });
      onCreated();
    } catch (e) { setError(e.message || 'Failed to create unit'); }
    finally     { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Add Inventory Unit</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Linked to <span className="font-semibold text-[#875A7B]">{purchase?.purchase_code}</span>
              {purchase?.location ? ` · ${purchase.location}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Area allocation — compact single row */}
          {totalArea > 0 && (
            <div className={`rounded-lg border px-4 py-2.5 ${remainingArea <= 0 ? 'bg-red-50 border-red-200' : 'bg-[#875A7B]/5 border-[#875A7B]/20'}`}>
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Area</span>
                <span className="text-xs text-gray-500">Total <span className="font-bold text-gray-700">{totalArea} {areaUnit}</span></span>
                <span className="text-xs text-gray-500">Used <span className="font-bold text-amber-600">{usedArea} {areaUnit}</span></span>
                <span className="text-xs text-gray-500">Remaining <span className={`font-bold ${remainingArea <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{remainingArea} {areaUnit}</span></span>
                {remainingArea > 0 && enteredArea > 0 && (
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${areaExceeds ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (enteredArea / totalArea) * 100)}%` }} />
                  </div>
                )}
                {remainingArea <= 0 && <span className="text-xs text-red-600 font-medium">All area allocated</span>}
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          {/* 4-column field grid */}
          <div className="grid grid-cols-4 gap-4">
            {/* Row 1: identifiers */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Type</label>
              <select value={unit.type} onChange={set('type')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition">
                {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Plot No</label>
              <input type="text" value={unit.plot_no} onChange={set('plot_no')} placeholder="e.g. P-01"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">SL No</label>
              <input type="text" value={unit.sl_no} onChange={set('sl_no')} placeholder="Survey / Serial no"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Location</label>
              <input type="text" value={unit.location} onChange={set('location')} placeholder="Location / area"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />
            </div>

            {/* Row 2: area measurement */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Front Area</label>
              <input type="number" value={unit.front_area} onChange={set('front_area')} placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Front Unit</label>
              <select value={unit.front_area_details} onChange={set('front_area_details')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition">
                <option value="">— Select —</option>
                {AREA_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Back Area</label>
              <input type="number" value={unit.back_area} onChange={set('back_area')} placeholder="0"
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none transition placeholder:text-gray-300 ${areaExceeds ? 'border-red-400 focus:border-red-400 ring-1 ring-red-200' : 'border-gray-200 focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30'}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Back Unit</label>
              <select value={unit.back_area_details} onChange={set('back_area_details')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition">
                <option value="">— Select —</option>
                {AREA_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Row 3: rate + computed total + date */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Plot Rate (₹ per {unit.front_area_details || 'unit'}) <span className="text-red-500">*</span>
                {purchase?.rate && <span className="ml-1 text-gray-400 font-normal">— purchase: ₹{Number(purchase.rate).toLocaleString('en-IN')}</span>}
              </label>
              <input type="number" value={unit.rate} onChange={set('rate')} placeholder={purchase?.rate ? String(purchase.rate) : '0'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Total Area
                {remainingArea > 0 && <span className="ml-1 text-gray-400 font-normal">(rem: {remainingArea} {areaUnit})</span>}
              </label>
              <div className={`w-full border rounded-lg px-3 py-2 text-sm font-semibold ${areaExceeds ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-100 bg-gray-50 text-gray-600'}`}>
                {enteredArea > 0 ? `${enteredArea} ${unit.front_area_details || ''}` : <span className="font-normal text-gray-300">Front × Back ÷ 9</span>}
              </div>
              {areaExceeds && <p className="text-xs text-red-500 mt-1">Exceeds by {(enteredArea - remainingArea).toFixed(4)}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Created Date</label>
              <div className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50">
                {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/60">
          <button onClick={onClose} disabled={saving}
            className="text-sm px-4 h-8 border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || areaExceeds || remainingArea <= 0}
            className="text-sm px-6 h-8 rounded-lg text-white font-semibold transition disabled:opacity-50" style={{ backgroundColor: '#875A7B' }}>
            {saving ? 'Saving…' : 'Add Unit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Unit modal ────────────────────────────────────────────────────────────
function EditUnitModal({ open, onClose, purchase, inventory = [], unitData, onSaved }) {
  const UNIT_EMPTY = { type: 'PLOT', sl_no: '', location: '', plot_no: '', front_area: '', front_area_details: '', back_area: '', back_area_details: '', rate: '' };
  const [unit,   setUnit]   = useState(UNIT_EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const totalArea     = Number(purchase?.purchased_area || 0);
  // Exclude this unit's own area from usedArea so it doesn't count against itself
  const usedArea      = inventory.reduce((s, inv) => s + (inv.id !== unitData?.id ? Number(inv.area || 0) : 0), 0);
  const remainingArea = parseFloat((totalArea - usedArea).toFixed(4));
  const areaUnit      = purchase?.purchased_area_details || '';
  const fa            = parseFloat(unit.front_area) || 0;
  const ba            = parseFloat(unit.back_area) || 0;
  const enteredArea   = fa && ba ? parseFloat((fa * (ba / 9)).toFixed(4)) : 0;
  const areaExceeds   = enteredArea > 0 && remainingArea > 0 && enteredArea > remainingArea;

  useEffect(() => {
    if (!open || !unitData) return;
    setError('');
    setUnit({
      type:               unitData.type               || 'PLOT',
      sl_no:              unitData.sl_no              || '',
      location:           unitData.location           || '',
      plot_no:            unitData.plot_no            || '',
      front_area:         unitData.front_area  != null ? String(unitData.front_area)  : '',
      front_area_details: unitData.front_area_details || '',
      back_area:          unitData.back_area   != null ? String(unitData.back_area)   : '',
      back_area_details:  unitData.back_area_details  || '',
      rate:               unitData.rate        != null ? String(unitData.rate)        : '',
    });
  }, [open, unitData]);

  if (!open) return null;

  const set = (key) => (e) => { setUnit(p => ({ ...p, [key]: e.target.value })); setError(''); };

  const handleSave = async () => {
    if (areaExceeds) {
      setError(`Computed area (${enteredArea} ${areaUnit}) exceeds remaining ${remainingArea} ${areaUnit}.`);
      return;
    }
    setSaving(true); setError('');
    try {
      await apiPut(`/inventory/${unitData.id}`, unit);
      onSaved();
    } catch (e) { setError(e.message || 'Failed to update unit'); }
    finally     { setSaving(false); }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Edit Inventory Unit</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="font-semibold text-[#875A7B]">{unitData?.inventory_code || `INV-${String(unitData?.id || '').padStart(4,'0')}`}</span>
              {unitData?.plot_no ? ` · Plot ${unitData.plot_no}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Area allocation banner */}
          {totalArea > 0 && (
            <div className={`rounded-lg border px-4 py-2.5 ${remainingArea <= 0 ? 'bg-red-50 border-red-200' : 'bg-[#875A7B]/5 border-[#875A7B]/20'}`}>
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Area</span>
                <span className="text-xs text-gray-500">Total <span className="font-bold text-gray-700">{totalArea} {areaUnit}</span></span>
                <span className="text-xs text-gray-500">Used <span className="font-bold text-amber-600">{usedArea} {areaUnit}</span></span>
                <span className="text-xs text-gray-500">Remaining <span className={`font-bold ${remainingArea <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{remainingArea} {areaUnit}</span></span>
                {remainingArea > 0 && enteredArea > 0 && (
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${areaExceeds ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (enteredArea / totalArea) * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <div className="grid grid-cols-4 gap-4">
            {/* Row 1 */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Type</label>
              <select value={unit.type} onChange={set('type')} className={inputCls}>
                {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Plot No</label>
              <input type="text" value={unit.plot_no} onChange={set('plot_no')} placeholder="e.g. P-01" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">SL No</label>
              <input type="text" value={unit.sl_no} onChange={set('sl_no')} placeholder="Survey / Serial no" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Location</label>
              <input type="text" value={unit.location} onChange={set('location')} placeholder="Location / area" className={inputCls} />
            </div>

            {/* Row 2 */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Front Area</label>
              <input type="number" value={unit.front_area} onChange={set('front_area')} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Front Unit</label>
              <select value={unit.front_area_details} onChange={set('front_area_details')} className={inputCls}>
                <option value="">— Select —</option>
                {AREA_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Back Area</label>
              <input type="number" value={unit.back_area} onChange={set('back_area')} placeholder="0"
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none transition placeholder:text-gray-300 ${areaExceeds ? 'border-red-400 focus:border-red-400 ring-1 ring-red-200' : 'border-gray-200 focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30'}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Back Unit</label>
              <select value={unit.back_area_details} onChange={set('back_area_details')} className={inputCls}>
                <option value="">— Select —</option>
                {AREA_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Row 3 */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Plot Rate (₹ per {unit.front_area_details || 'unit'})
                {purchase?.rate && <span className="ml-1 text-gray-400 font-normal">— purchase: ₹{Number(purchase.rate).toLocaleString('en-IN')}</span>}
              </label>
              <input type="number" value={unit.rate} onChange={set('rate')} placeholder={purchase?.rate ? String(purchase.rate) : '0'} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Total Area
                {remainingArea > 0 && <span className="ml-1 text-gray-400 font-normal">(rem: {remainingArea} {areaUnit})</span>}
              </label>
              <div className={`w-full border rounded-lg px-3 py-2 text-sm font-semibold ${areaExceeds ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-100 bg-gray-50 text-gray-600'}`}>
                {enteredArea > 0 ? `${enteredArea} ${unit.front_area_details || ''}` : <span className="font-normal text-gray-300">Front × Back ÷ 9</span>}
              </div>
              {areaExceeds && <p className="text-xs text-red-500 mt-1">Exceeds by {(enteredArea - remainingArea).toFixed(4)}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Inventory Code</label>
              <div className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm text-[#875A7B] font-mono font-semibold bg-gray-50">
                {unitData?.inventory_code || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/60">
          <button onClick={onClose} disabled={saving}
            className="text-sm px-4 h-8 border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || areaExceeds}
            className="text-sm px-6 h-8 rounded-lg text-white font-semibold transition disabled:opacity-50" style={{ backgroundColor: '#875A7B' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function PurchaseRecordPage() {
  useAuth();
  const router      = useRouter();
  const params      = useParams();
  const { can, me } = usePermissions();

  const [form,      setForm]      = useState(EMPTY);
  const [original,  setOriginal]  = useState(EMPTY);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');
  const [showDel,       setShowDel]       = useState(false);
  const [showAddUnit,   setShowAddUnit]   = useState(false);
  const [editingUnit,   setEditingUnit]   = useState(null);
  const [deletingUnit,  setDeletingUnit]  = useState(null);
  const [unitDeleting,  setUnitDeleting]  = useState(false);
  const [actMenu,       setActMenu]       = useState(false);
  const [totalInstPaid, setTotalInstPaid] = useState(0);

  const canEdit            = can('PURCHASE_EDIT')   || me?.is_system;
  const canDelete          = can('PURCHASE_DELETE') || me?.is_system;
  const canCreateInventory = can('INVENTORY_CREATE') || me?.is_system;
  const canEditInventory   = can('INVENTORY_EDIT')   || me?.is_system;
  const canDeleteInventory = can('INVENTORY_DELETE') || me?.is_system;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, instData] = await Promise.all([
        apiGet(`/purchases/${params.id}`),
        apiGet(`/purchases/${params.id}/installments`).catch(() => null),
      ]);
      const flat = {
        ...EMPTY, ...data,
        _purchase_broker: data.purchase_broker_name ? { name: data.purchase_broker_name } : null,
        _sell_broker:     data.sell_broker_name     ? { name: data.sell_broker_name }     : null,
        registration_date:    data.registration_date ? data.registration_date.split('T')[0] : '',
        purchased_area:       data.purchased_area       != null ? String(data.purchased_area)       : '',
        purchase_price:       data.purchase_price       != null ? String(data.purchase_price)       : '',
        global_rate:          data.global_rate          != null ? String(data.global_rate)          : '',
        rate:                 data.rate                 != null ? String(data.rate)                 : '',
        advance_paid:         data.advance_paid         != null ? String(data.advance_paid)         : '',
        brokerage:            data.brokerage            != null ? String(data.brokerage)            : '',
        extra_expenses:       data.extra_expenses       != null ? String(data.extra_expenses)       : '',
        registration_charges:                data.registration_charges                != null ? String(data.registration_charges)                : '',
        extra_income:                        data.extra_income                        != null ? String(data.extra_income)                        : '',
        against_registration_amount:         data.against_registration_amount         != null ? String(data.against_registration_amount)         : '',
        against_registration_received_date:  data.against_registration_received_date  ? data.against_registration_received_date.split('T')[0]   : '',
      };
      setForm(flat);
      setOriginal(flat);
      setInventory(data.inventory || []);
      if (instData) setTotalInstPaid(instData.total_paid || 0);
    } catch (e) { setError(e.message || 'Failed to load'); }
    finally     { setLoading(false); }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => { setForm(p => ({ ...p, [key]: e.target.value })); setError(''); };

  const handleEdit    = () => { setEditing(true); setSaved(false); setError(''); };
  const handleDiscard = () => { setForm(original); setEditing(false); setError(''); };
  const handleSave    = async () => {
    setSaving(true); setError('');
    try {
      await apiPut(`/purchases/${params.id}`, form);
      setOriginal(form); setEditing(false); setSaved(true);
      await load();
    } catch (e) { setError(e.message || 'Failed to save'); }
    finally     { setSaving(false); }
  };
  const handleDeleteUnit = async () => {
    setUnitDeleting(true);
    try { await apiDelete(`/inventory/${deletingUnit.id}`); setDeletingUnit(null); load(); }
    catch (e) { setError(e.message); }
    finally { setUnitDeleting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await apiDelete(`/purchases/${params.id}`); router.push('/dashboard/purchases'); }
    catch (e) { setError(e.message); setDeleting(false); setShowDel(false); }
  };

  const c        = computed(form);
  const stageIdx = getStageIndex(form, c);
  const title    = form.plot_no ? `Plot ${form.plot_no}` : form.sl_no ? `SL ${form.sl_no}` : `Purchase #${params.id}`;
  // Include paid installments in balance, progress, and total cost
  const effectiveBalance  = Math.max(0, c.balance_to_pay - totalInstPaid);
  const effectivePct      = c.total_amount > 0 ? Math.min(100, ((c.total_amount - effectiveBalance) / c.total_amount) * 100) : 0;
  const effectiveTotalCost = c.total_cost + totalInstPaid;
  const pct      = effectivePct;
  const barColor = pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#875A7B';

  const INV_STATUS = {
    AVAILABLE:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    RESERVED:   'bg-amber-50   text-amber-700   ring-1 ring-amber-200',
    SOLD:       'bg-blue-50    text-blue-700    ring-1 ring-blue-200',
    REGISTERED: 'bg-violet-50  text-violet-700  ring-1 ring-violet-200',
  };
  const INV_TYPE = {
    PLOT: 'bg-violet-50 text-violet-700',
    SHOP: 'bg-blue-50 text-blue-700',
    LAND: 'bg-emerald-50 text-emerald-700',
  };

  // ── Skeleton ──
  if (loading) return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center gap-3">
        {[24, 16, 32].map((w, i) => <div key={i} className={`h-4 w-${w} bg-gray-100 rounded animate-pulse`} />)}
      </div>
      <div className="flex-1 p-4 space-y-4 max-w-7xl mx-auto w-full">
        <div className="h-28 bg-white rounded-xl border border-gray-200 animate-pulse" />
        <div className="grid grid-cols-5 gap-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />)}</div>
        <div className="grid grid-cols-3 gap-4">{Array(6).fill(0).map((_, i) => <div key={i} className="h-32 bg-white rounded-xl border animate-pulse" />)}</div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap">
          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
            <Link href="/dashboard/purchases" className="text-[#875A7B] hover:text-[#6d4a63] font-medium transition shrink-0">Purchases</Link>
            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            {form.purchase_code && (
              <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-2 py-0.5 rounded shrink-0 mr-1">{form.purchase_code}</span>
            )}
            <span className="text-gray-800 font-semibold truncate">{title}</span>
          </nav>
          <div className="hidden lg:block"><StatusPipeline current={stageIdx} /></div>
          {saved && !editing && (
            <span className="text-xs text-emerald-600 flex items-center gap-1 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved
            </span>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={handleDiscard} disabled={saving}
                  className="h-8 px-4 text-sm border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">Discard</button>
                <button onClick={handleSave} disabled={saving}
                  className="h-8 px-5 text-sm rounded text-white font-medium transition disabled:opacity-60" style={{ backgroundColor: '#875A7B' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button onClick={handleEdit}
                    className="h-8 px-4 text-sm border border-[#875A7B] rounded text-[#875A7B] hover:bg-[#875A7B]/5 transition font-medium">Edit</button>
                )}
                <div className="relative">
                  <button onClick={() => setActMenu(v => !v)}
                    className="h-8 px-3 text-sm border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition flex items-center gap-1">
                    Action <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {actMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
                      <Link href="/dashboard/purchases/new" onClick={() => setActMenu(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">New Purchase</Link>
                      {canDelete && <>
                        <div className="border-t border-gray-100 my-1" />
                        <button onClick={() => { setActMenu(false); setShowDel(true); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">Delete</button>
                      </>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
            <button onClick={() => setError('')} className="ml-auto"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* ── Identity header ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex items-center gap-4">
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#875A7B' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                {form.location && <span className="text-sm text-gray-400 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{form.location}</span>}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ring-1 ${TYPE_RING[form.type] || TYPE_RING.PLOT}`}>{form.type}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ${form.purchase_category === 'DIVIDED' ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-gray-50 text-gray-500 ring-gray-200'}`}>
                  {form.purchase_category === 'DIVIDED' ? 'Divided' : 'Single'}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ring-1 ${form.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${form.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  {form.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </span>
                {editing && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">Editing</span>}
              </div>
            </div>
            {/* Mobile pipeline */}
            <div className="hidden sm:flex lg:hidden"><StatusPipeline current={stageIdx} /></div>
          </div>

          {/* ── KPI stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Amount',  value: fmtINR(c.total_amount),   sub: 'Rate × Area',      color: 'text-gray-900',    bg: 'bg-white' },
              { label: 'Advance Paid',  value: fmtINR(c.total_amount - c.balance_to_pay), sub: 'Amount paid',  color: 'text-[#875A7B]', bg: 'bg-white' },
              { label: 'Balance to Pay',value: fmtINR(effectiveBalance), sub: 'After advance & instalments', color: 'text-amber-600', bg: 'bg-white' },
              { label: '% Paid',        value: `${pct.toFixed(1)}%`,     sub: 'Payment progress',  color: pct >= 100 ? 'text-emerald-600' : 'text-gray-900', bg: 'bg-white' },
              { label: 'Total Cost',    value: fmtINR(effectiveTotalCost), sub: 'Adv+Inst+Brok+Exp−Inc', color: 'text-slate-700', bg: 'bg-white' },
            ].map(({ label, value, sub, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl border border-gray-200 shadow-sm px-4 py-3`}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                <p className={`text-lg font-bold ${color} leading-tight`}>{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* ── Payment progress bar ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-gray-500 uppercase tracking-wider">Payment Progress</span>
              <span className="font-bold" style={{ color: barColor }}>{pct.toFixed(1)}% paid</span>
            </div>
            <div className="bg-gray-100 rounded-full h-2.5">
              <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
              <span>₹0</span>
              <span className="text-amber-600 font-medium">{fmtINR(effectiveBalance)} remaining</span>
              <span>{fmtINR(c.total_amount)}</span>
            </div>
          </div>

          {/* ── Main card grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

            {/* ── Row 1: Property Info | Area & Rate | Payment ── */}

            {/* Property Information */}
            <Card title="Property Information">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                {form.purchase_code && (
                  <div className="col-span-full">
                    <Label>Purchase Code</Label>
                    <p className="text-sm font-bold font-mono text-[#875A7B]">{form.purchase_code}</p>
                  </div>
                )}
                <FSelect label="Category" value={form.purchase_category} onChange={set('purchase_category')} readOnly={!editing}>
                  <option value="SINGLE">Single</option>
                  <option value="DIVIDED">Divided</option>
                </FSelect>
                <FSelect label="Type" value={form.type} onChange={set('type')} readOnly={!editing}>
                  <option value="PLOT">Plot</option>
                  <option value="LAND">Land</option>
                  <option value="SHOP">Shop</option>
                  <option value="FLAT">Flat</option>
                </FSelect>
                <FSelect label="Status" value={form.status} onChange={set('status')} readOnly={!editing}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </FSelect>
                <FInput label="SL No" value={form.sl_no} onChange={set('sl_no')} placeholder="e.g. SL-001" readOnly={!editing} />
                <div className="col-span-full">
                  <FInput label="Location" value={form.location} onChange={set('location')} placeholder="City / Area / Survey No" readOnly={!editing} />
                </div>
              </div>
            </Card>

            {/* Area & Rate */}
            <Card title="Area &amp; Rate">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <FInput label="Purchased Area" value={form.purchased_area} onChange={set('purchased_area')} type="number" placeholder="0" readOnly={!editing} />
                <FSelect label="Area Unit" value={form.purchased_area_details} onChange={set('purchased_area_details')} readOnly={!editing}>
                  <option value="gaj">Gaj</option>
                  <option value="acres">Acres</option>
                  <option value="bigha">Bigha</option>
                </FSelect>
                <FInput label="Plot No" value={form.plot_no} onChange={set('plot_no')} placeholder="e.g. P-42" readOnly={!editing} />
                <FInput label="Purchase Price (₹)" value={form.purchase_price} onChange={set('purchase_price')} type="number" placeholder="0" readOnly={!editing} />
                <FInput label="Global Rate (divisor)" value={form.global_rate} onChange={set('global_rate')} type="number" placeholder="0" readOnly={!editing} />
                <div>
                  <Label>Rate (per unit) = Purchase Price ÷ Global Rate</Label>
                  <div className="min-h-[32px] px-3 py-1.5 bg-amber-50 border border-amber-200 rounded text-sm font-semibold text-amber-700 tabular-nums">
                    {c.rate ? fmtINR(c.rate) : <span className="font-normal text-gray-300">—</span>}
                  </div>
                </div>
                <div className="col-span-full">
                  <FInput label="Rate Details" value={form.rate_details} onChange={set('rate_details')} placeholder="Per sq.ft / sq.yd" readOnly={!editing} />
                </div>
                <div className="col-span-full rounded-lg border px-4 py-3" style={{ backgroundColor: '#875A7B12', borderColor: '#875A7B30' }}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Amount</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: '#875A7B' }}>{fmtINR(c.total_amount)}</p>
                  {!editing && form.total_amount_details && <p className="text-xs text-gray-400 mt-0.5">{form.total_amount_details}</p>}
                </div>
                {editing && (
                  <div className="col-span-full">
                    <FInput label="Total Amount Notes" value={form.total_amount_details} onChange={set('total_amount_details')} placeholder="Notes or breakdown" readOnly={false} />
                  </div>
                )}
              </div>
            </Card>

            {/* Payment */}
            <Card title="Payment">
              <div className="space-y-4">
                <FInput label="Advance Paid (₹)" value={form.advance_paid} onChange={set('advance_paid')} type="number" placeholder="0" readOnly={!editing} />
                <FTextarea label="Advance Payment Details" value={form.advance_payment_details} onChange={set('advance_payment_details')} placeholder="Date, mode, cheque no..." rows={2} readOnly={!editing} />
                <div className="space-y-2 py-1">
                  <label className={`flex items-center gap-2.5 select-none ${!editing ? 'pointer-events-none' : 'cursor-pointer'}`}>
                    <input type="checkbox" checked={!!form.remaining_paid}
                      onChange={(e) => setForm(p => ({ ...p, remaining_paid: e.target.checked }))}
                      disabled={!editing} className="w-4 h-4 rounded border-gray-300 accent-[#875A7B]" />
                    <span className="text-sm font-medium text-gray-700">Pay Remaining in Installments</span>
                  </label>
                  <label className={`flex items-center gap-2.5 select-none ${!editing ? 'pointer-events-none' : 'cursor-pointer'}`}>
                    <input type="checkbox" checked={!!form.against_registration_paid}
                      onChange={(e) => setForm(p => ({ ...p, against_registration_paid: e.target.checked }))}
                      disabled={!editing} className="w-4 h-4 rounded border-gray-300 accent-[#875A7B]" />
                    <span className="text-sm font-medium text-gray-700">Against Registration</span>
                  </label>
                </div>

                {/* Against Registration payment confirmation */}
                {form.against_registration_paid && (
                  <div className={`rounded-xl border-2 p-4 space-y-3 ${form.against_registration_received ? 'border-emerald-300 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Registration Payment</span>
                      {form.against_registration_received
                        ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                            Received
                          </span>
                        : <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Pending</span>
                      }
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FInput label="Amount (₹)" value={form.against_registration_amount}
                        onChange={set('against_registration_amount')} type="number" placeholder="0" readOnly={!editing} />
                      <FInput label="Received Date" value={form.against_registration_received_date}
                        onChange={set('against_registration_received_date')} type="date" readOnly={!editing} />
                    </div>
                    <label className={`flex items-center gap-2.5 select-none ${!editing ? 'pointer-events-none' : 'cursor-pointer'}`}>
                      <input type="checkbox" checked={!!form.against_registration_received}
                        onChange={(e) => setForm(p => ({ ...p, against_registration_received: e.target.checked }))}
                        disabled={!editing} className="w-4 h-4 rounded border-gray-300 accent-emerald-600" />
                      <span className={`text-sm font-semibold ${form.against_registration_received ? 'text-emerald-700' : 'text-gray-500'}`}>
                        Payment Received
                      </span>
                    </label>
                  </div>
                )}

                <FTextarea label="Instalment Details" value={form.instalment_details} onChange={set('instalment_details')} placeholder="EMI schedule, dates, amounts..." rows={2} readOnly={!editing} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Balance</p>
                    <p className="text-sm font-bold text-amber-700">{fmtINR(effectiveBalance)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">% To Pay</p>
                    <p className="text-sm font-bold text-gray-700">{(100 - pct).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Row 2: Seller & Broker | Additional Costs | Registration ── */}

            {/* Seller & Broker */}
            <Card title="Seller &amp; Broker">
              <div className="space-y-4">
                <FTextarea label="Seller Details" value={form.seller_details} onChange={set('seller_details')} placeholder="Name, address, contact..." rows={2} readOnly={!editing} />
                <div>
                  <Label>Purchase Broker Name</Label>
                  {!editing ? (
                    <Val>{form.purchase_broker_name}</Val>
                  ) : (
                    <BrokerPicker
                      value={form._purchase_broker}
                      onPick={(b) => { setForm(p => ({ ...p, purchase_broker_name: b.name, _purchase_broker: b, purchase_broker_details: [b.phone, b.email].filter(Boolean).join(' · ') })); setError(''); }}
                      onClear={() => { setForm(p => ({ ...p, purchase_broker_name: '', _purchase_broker: null, purchase_broker_details: '' })); setError(''); }}
                      excludeId={form._sell_broker?.id}
                    />
                  )}
                </div>
                <FInput label="Purchase Broker Details" value={form.purchase_broker_details} onChange={set('purchase_broker_details')} placeholder="Contact / commission" readOnly={!editing} />
                <div>
                  <Label>Sell Broker Name</Label>
                  {!editing ? (
                    <Val>{form.sell_broker_name}</Val>
                  ) : (
                    <BrokerPicker
                      value={form._sell_broker}
                      onPick={(b) => { setForm(p => ({ ...p, sell_broker_name: b.name, _sell_broker: b, sell_broker_details: [b.phone, b.email].filter(Boolean).join(' · ') })); setError(''); }}
                      onClear={() => { setForm(p => ({ ...p, sell_broker_name: '', _sell_broker: null, sell_broker_details: '' })); setError(''); }}
                      excludeId={form._purchase_broker?.id}
                    />
                  )}
                </div>
                <FInput label="Sell Broker Details" value={form.sell_broker_details} onChange={set('sell_broker_details')} placeholder="Contact / commission" readOnly={!editing} />
              </div>
            </Card>

            {/* Additional Costs */}
            <Card title="Additional Costs">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <FInput label="Brokerage (₹)" value={form.brokerage} onChange={set('brokerage')} type="number" placeholder="0" readOnly={!editing} />
                <FInput label="Brokerage Details" value={form.brokerage_details} onChange={set('brokerage_details')} placeholder="Notes" readOnly={!editing} />
                <FInput label="Extra Expenses (₹)" value={form.extra_expenses} onChange={set('extra_expenses')} type="number" placeholder="0" readOnly={!editing} />
                <FInput label="Extra Expenses Details" value={form.extra_expenses_details} onChange={set('extra_expenses_details')} placeholder="Notes" readOnly={!editing} />
                <FInput label="Reg. Charges (₹)" value={form.registration_charges} onChange={set('registration_charges')} type="number" placeholder="0" readOnly={!editing} />
                <FInput label="Reg. Charges Details" value={form.registration_charges_details} onChange={set('registration_charges_details')} placeholder="Notes" readOnly={!editing} />
                <FInput label="Extra Income (₹)" value={form.extra_income} onChange={set('extra_income')} type="number" placeholder="0" readOnly={!editing} />
                <FInput label="Extra Income Details" value={form.extra_income_details} onChange={set('extra_income_details')} placeholder="Notes" readOnly={!editing} />
              </div>
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Cost</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Adv + Inst + Brok + Exp + Reg − Income</p>
                </div>
                <p className="text-xl font-bold text-amber-700">{fmtINR(effectiveTotalCost)}</p>
              </div>
            </Card>

            {/* Registration + Notes stacked */}
            <div className="space-y-4">
              <Card title="Registration">
                <div className="space-y-4">
                  <FInput label="Registration Date (Target)" value={form.registration_date} onChange={set('registration_date')} type="date" readOnly={!editing} />
                  <FTextarea label="Registration Details" value={form.registration_details} onChange={set('registration_details')} placeholder="Survey no, document no..." rows={2} readOnly={!editing} />
                  <label className={`flex items-center gap-2.5 select-none ${!editing ? 'pointer-events-none' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={!!form.registration_completed}
                      onChange={(e) => setForm(p => ({ ...p, registration_completed: e.target.checked }))}
                      disabled={!editing}
                      className="w-4 h-4 rounded border-gray-300 accent-emerald-600"
                    />
                    <span className={`text-sm font-semibold ${form.registration_completed ? 'text-emerald-700' : 'text-gray-500'}`}>
                      Registration Completed
                    </span>
                  </label>
                </div>
              </Card>
              <Card title="Notes">
                <FTextarea label="Other Details" value={form.other_details} onChange={set('other_details')} placeholder="Any additional notes..." rows={4} readOnly={!editing} />
              </Card>
            </div>

            {/* ── Row 3: Installment Schedule (full width, conditional) ── */}
            {form.remaining_paid && (
              <div className="lg:col-span-3">
                <PurchaseInstallmentPanel purchaseId={params.id} canEdit={canEdit} onTotalPaidChange={setTotalInstPaid} />
              </div>
            )}

          </div>

          {/* ── Inventory Units ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Inventory Units</p>
                {inventory.length > 0 && (
                  <span className="bg-[#875A7B]/10 text-[#875A7B] text-xs font-bold px-2 py-0.5 rounded-full">{inventory.length}</span>
                )}
              </div>
              {canCreateInventory && form.purchase_category === 'DIVIDED' && (
                <button onClick={() => setShowAddUnit(true)}
                  className="h-7 px-3 text-xs border border-[#875A7B] rounded text-[#875A7B] hover:bg-[#875A7B]/5 transition font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Unit
                </button>
              )}
            </div>

            {inventory.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 font-medium">No inventory units linked</p>
                {form.purchase_category === 'SINGLE' ? (
                  <p className="text-xs text-gray-400 mt-1">The unit will be auto-created when this purchase is saved.</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 mt-1">Add sub-units for this divided purchase.</p>
                    {canCreateInventory && (
                      <button onClick={() => setShowAddUnit(true)}
                        className="mt-3 text-sm text-[#875A7B] hover:underline">+ Add first unit</button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      {['Unit', 'Plot No', 'SL No', 'Location', 'Area', 'Plot Rate', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {inventory.map(inv => (
                      <tr key={inv.id} onClick={() => router.push(`/dashboard/inventory/${inv.id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition">
                        <td className="px-4 py-3">
                          <span className="block font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-1.5 py-0.5 rounded w-fit mb-1">
                            {inv.inventory_code || `INV-${String(inv.id).padStart(4,'0')}`}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${INV_TYPE[inv.type] || 'bg-gray-100 text-gray-600'}`}>
                            {inv.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{inv.plot_no || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{inv.sl_no || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px]">
                          <span className="truncate block">{inv.location || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {inv.area
                            ? `${fmtNum(inv.area)}${inv.area_unit ? ` ${inv.area_unit}` : ''}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {inv.rate != null ? <span className="font-semibold text-[#875A7B]">₹{fmtNum(inv.rate)}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${INV_STATUS[inv.status] || INV_STATUS.AVAILABLE}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {inv.sales?.length > 0 ? (
                            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded whitespace-nowrap">Sale exists</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {canEditInventory && (
                                <button onClick={() => setEditingUnit(inv)}
                                  className="h-7 px-2.5 text-xs border border-gray-200 rounded text-gray-500 hover:border-[#875A7B] hover:text-[#875A7B] transition flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  Edit
                                </button>
                              )}
                              {canDeleteInventory && (
                                <button onClick={() => setDeletingUnit(inv)}
                                  className="h-7 px-2.5 text-xs border border-gray-200 rounded text-gray-500 hover:border-red-400 hover:text-red-500 transition flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Sticky edit save bar ── */}
          {editing && (
            <div className="sticky bottom-4 flex justify-center">
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 px-5 py-3 flex items-center gap-4">
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Unsaved changes
                </span>
                <button onClick={handleDiscard} disabled={saving}
                  className="text-sm px-4 h-8 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">Discard</button>
                <button onClick={handleSave} disabled={saving}
                  className="text-sm px-6 h-8 rounded text-white font-semibold transition disabled:opacity-60" style={{ backgroundColor: '#875A7B' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      <DeleteModal open={showDel} onClose={() => setShowDel(false)} onConfirm={handleDelete} deleting={deleting} />

      <AddUnitModal
        open={showAddUnit}
        onClose={() => setShowAddUnit(false)}
        purchase={{ ...form, id: Number(params.id) }}
        inventory={inventory}
        onCreated={() => { setShowAddUnit(false); load(); }}
      />

      <EditUnitModal
        open={!!editingUnit}
        onClose={() => setEditingUnit(null)}
        purchase={{ ...form, id: Number(params.id) }}
        inventory={inventory}
        unitData={editingUnit}
        onSaved={() => { setEditingUnit(null); load(); }}
      />

      <DeleteUnitModal
        open={!!deletingUnit}
        onClose={() => setDeletingUnit(null)}
        onConfirm={handleDeleteUnit}
        deleting={unitDeleting}
        unitData={deletingUnit}
      />
    </div>
  );
}
