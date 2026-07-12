'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api';

// ── Constants ──────────────────────────────────────────────────────────────────
export const SALE_TYPES       = ['PLOT', 'SHOP', 'LAND', 'FLAT', 'PLOT_WIRE', 'SHOP_WIRE'];
export const POSSESSION_STATES = ['PENDING', 'SYMBOLIC', 'PHYSICAL'];

export const EMPTY = {
  inventory_id: '', customer_id: '', broker_id: '',
  _inventory: null, _customer: null, _broker: null,
  sale_date: '', type: '', sl_no: '', details: '',
  broker_name: '', broker_details: '',
  front_area: '', front_area_details: '',
  back_area: '', back_area_details: '',
  total_area_details: '', plot_rate: '', selling_rate: '',
  booking_amount: '', booking_details: '',
  advance_payment: '', advance_payment_details: '',
  balance_amount_details: '',
  registration_charges: '', registration_paid: '', registration_details: '',
  intkaal_charges: '', intkaal_paid: '', intkaal_details: '',
  water_connection_charges: '', water_connection_paid: '', water_connection_details: '',
  electricity_meter_charges: '', electricity_meter_paid: '', electricity_meter_details: '',
  payment_due_date: '', registration_area: '',
  discount: '', discount_details: '',
  brokerage: '', brokerage_details: '',
  incentive: '', incentive_details: '',
  extra_income: '', extra_income_details: '',
  intkaal_number: '', date_of_registration: '',
  vasika: '', possession: 'PENDING', possession_detail: '',
  other_details: '', status: 'ACTIVE', booking_in_received: true,
  registration_completed: false,
};

// ── Computed fields (live in form) ─────────────────────────────────────────────
export function computed(f) {
  const fa = parseFloat(f.front_area)  || 0;
  const ba = parseFloat(f.back_area)   || 0;
  const pr = parseFloat(f.plot_rate)   || 0;
  const sr = parseFloat(f.selling_rate) || 0;
  const ap = parseFloat(f.advance_payment) || 0;
  const bk = parseFloat(f.booking_amount)  || 0;

  const total_area   = fa > 0 && ba > 0 ? fa * (ba / 9) : 0;
  const total_value  = total_area && pr ? total_area * pr : 0;
  const actual_price = total_area && sr ? total_area * sr : 0;
  const balance_amount = actual_price ? actual_price - ap : 0;
  const net_amount = bk + ap +
    (parseFloat(f.registration_charges)     || 0) +
    (parseFloat(f.intkaal_charges)           || 0) +
    (parseFloat(f.water_connection_charges)  || 0) +
    (parseFloat(f.electricity_meter_charges) || 0);

  return { total_area, total_value, actual_price, balance_amount, net_amount };
}

