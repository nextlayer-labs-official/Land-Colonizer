'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiPut, apiDelete } from '@/lib/api';
import { EMPTY, AREA_UNITS, fmtINR, fmtNum, fmtDate } from '../_components/shared';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  AVAILABLE:  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-200', boxBg: 'bg-emerald-500' },
  RESERVED:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   ring: 'ring-amber-200',  boxBg: 'bg-amber-500'   },
  SOLD:       { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    ring: 'ring-blue-200',   boxBg: 'bg-blue-500'    },
  REGISTERED: { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500',  ring: 'ring-violet-200', boxBg: 'bg-violet-500'  },
};
const TYPE_STYLE = {
  PLOT: { label: 'Plot',  color: '#875A7B', bg: '#875A7B15' },
  SHOP: { label: 'Shop',  color: '#3b82f6', bg: '#3b82f615' },
  LAND: { label: 'Land',  color: '#10b981', bg: '#10b98115' },
};
const POSS_LABEL = { PENDING: 'Pending', SYMBOLIC: 'Symbolic', PHYSICAL: 'Physical' };
const POSS_STYLE = {
  PENDING:  'bg-amber-50 text-amber-700 ring-amber-200',
  SYMBOLIC: 'bg-blue-50 text-blue-700 ring-blue-200',
  PHYSICAL: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};
const ORDINALS = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th',
                  '11th','12th','13th','14th','15th','16th','17th','18th','19th','20th'];

