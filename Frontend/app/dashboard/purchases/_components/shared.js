'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api';

// Shared atoms, constants, and the computed-formula function for Purchase forms.
// Used by both new/page.js and [id]/page.js.

export const EMPTY = {
  purchase_code: '',        purchase_category: 'SINGLE',
  type: 'PLOT', sl_no: '', location: '',
  purchase_broker_name: '', purchase_broker_details: '',
  _purchase_broker: null,
  sell_broker_name: '',     sell_broker_details: '',
  _sell_broker: null,
  seller_details: '',       plot_no: '',
  purchased_area: '',       purchased_area_details: 'gaj',
  purchase_price: '',       global_rate: '',
  rate: '',                 rate_details: '',
  total_amount_details: '',
  advance_paid: '',         advance_payment_details: '',
  instalment_details: '',
  remaining_paid: false,
  registration_date: '',    registration_completed: false,  registration_details: '',
  brokerage: '',            brokerage_details: '',
  extra_expenses: '',       extra_expenses_details: '',
  registration_charges: '', registration_charges_details: '',
  extra_income: '',         extra_income_details: '',
  other_details: '',        status: 'ACTIVE',
};

export function computed(f) {
  const area = parseFloat(f.purchased_area)        || 0;
  const pp   = parseFloat(f.purchase_price)        || 0;
  const gr   = parseFloat(f.global_rate)           || 0;
  const rate = (pp > 0 && gr > 0) ? pp / gr : (parseFloat(f.rate) || 0);
  const adv  = parseFloat(f.advance_paid)          || 0;
  const brok = parseFloat(f.brokerage)             || 0;
  const ext  = parseFloat(f.extra_expenses)        || 0;
  const reg  = parseFloat(f.registration_charges)  || 0;
  const inc  = parseFloat(f.extra_income)          || 0;
  const total = rate * area;
  const bal   = total - adv;
  const pct   = total > 0 ? (adv / total) * 100 : 0;
  return {
    rate,
    total_amount:      total,
    balance_to_pay:    bal,
    percentage_paid:   pct,
    percentage_to_pay: 100 - pct,
    total_cost:        adv + brok + ext + reg - inc,
  };
}

export function getStageIndex(form, c, instPaid = 0) {
  const total  = c.total_amount || 0;
  const effBal = Math.max(0, c.balance_to_pay - instPaid);
  const effPct = total > 0 ? Math.min(100, ((total - effBal) / total) * 100) : c.percentage_paid;
  if (form.registration_completed && effPct >= 100) return 3;
  if (form.registration_completed) return 2;
  if (effPct > 0) return 1;
  return 0;
}

export const STAGES = ['Draft', 'In Progress', 'Registered', 'Completed'];

export const fmtINR  = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtPct  = (n) => `${Number(n || 0).toFixed(1)}%`;
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtNum  = (n) => Number(n || 0).toLocaleString('en-IN');

// ─── Type badge styles ─────────────────────────────────────────────────────────
export const TYPE_RING = {
  LAND: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  SHOP: 'bg-blue-50    text-blue-700    ring-blue-200',
  PLOT: 'bg-violet-50  text-violet-700  ring-violet-200',
  FLAT: 'bg-orange-50  text-orange-700  ring-orange-200',
};

// ─── Atoms ────────────────────────────────────────────────────────────────────
export function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-medium text-gray-500 mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

export function FInput({ value, onChange, type = 'text', placeholder, readOnly, autoFocus }) {
  if (readOnly) {
    return (
      <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">
        {value || <span className="text-gray-300">—</span>}
      </div>
    );
  }
  return (
    <input
      autoFocus={autoFocus}
      type={type}
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300"
    />
  );
}

export function FTextarea({ value, onChange, placeholder, rows = 2, readOnly }) {
  if (readOnly) {
    return (
      <div className="min-h-[60px] px-3 py-2 bg-gray-50 rounded border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
        {value || <span className="text-gray-300">—</span>}
      </div>
    );
  }
  return (
    <textarea
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition resize-none placeholder:text-gray-300"
    />
  );
}