// ── Formatters ─────────────────────────────────────────────────────────────────
export const fmtINR  = (n) => n != null && n !== '' ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
export const fmtNum  = (n) => n != null && n !== '' ? Number(n).toLocaleString('en-IN') : '—';
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const TYPE_LABEL = { PLOT: 'Plot', SHOP: 'Shop', LAND: 'Land', FLAT: 'Flat', PLOT_WIRE: 'Plot Wire', SHOP_WIRE: 'Shop Wire' };
export const POSS_LABEL = { PENDING: 'Pending', SYMBOLIC: 'Symbolic', PHYSICAL: 'Physical' };
export const POSS_COLOR = {
  PENDING:  'bg-amber-50 text-amber-700 ring-amber-200',
  SYMBOLIC: 'bg-blue-50 text-blue-700 ring-blue-200',
  PHYSICAL: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

// ── Form primitives ────────────────────────────────────────────────────────────
export function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-medium text-gray-500 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}
export function FInput({ value, onChange, type = 'text', placeholder, readOnly, autoFocus }) {
  if (readOnly) return <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</div>;
  return <input autoFocus={autoFocus} type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
    className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />;
}
export function FTextarea({ value, onChange, placeholder, rows = 2, readOnly }) {
  if (readOnly) return <div className="min-h-[60px] px-3 py-2 bg-gray-50 rounded border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">{value || <span className="text-gray-300">—</span>}</div>;
  return <textarea value={value ?? ''} onChange={onChange} placeholder={placeholder} rows={rows}
    className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition resize-none placeholder:text-gray-300" />;
}
export function FSelect({ value, onChange, children, readOnly }) {
  if (readOnly) return <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</div>;
  return <select value={value ?? ''} onChange={onChange}
    className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition">{children}</select>;
}
export function ComputedBox({ label, value, accent, sub }) {
  return (
    <div className={`rounded border px-3 py-2.5 ${accent ? 'bg-[#875A7B]/5 border-[#875A7B]/20' : 'bg-amber-50/60 border-amber-100'}`}>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${accent ? 'text-[#875A7B]' : 'text-amber-700'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
export function SectionDivider({ title }) {
  return (
    <div className="col-span-full pt-3 pb-1 border-b border-gray-200">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
    </div>
  );
}

// ── Lookup Pickers ─────────────────────────────────────────────────────────────
function BasePicker({ value, onPick, onClear, label, endpoint, renderItem, renderSelected, placeholder, readOnly, excludeIds, allowCreate }) {
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

  const fetchItems = useCallback(async (q = '') => {
    setLoad(true);
    try {
      const params = new URLSearchParams({ search: q, limit: 8 });
      const data = await apiGet(`/lookup/${endpoint}?${params}`);
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally  { setLoad(false); }
  }, [endpoint]);

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

  const openAdd   = () => { setAdding(true); setNewForm({ name: search, phone: '', email: '' }); setSaveErr(''); };
  const cancelAdd = () => { setAdding(false); setSaveErr(''); };

  const handleSave = async () => {
    if (!newForm.name.trim()) { setSaveErr('Name is required'); return; }
    setSaving(true); setSaveErr('');
    try {
      const created = await apiPost('/brokers', newForm);
      onPick(created);
      setOpen(false); setAdding(false); setSearch('');
    } catch (e) { setSaveErr(e.message || 'Failed to create'); }
    finally { setSaving(false); }
  };

  if (readOnly) {
    return <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">{renderSelected ? renderSelected(value) : (value || <span className="text-gray-300">—</span>)}</div>;
  }

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
                ) : items.filter(i => !excludeIds?.includes(i.id)).length === 0 ? (
                  <div className="p-3 text-center text-xs text-gray-400">No results</div>
                ) : items.map(item => {
                  const excluded = excludeIds?.includes(item.id);
                  return excluded ? null : (
                    <button key={item.id} type="button" onClick={() => { onPick(item); setOpen(false); setSearch(''); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#875A7B]/5 transition border-b border-gray-50 last:border-0">
                      {renderItem(item)}
                    </button>
                  );
                })}
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
                  className="flex-1 text-sm border border-gray-200 rounded py-1.5 text-gray-500 hover:bg-gray-50 transition">Cancel</button>
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

export function CustomerPicker({ value, onPick, onClear, readOnly, excludeIds }) {
  return (
    <BasePicker
      value={value?.id ? value : null}
      onPick={onPick} onClear={onClear} readOnly={readOnly} excludeIds={excludeIds}
      label="Customer" endpoint="customers" placeholder="Search customer…"
      renderSelected={v => v ? `${v.customer_code || ''} ${v.name || ''} ${v.phone ? `· ${v.phone}` : ''}`.trim() : ''}
      renderItem={c => (
        <div>
          <div className="font-medium text-gray-800 flex items-center gap-1.5">
            <span className="font-mono text-xs text-[#875A7B]">{c.customer_code}</span>
            <span>{c.name}</span>
          </div>
          {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
        </div>
      )}
    />
  );
}

export function BrokerPicker({ value, onPick, onClear, readOnly }) {
  return (
    <BasePicker
      value={value?.id ? value : null}
      onPick={onPick} onClear={onClear} readOnly={readOnly}
      label="Broker" endpoint="brokers" placeholder="Search broker…"
      allowCreate
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

const INV_TYPE_BADGE = {
  PLOT:      'bg-violet-50 text-violet-700',
  SHOP:      'bg-blue-50   text-blue-700',
  LAND:      'bg-emerald-50 text-emerald-700',
  FLAT:      'bg-orange-50 text-orange-700',
  PLOT_WIRE: 'bg-purple-50 text-purple-700',
  SHOP_WIRE: 'bg-indigo-50 text-indigo-700',
};
const INV_TYPE_LABEL = { PLOT: 'Plot', SHOP: 'Shop', LAND: 'Land', FLAT: 'Flat', PLOT_WIRE: 'Plot Wire', SHOP_WIRE: 'Shop Wire' };
const INV_STATUS_BADGE = {
  AVAILABLE:  'bg-emerald-50 text-emerald-700',
  RESERVED:   'bg-amber-50   text-amber-700',
  SOLD:       'bg-blue-50    text-blue-700',
  REGISTERED: 'bg-violet-50  text-violet-700',
};

export function InventoryPickerModal({ value, onPick, onClear, readOnly }) {
  const [open,       setOpen]       = useState(false);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const tmr = useRef(null);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const data = await apiGet(`/lookup/inventory?search=${encodeURIComponent(q)}&limit=40`);
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { if (open) load(''); }, [open, load]);

  useEffect(() => {
    clearTimeout(tmr.current);
    if (!open) return;
    tmr.current = setTimeout(() => load(search), 300);
    return () => clearTimeout(tmr.current);
  }, [search, open, load]);

  const close = () => { setOpen(false); setSearch(''); setTypeFilter(''); };

  const filtered = typeFilter ? items.filter(u => u.type === typeFilter) : items;

  if (readOnly) {
    return (
      <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">
        {value ? `${value.inventory_code || ''} · ${value.plot_no || value.sl_no || ''}`.replace(/^·\s*/, '') : <span className="text-gray-300">—</span>}
      </div>
    );
  }

  return (
    <>
      {value ? (
        <div className="flex items-center gap-2 border border-gray-200 rounded px-3 py-2 bg-white">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${INV_TYPE_BADGE[value.type] || 'bg-gray-50 text-gray-600'}`}>{INV_TYPE_LABEL[value.type] || value.type}</span>
              <span className="text-sm font-semibold text-[#875A7B]">{value.inventory_code}</span>
              {(value.plot_no || value.sl_no) && <span className="text-sm text-gray-600">· {value.plot_no || value.sl_no}</span>}
            </div>
            {value.location && <p className="text-xs text-gray-400 mt-0.5 truncate">{value.location}</p>}
          </div>
          <button type="button" onClick={() => setOpen(true)} className="text-xs text-[#875A7B] hover:underline shrink-0">Change</button>
          <button type="button" onClick={onClear} className="text-gray-300 hover:text-gray-500 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 border border-dashed border-[#875A7B]/40 rounded px-3 py-[7px] text-sm text-[#875A7B]/70 bg-white hover:border-[#875A7B] hover:text-[#875A7B] transition text-left">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          Search &amp; select inventory unit…
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={close} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '82vh' }}>

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Select Inventory Unit</h3>
              <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-100 flex gap-3 shrink-0">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by code, plot no, location, purchase…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/20" />
              </div>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-[#875A7B] bg-white">
                <option value="">All Types</option>
                <option value="PLOT">Plot</option>
                <option value="SHOP">Shop</option>
                <option value="LAND">Land</option>
                <option value="FLAT">Flat</option>
                <option value="PLOT_WIRE">Plot Wire</option>
                <option value="SHOP_WIRE">Shop Wire</option>
              </select>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-400">No units found</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filtered.map(u => {
                    const fa   = parseFloat(u.front_area || 0);
                    const ba   = parseFloat(u.back_area  || 0);
                    const area = fa && ba ? parseFloat((fa * (ba / 9)).toFixed(2)) : parseFloat(u.area || 0);
                    const areaUnit = u.front_area_details || u.area_unit || 'gaj';
                    return (
                      <button key={u.id} type="button"
                        onClick={() => { onPick(u); close(); }}
                        className="w-full text-left px-5 py-3.5 hover:bg-[#875A7B]/5 transition flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-[#875A7B]">{u.inventory_code}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${INV_TYPE_BADGE[u.type] || 'bg-gray-50 text-gray-600'}`}>{INV_TYPE_LABEL[u.type] || u.type}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${INV_STATUS_BADGE[u.status] || 'bg-gray-50 text-gray-600'}`}>{u.status}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            {(u.plot_no || u.sl_no) && <span>Plot: <span className="font-medium text-gray-700">{u.plot_no || u.sl_no}</span></span>}
                            {u.location && <span>{u.location}</span>}
                            {area > 0 && <span>Area: <span className="font-medium text-gray-700">{area} {areaUnit}</span></span>}
                            {u.purchase?.purchase_code && <span>Purchase: <span className="font-medium text-gray-700">{u.purchase.purchase_code}</span></span>}
                          </div>
                        </div>
                        {u.rate && (
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-gray-800">₹{Number(u.rate).toLocaleString('en-IN')}</p>
                            <p className="text-[10px] text-gray-400">/unit</p>
                          </div>
                        )}
                        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-2.5 border-t border-gray-100 shrink-0 flex items-center justify-between">
              <span className="text-xs text-gray-400">{!loading && `${filtered.length} unit${filtered.length !== 1 ? 's' : ''} found`}</span>
              <span className="text-xs text-gray-400">Only available units shown</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