// ── Field atoms ───────────────────────────────────────────────────────────────
function FL({ children }) { return <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{children}</p>; }
function FV({ children }) { return <p className="text-sm text-gray-800">{children || <span className="text-gray-300 font-normal">—</span>}</p>; }
function FIn({ label, value, onChange, type = 'text', placeholder, readOnly }) {
  return (
    <div>
      <FL>{label}</FL>
      {readOnly
        ? <FV>{value}</FV>
        : <input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
            className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />}
    </div>
  );
}
function FSel({ label, value, onChange, readOnly, children }) {
  return (
    <div>
      <FL>{label}</FL>
      {readOnly
        ? <FV>{value}</FV>
        : <select value={value} onChange={onChange}
            className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition">
            {children}
          </select>}
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
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete this unit?</h3>
        <p className="text-sm text-gray-500 mb-5">This inventory unit will be permanently deleted.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-8 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="px-4 h-8 text-sm rounded-lg text-white bg-red-500 hover:bg-red-600 min-w-[90px]">{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Plot Visual Card ───────────────────────────────────────────────────────────
function PlotVisual({ form }) {
  const ts   = TYPE_STYLE[form.type] || TYPE_STYLE.PLOT;
  const ss   = STATUS_STYLE[form.status] || STATUS_STYLE.AVAILABLE;
  const fa   = parseFloat(form.front_area) || 0;
  const ba   = parseFloat(form.back_area)  || 0;
  const computed = fa && ba ? parseFloat((fa * (ba / 9)).toFixed(2)) : 0;
  const area = fa && ba
    ? `${fmtNum(fa)} × ${fmtNum(ba)}${form.front_area_details ? ` ${form.front_area_details}` : ''}`
    : form.area ? `${fmtNum(form.area)} ${form.area_unit || ''}`.trim() : null;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 select-none">
      {/* Box */}
      <div className="relative flex items-center justify-center rounded-lg border-2 w-40 h-28"
        style={{ borderColor: ts.color, backgroundColor: ts.bg }}>
        <div className="text-center">
          <p className="text-2xl font-black" style={{ color: ts.color }}>{form.plot_no || form.inventory_code || '—'}</p>
          {area && <p className="text-xs font-semibold mt-1" style={{ color: ts.color }}>{area}</p>}
        </div>
        {/* Status dot */}
        <span className={`absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-white ${ss.boxBg}`} />
      </div>

      {/* Labels */}
      <div className="text-center space-y-1">
        {form.location && (
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {form.location}
          </p>
        )}
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: ts.bg, color: ts.color }}>
            {ts.label}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${ss.bg} ${ss.text} ${ss.ring}`}>
            {form.status}
          </span>
        </div>
        <p className="text-[10px] text-gray-300 italic">Status auto-computed</p>
      </div>
    </div>
  );
}

// ── Payment Progress Bar ───────────────────────────────────────────────────────
function PaymentBar({ received, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>Paid</span><span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: '#875A7B' }} />
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function InventoryRecordPage() {
  useAuth();
  const router      = useRouter();
  const params      = useParams();
  const { can, me } = usePermissions();

  const [inv,      setInv]      = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');
  const [showDel,  setShowDel]  = useState(false);
  const [tab,      setTab]      = useState('overview');
  const [instData, setInstData] = useState(null);
  const [instLoading, setInstLoading] = useState(false);

  const canEdit   = (can('INVENTORY_EDIT')   || me?.is_system) && inv?.status !== 'SOLD' && inv?.status !== 'REGISTERED';
  const canDelete = (can('INVENTORY_DELETE') || me?.is_system) && inv?.status !== 'SOLD' && inv?.status !== 'REGISTERED';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/inventory/${params.id}`);
      setInv(data);
      const flat = {
        ...EMPTY, ...data,
        purchase_id:        data.purchase_id != null ? String(data.purchase_id) : '',
        project_id:         data.project_id  != null ? String(data.project_id)  : '',
        project:            data.project || null,
        front_area:         data.front_area  != null ? String(data.front_area)  : '',
        front_area_details: data.front_area_details || '',
        back_area:          data.back_area   != null ? String(data.back_area)   : '',
        back_area_details:  data.back_area_details  || '',
        area:               data.area        != null ? String(data.area)        : '',
        area_unit:          data.area_unit   || '',
        rate:               data.rate        != null ? String(data.rate)        : '',
        registration_date:  data.registration_date ? String(data.registration_date).split('T')[0] : '',
      };
      setForm(flat);
      setOriginal(flat);
    } catch (e) { setError(e.message || 'Failed to load'); }
    finally     { setLoading(false); }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  // Load installments when that tab is activated
  useEffect(() => {
    if (tab !== 'installments' || !inv) return;
    const activeSale = inv.sales?.find(s => s.status !== 'INACTIVE');
    if (!activeSale) return;
    setInstLoading(true);
    apiGet(`/sales/${activeSale.id}/installments`)
      .then(d => setInstData(d))
      .catch(() => setInstData(null))
      .finally(() => setInstLoading(false));
  }, [tab, inv]);

  const set = (key) => (e) => { setForm(p => ({ ...p, [key]: e.target.value })); setError(''); };
  const handleEdit    = () => { setEditing(true); setSaved(false); setError(''); };
  const handleDiscard = () => { setForm(original); setEditing(false); setError(''); };
  const handleSave    = async () => {
    setSaving(true); setError('');
    try {
      await apiPut(`/inventory/${params.id}`, form);
      setEditing(false); setSaved(true);
      await load();
    } catch (e) { setError(e.message || 'Failed to save'); }
    finally     { setSaving(false); }
  };
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDelete(`/inventory/${params.id}`);
      if (original.purchase_id) router.push(`/dashboard/purchases/${original.purchase_id}`);
      else router.push('/dashboard/inventory');
    } catch (e) { setError(e.message); setDeleting(false); setShowDel(false); }
  };

  if (loading) return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-200 px-5 py-2.5 h-12 animate-pulse" />
      <div className="p-4 space-y-4">
        <div className="h-56 bg-white rounded-xl border animate-pulse" />
        <div className="h-12 bg-white rounded-xl border animate-pulse" />
        <div className="h-64 bg-white rounded-xl border animate-pulse" />
      </div>
    </div>
  );

  const activeSale   = inv?.sales?.find(s => s.status !== 'INACTIVE') || null;
  const sc           = STATUS_STYLE[form.status] || STATUS_STYLE.AVAILABLE;
  const codeLabel    = form.inventory_code || `INV-${String(params.id).padStart(4, '0')}`;
  const titleLabel   = form.plot_no ? `${TYPE_STYLE[form.type]?.label || form.type} ${form.plot_no}` : codeLabel;

  // Financial from active sale
  const totalValue   = Number(activeSale?.actual_price    || 0);
  const received     = Number(activeSale?.booking_amount  || 0) + Number(activeSale?.advance_payment || 0);
  const balanceAmt   = Number(activeSale?.balance_amount  || 0);
  const netAmt       = Number(activeSale?.net_amount      || 0);

  // Installment summary from activeSale.installment
  const inst         = activeSale?.installment || null;
  let instTotalPaid  = 0;
  let instPaidCount  = 0;
  let instTotalCount = 0;
  if (inst) {
    for (let n = 1; n <= 20; n++) {
      if (inst[`inst_${n}_amount`] != null) instTotalCount++;
      if (inst[`inst_${n}_paid`]) { instPaidCount++; instTotalPaid += Number(inst[`inst_${n}_amount`] || 0); }
    }
  }

  const TABS = [
    { id: 'overview',      label: 'Overview' },
    { id: 'sales',         label: `Sales (${inv?.sales?.length || 0})` },
    { id: 'installments',  label: 'Installments' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* ── Control bar ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap">
          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0 text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-700 transition">Dashboard</Link>
            <span className="mx-1 text-gray-300">›</span>
            <Link href="/dashboard/inventory" className="hover:text-gray-700 transition">Inventory</Link>
            <span className="mx-1 text-gray-300">›</span>
            <span className="text-gray-800 font-medium truncate">{titleLabel}</span>
          </nav>

          {saved && !editing && (
            <span className="text-xs text-emerald-600 flex items-center gap-1 shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved
            </span>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/dashboard/inventory"
              className="h-8 px-3 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Back
            </Link>
            {editing ? (
              <>
                <button onClick={handleDiscard} disabled={saving}
                  className="h-8 px-4 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">Discard</button>
                <button onClick={handleSave} disabled={saving}
                  className="h-8 px-5 text-sm rounded-lg text-white font-semibold" style={{ backgroundColor: '#875A7B' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                {canEdit && (
                  <button onClick={handleEdit}
                    className="h-8 px-4 text-sm rounded-lg font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: '#875A7B' }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit Unit
                  </button>
                )}
                {!activeSale && (can('SALE_CREATE') || me?.is_system) && (
                  <Link href={`/dashboard/sales/new?inventory_id=${params.id}`}
                    className="h-8 px-4 text-sm border border-[#875A7B] rounded-lg text-[#875A7B] hover:bg-[#875A7B]/5 transition font-medium flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    New Sale
                  </Link>
                )}
                {canDelete && (
                  <button onClick={() => setShowDel(true)}
                    className="h-8 px-3 text-sm border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition">Delete</button>
                )}
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
            <button onClick={() => setError('')} className="ml-auto">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 space-y-4">

          {/* ── Hero row ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

              {/* Left: Plot visual */}
              <div className="p-5 flex flex-col items-center justify-center bg-gray-50/50">
                <PlotVisual form={form} />
              </div>

              {/* Center: Unit details */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">
                      {titleLabel}
                      {form.inventory_code && <span className="ml-2 font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{form.inventory_code}</span>}
                    </h1>
                    {editing && <span className="text-[10px] text-amber-600 flex items-center gap-1 mt-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Editing</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                  {/* Purchase link */}
                  <div className="col-span-full sm:col-span-1">
                    <FL>Purchase Ref</FL>
                    {form.purchase_id
                      ? <Link href={`/dashboard/purchases/${form.purchase_id}`} className="text-sm font-medium text-[#875A7B] hover:underline">
                          {form.purchase?.purchase_code || `PUR-${String(form.purchase_id).padStart(4,'0')}`}
                        </Link>
                      : <FV />}
                  </div>

                  {/* Project link */}
                  <div className="col-span-full sm:col-span-1">
                    <FL>Project</FL>
                    {form.project_id
                      ? <Link href={`/dashboard/projects/${form.project_id}`} className="text-sm font-medium text-[#875A7B] hover:underline">
                          {form.project?.name || form.project?.project_code || `PRJ-${String(form.project_id).padStart(4,'0')}`}
                        </Link>
                      : <FV />}
                  </div>

                  <FSel label="Type" value={form.type} onChange={set('type')} readOnly={!editing}>
                    <option value="PLOT">Plot</option>
                    <option value="SHOP">Shop</option>
                    <option value="LAND">Land</option>
                    <option value="FLAT">Flat</option>
                  </FSel>

                  <div>
                    <FL>Status</FL>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ring-1 ${sc.bg} ${sc.text} ${sc.ring}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{form.status}
                    </span>
                  </div>

                  <FIn label="SL No" value={form.sl_no} onChange={set('sl_no')} placeholder="Serial no." readOnly={!editing} />
                  <FIn label="Plot No" value={form.plot_no} onChange={set('plot_no')} placeholder="e.g. A-125" readOnly={!editing} />
                  <FIn label="Location" value={form.location} onChange={set('location')} placeholder="Sector / area" readOnly={!editing} />

                  <div className="grid grid-cols-2 gap-2 col-span-full sm:col-span-1">
                    <FIn label="Front Area" value={form.front_area} onChange={set('front_area')} type="number" placeholder="0" readOnly={!editing} />
                    <FSel label="Front Unit" value={form.front_area_details} onChange={set('front_area_details')} readOnly={!editing}>
                      <option value="">—</option>
                      {AREA_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </FSel>
                  </div>

                  <div className="grid grid-cols-2 gap-2 col-span-full sm:col-span-1">
                    <FIn label="Back Area" value={form.back_area} onChange={set('back_area')} type="number" placeholder="0" readOnly={!editing} />
                    <FSel label="Back Unit" value={form.back_area_details} onChange={set('back_area_details')} readOnly={!editing}>
                      <option value="">—</option>
                      {AREA_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </FSel>
                  </div>

                  <div>
                    <FL>Total Area (F × B ÷ 9)</FL>
                    <FV>{(() => { const f = parseFloat(form.front_area)||0, b = parseFloat(form.back_area)||0; return f && b ? `${parseFloat((f*(b/9)).toFixed(4))} ${form.front_area_details||''}`.trim() : '—'; })()}</FV>
                  </div>

                  <div>
                    <FL>Plot Rate (₹/unit)</FL>
                    {!editing ? <FV>{form.rate ? fmtINR(form.rate) : '—'}</FV>
                      : <input type="number" value={form.rate ?? ''} onChange={set('rate')} placeholder="0"
                          className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />}
                  </div>

                  <FIn label="Registration Date" value={form.registration_date} onChange={set('registration_date')} type="date" readOnly={!editing} />

                  {activeSale && (
                    <div>
                      <FL>Selling Rate</FL>
                      <FV>{activeSale.selling_rate ? fmtINR(activeSale.selling_rate) + '/unit' : '—'}</FV>
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button onClick={handleDiscard} className="h-8 px-4 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Discard</button>
                    <button onClick={handleSave} disabled={saving} className="h-8 px-5 text-sm rounded-lg text-white font-semibold" style={{ backgroundColor: '#875A7B' }}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Financial KPIs */}
              <div className="p-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Financials</h3>

                {activeSale ? (
                  <>
                    <div className="bg-[#875A7B]/5 rounded-xl p-3 border border-[#875A7B]/10">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total Plot Value</p>
                      <p className="text-xl font-black text-[#875A7B] mt-0.5">{fmtINR(totalValue)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-100">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wide">Received</p>
                        <p className="text-sm font-bold text-emerald-700 mt-0.5">{fmtINR(received)}</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wide">Balance</p>
                        <p className="text-sm font-bold text-amber-700 mt-0.5">{fmtINR(balanceAmt)}</p>
                      </div>
                    </div>

                    {/* Payment progress */}
                    {totalValue > 0 && (
                      <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                        <PaymentBar received={received} total={totalValue} />
                      </div>
                    )}

                    {/* Installments summary */}
                    {inst && instTotalCount > 0 && (
                      <div className="bg-violet-50 rounded-xl p-3 border border-violet-100">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Installments Paid</p>
                          <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                            {instPaidCount} / {instTotalCount}
                          </span>
                        </div>
                        <p className="text-base font-bold text-violet-700">{fmtINR(instTotalPaid)}</p>
                      </div>
                    )}

                    {/* Customer & Broker */}
                    {activeSale.customer && (
                      <Link href={`/dashboard/customers/${activeSale.customer.id}`}
                        className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:bg-[#875A7B]/5 transition group">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: '#875A7B' }}>
                          {activeSale.customer.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-700 group-hover:text-[#875A7B] truncate">{activeSale.customer.name}</p>
                          <p className="text-[10px] text-gray-400">{activeSale.customer.phone || activeSale.customer.customer_code}</p>
                        </div>
                      </Link>
                    )}
                    {activeSale.broker && (
                      <Link href={`/dashboard/brokers/${activeSale.broker.id}`}
                        className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:bg-[#875A7B]/5 transition group">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-amber-700 bg-amber-100 shrink-0">
                          {activeSale.broker.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-700 group-hover:text-[#875A7B] truncate">{activeSale.broker.name}</p>
                          <p className="text-[10px] text-gray-400">{activeSale.broker.broker_code || 'Broker'}</p>
                        </div>
                      </Link>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <p className="text-xs text-gray-400">No sale linked yet</p>
                    {(can('SALE_CREATE') || me?.is_system) && (
                      <Link href={`/dashboard/sales/new`} className="text-xs text-[#875A7B] mt-1 hover:underline">+ Create sale</Link>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-gray-100 px-1">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${tab === t.id ? 'border-[#875A7B] text-[#875A7B]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Overview ── */}
            {tab === 'overview' && (
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Unit Details</p>
                    <div className="space-y-4">
                      <FIn label="Inventory Code" value={form.inventory_code} readOnly={true} />
                      <FSel label="Type" value={form.type} onChange={set('type')} readOnly={!editing}>
                        <option value="PLOT">Plot</option>
                        <option value="SHOP">Shop</option>
                        <option value="LAND">Land</option>
                      </FSel>
                      <FIn label="SL No" value={form.sl_no} onChange={set('sl_no')} placeholder="Survey / serial no" readOnly={!editing} />
                      <FIn label="Plot No" value={form.plot_no} onChange={set('plot_no')} placeholder="e.g. A-125" readOnly={!editing} />
                      <FIn label="Location" value={form.location} onChange={set('location')} placeholder="Sector / area" readOnly={!editing} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Area, Rate & Registration</p>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FIn label="Front Area" value={form.front_area} onChange={set('front_area')} type="number" placeholder="0" readOnly={!editing} />
                        <FSel label="Front Unit" value={form.front_area_details} onChange={set('front_area_details')} readOnly={!editing}>
                          <option value="">— Unit —</option>
                          {AREA_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </FSel>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FIn label="Back Area" value={form.back_area} onChange={set('back_area')} type="number" placeholder="0" readOnly={!editing} />
                        <FSel label="Back Unit" value={form.back_area_details} onChange={set('back_area_details')} readOnly={!editing}>
                          <option value="">— Unit —</option>
                          {AREA_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </FSel>
                      </div>
                      <div className={`rounded border px-3 py-2 ${parseFloat(form.front_area) && parseFloat(form.back_area) ? 'bg-amber-50/60 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                        <FL>Total Area = Front × Back ÷ 9</FL>
                        {(() => { const f = parseFloat(form.front_area)||0, b = parseFloat(form.back_area)||0; const t = f && b ? parseFloat((f*(b/9)).toFixed(4)) : null; return t ? <p className="text-sm font-bold text-amber-700">{t} {form.front_area_details || ''}</p> : <p className="text-sm text-gray-300">—</p>; })()}
                      </div>
                      <FIn label="Plot Rate (₹ per unit)" value={form.rate} onChange={set('rate')} type="number" placeholder="0" readOnly={!editing} />
                      <FIn label="Registration Date" value={form.registration_date} onChange={set('registration_date')} type="date" readOnly={!editing} />
                      <div>
                        <FL>Status</FL>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ring-1 ${sc.bg} ${sc.text} ${sc.ring}`}>
                          <span className={`w-2 h-2 rounded-full ${sc.dot}`} />{form.status}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-1">Auto-computed from linked sale data</p>
                      </div>
                    </div>
                  </div>
                </div>
                {editing && (
                  <div className="flex justify-end gap-2 mt-6 pt-5 border-t border-gray-100">
                    <button onClick={handleDiscard} className="h-8 px-4 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Discard</button>
                    <button onClick={handleSave} disabled={saving} className="h-8 px-5 text-sm rounded-lg text-white font-semibold" style={{ backgroundColor: '#875A7B' }}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Sales ── */}
            {tab === 'sales' && (
              <div className="p-5">
                {inv?.sales?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <p className="text-sm text-gray-400">No sales linked to this unit</p>
                    {(can('SALE_CREATE') || me?.is_system) && (
                      <Link href="/dashboard/sales/new" className="text-sm text-[#875A7B] mt-2 hover:underline">+ Create a sale</Link>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {['Sale Code','Customer','Broker','Sale Date','Actual Price','Received','Balance','Possession','Status'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {inv.sales.map(s => (
                          <tr key={s.id} onClick={() => router.push(`/dashboard/sales/${s.id}`)}
                            className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition">
                            <td className="px-3 py-2.5">
                              <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">
                                {s.sale_code || `SAL-${String(s.id).padStart(4,'0')}`}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              {s.customer ? (
                                <div>
                                  <p className="text-xs font-semibold text-gray-700">{s.customer.name}</p>
                                  <p className="text-[10px] text-gray-400">{s.customer.phone || s.customer.customer_code}</p>
                                </div>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-600">{s.broker?.name || '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-500">{fmtDate(s.sale_date)}</td>
                            <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">{s.actual_price ? fmtINR(s.actual_price) : '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-emerald-700 font-medium">
                              {fmtINR(Number(s.booking_amount || 0) + Number(s.advance_payment || 0))}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-amber-700 font-medium">{s.balance_amount ? fmtINR(s.balance_amount) : '—'}</td>
                            <td className="px-3 py-2.5">
                              {s.possession && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ring-1 ${POSS_STYLE[s.possession] || ''}`}>
                                  {POSS_LABEL[s.possession]}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                                <span className={`w-1 h-1 rounded-full ${s.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Installments ── */}
            {tab === 'installments' && (
              <div className="p-5">
                {!activeSale ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-sm text-gray-400">No active sale — installments are tracked per sale.</p>
                    <Link href={`/dashboard/sales/new`} className="text-sm text-[#875A7B] mt-2 hover:underline">+ Create a sale</Link>
                  </div>
                ) : instLoading ? (
                  <div className="space-y-2 p-4">
                    {Array(5).fill(0).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
                  </div>
                ) : (
                  <div>
                    {/* Link to full sale */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs text-gray-400">From sale</p>
                        <Link href={`/dashboard/sales/${activeSale.id}`}
                          className="text-sm font-bold text-[#875A7B] hover:underline">
                          {activeSale.sale_code || `SAL-${String(activeSale.id).padStart(4,'0')}`}
                        </Link>
                        {activeSale.customer && <p className="text-xs text-gray-400 mt-0.5">{activeSale.customer.name}</p>}
                      </div>
                      <Link href={`/dashboard/sales/${activeSale.id}`}
                        className="h-7 px-3 text-xs border border-[#875A7B] rounded text-[#875A7B] hover:bg-[#875A7B]/5 transition font-medium">
                        Edit in Sale →
                      </Link>
                    </div>

                    {/* Summary */}
                    {instData && (
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                          { l: 'Balance Amount', v: fmtINR(instData.balance_amount), c: 'text-amber-700', bg: 'bg-amber-50' },
                          { l: 'Total Paid',     v: fmtINR(instData.total_paid),     c: 'text-emerald-700', bg: 'bg-emerald-50' },
                          { l: 'Remaining',      v: fmtINR(instData.balance_amount - instData.total_paid), c: 'text-red-600', bg: 'bg-red-50' },
                        ].map(({ l, v, c, bg }) => (
                          <div key={l} className={`${bg} rounded-lg p-3`}>
                            <p className="text-[9px] text-gray-400 uppercase tracking-wide">{l}</p>
                            <p className={`text-sm font-bold ${c} mt-0.5`}>{v}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 20-slot table */}
                    {instData?.installment ? (
                      <div className="border border-gray-100 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[60px_1fr_120px_50px] bg-gray-50 border-b border-gray-100 px-3 py-2">
                          {['#','Amount (₹)','Date','Paid'].map(h => (
                            <p key={h} className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">{h}</p>
                          ))}
                        </div>
                        {ORDINALS.map((label, i) => {
                          const n   = i + 1;
                          const rec = instData.installment;
                          const amt = rec[`inst_${n}_amount`];
                          const dt  = rec[`inst_${n}_date`];
                          const pd  = rec[`inst_${n}_paid`];
                          if (!amt && !dt && !pd) return null;
                          return (
                            <div key={n}
                              className={`grid grid-cols-[60px_1fr_120px_50px] items-center px-3 py-2 border-b border-gray-50 last:border-b-0 ${pd ? 'bg-emerald-50/40' : ''}`}>
                              <p className={`text-[10px] font-semibold ${pd ? 'text-emerald-700' : 'text-gray-500'}`}>{label}</p>
                              <p className={`text-xs ${pd ? 'text-emerald-700 font-bold' : 'text-gray-700 font-medium'}`}>
                                {amt ? `₹${Number(amt).toLocaleString('en-IN')}` : '—'}
                              </p>
                              <p className="text-[10px] text-gray-500">{dt ? fmtDate(dt) : '—'}</p>
                              <div className="flex justify-center">
                                {pd
                                  ? <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  : <span className="w-4 h-4 rounded border-2 border-gray-200 inline-block" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-8">No installments recorded for this sale.</p>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      <DeleteModal open={showDel} onClose={() => setShowDel(false)} onConfirm={handleDelete} deleting={deleting} />
    </div>
  );
}