export function FSelect({ value, onChange, children, readOnly }) {
  if (readOnly) {
    return (
      <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">
        {value || '—'}
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition"
    >
      {children}
    </select>
  );
}

export function ComputedBox({ label, value, accent }) {
  return (
    <div className={`rounded border px-3 py-2.5 ${accent ? 'bg-[#875A7B]/5 border-[#875A7B]/20' : 'bg-amber-50/60 border-amber-100'}`}>
      <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${accent ? 'text-[#875A7B]' : 'text-amber-700'}`}>{value}</p>
    </div>
  );
}

export function SectionDivider({ title }) {
  return (
    <div className="col-span-full pt-3 pb-1 border-b border-gray-200 flex items-center gap-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
    </div>
  );
}

export function PayBar({ pct }) {
  const p = Math.min(100, Math.max(0, pct || 0));
  const color = p >= 100 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-400' : 'bg-[#875A7B]';
  return (
    <div className="col-span-full">
      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
        <span>Payment progress</span>
        <span className={`font-semibold ${p >= 100 ? 'text-emerald-600' : p >= 50 ? 'text-amber-600' : 'text-[#875A7B]'}`}>
          {p.toFixed(1)}%
        </span>
      </div>
      <div className="bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-300`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

export function StatusPipeline({ current }) {
  return (
    <div className="flex items-center">
      {STAGES.map((s, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex items-center">
            {i > 0 && (
              <div className={`h-px w-6 ${done || active ? 'bg-[#875A7B]' : 'bg-gray-200'}`} />
            )}
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              active ? 'bg-[#875A7B] text-white border-[#875A7B] shadow-sm' :
              done   ? 'bg-[#875A7B]/10 text-[#875A7B] border-[#875A7B]/20' :
                       'bg-white text-gray-400 border-gray-200'
            }`}>
              {done && (
                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Broker picker ────────────────────────────────────────────────────────────
function BasePicker({ value, onPick, onClear, label, endpoint, placeholder, renderSelected, renderItem, allowCreate, onCreated, excludeId }) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [items,   setItems]   = useState([]);
  const [loading, setLoad]    = useState(false);
  const [adding,  setAdding]  = useState(false);
  const [newForm, setNewForm] = useState({ name: '', phone: '', email: '' });
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const ref = useRef(null);
  const tmr = useRef(null);

  const fetchItems = useCallback(async (q) => {
    setLoad(true);
    try {
      const params = new URLSearchParams({ search: q, limit: 8 });
      if (excludeId) params.set('exclude_id', excludeId);
      const data = await apiGet(`/lookup/${endpoint}?${params}`);
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally  { setLoad(false); }
  }, [endpoint, excludeId]);

  useEffect(() => { if (open) fetchItems(''); }, [open, fetchItems]);

  useEffect(() => {
    clearTimeout(tmr.current);
    if (!open) return;
    tmr.current = setTimeout(() => fetchItems(search), 300);
    return () => clearTimeout(tmr.current);
  }, [search, open, fetchItems]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAdding(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const openAdd = () => { setAdding(true); setNewForm({ name: search, phone: '', email: '' }); setSaveErr(''); };
  const cancelAdd = () => { setAdding(false); setSaveErr(''); };

  const handleSave = async () => {
    if (!newForm.name.trim()) { setSaveErr('Name is required'); return; }
    setSaving(true); setSaveErr('');
    try {
      const created = await apiPost('/brokers', newForm);
      onPick(created);
      onCreated?.(created);
      setOpen(false); setAdding(false); setSearch('');
    } catch (e) { setSaveErr(e.message || 'Failed to create'); }
    finally { setSaving(false); }
  };

  return (
    <div className="relative" ref={ref}>
      {value ? (
        <div className="flex items-center gap-2 border border-gray-200 rounded px-3 py-[7px] bg-white">
          <span className="text-sm text-gray-800 flex-1">{renderSelected ? renderSelected(value) : String(value)}</span>
          <button type="button" onClick={() => { onClear?.(); setOpen(false); }} className="text-gray-300 hover:text-gray-500 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-2 border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-400 bg-white hover:border-[#875A7B]/50 transition text-left">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          {placeholder || `Search ${label}…`}
        </button>
      )}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {!adding ? (
            <>
              <div className="p-2 border-b border-gray-100">
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${label}…`}
                  className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#875A7B]" />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {loading ? (
                  <div className="p-3 text-center text-xs text-gray-400">Loading…</div>
                ) : items.length === 0 ? (
                  <div className="p-3 text-center text-xs text-gray-400">No results</div>
                ) : items.map(item => (
                  <button key={item.id} type="button" onClick={() => { onPick(item); setOpen(false); setSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#875A7B]/5 transition border-b border-gray-50 last:border-0">
                    {renderItem(item)}
                  </button>
                ))}
              </div>
              {allowCreate && (
                <div className="border-t border-gray-100">
                  <button type="button" onClick={openAdd}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#875A7B] hover:bg-[#875A7B]/5 transition font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add new broker
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">New Broker</p>
              <input autoFocus value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Name *"
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#875A7B]" />
              <input value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Phone"
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#875A7B]" />
              <input value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Email"
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#875A7B]" />
              {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={cancelAdd}
                  className="flex-1 text-sm border border-gray-200 rounded py-1.5 text-gray-500 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="flex-1 text-sm rounded py-1.5 text-white font-medium transition disabled:opacity-60"
                  style={{ backgroundColor: '#875A7B' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BrokerPicker({ value, onPick, onClear, excludeId }) {
  return (
    <BasePicker
      value={value?.name ? value : null}
      onPick={onPick} onClear={onClear}
      label="Broker" endpoint="brokers" placeholder="Search broker…"
      allowCreate excludeId={excludeId}
      renderSelected={v => v ? `${v.broker_code || ''} ${v.name || ''} ${v.phone ? `· ${v.phone}` : ''}`.trim() : ''}
      renderItem={b => (
        <div>
          <div className="font-medium text-gray-800 flex items-center gap-1.5">
            <span className="font-mono text-xs text-[#875A7B]">{b.broker_code}</span>
            <span>{b.name}</span>
          </div>
          {b.phone && <div className="text-xs text-gray-400">{b.phone}</div>}
        </div>
      )}
    />
  );
}
