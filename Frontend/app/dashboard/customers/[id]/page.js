'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiPut, apiDelete } from '@/lib/api';
import { EMPTY, fmtDate } from '../_components/shared';

// Avatar with deterministic color
function Avatar({ name, size = 80 }) {
  const colors = ['#6366F1','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#875A7B'];
  const bg = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  const initials = name
    ? name.trim().split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  return (
    <div style={{ width: size, height: size, minWidth: size, backgroundColor: bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      className="font-bold text-white shadow-md">
      <span style={{ fontSize: size * 0.38 }}>{initials}</span>
    </div>
  );
}

// One field row: gray label + bold value (or input when editing)
function Field({ label, value, editing, type = 'text', onChange, children, fullWidth }) {
  return (
    <div className={`flex flex-col gap-0.5 ${fullWidth ? 'col-span-2' : ''}`}>
      <span className="text-[11px] text-gray-400 font-medium">{label}</span>
      {editing ? (
        children ?? (
          <input type={type} value={value ?? ''} onChange={onChange} placeholder="—"
            className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition w-full" />
        )
      ) : (
        <span className="text-sm font-medium text-gray-800">{value || <span className="text-gray-300">—</span>}</span>
      )}
    </div>
  );
}

// KPI summary card with colored icon
function KPICard({ label, value, iconBg, icon }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 font-medium leading-tight">{label}</p>
        <p className="text-sm font-bold text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

// Action button
function ActionBtn({ label, icon, onClick, href, variant = 'default' }) {
  const base = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition w-full text-left';
  const variants = {
    default: 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200',
    primary: 'bg-[#875A7B]/10 text-[#875A7B] hover:bg-[#875A7B]/20 border border-[#875A7B]/20',
    danger:  'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
  };
  if (href) return (
    <Link href={href} className={`${base} ${variants[variant]}`}>
      {icon}<span>{label}</span>
    </Link>
  );
  return (
    <button onClick={onClick} className={`${base} ${variants[variant]}`}>
      {icon}<span>{label}</span>
    </button>
  );
}

function DeleteModal({ open, onClose, onConfirm, deleting }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete this customer?</h3>
        <p className="text-sm text-gray-500 mb-2">This customer record will be permanently deleted.</p>
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-5">This action cannot be undone — deleted data cannot be recovered.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-9 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 h-9 text-sm rounded-lg text-white bg-red-500 hover:bg-red-600 font-semibold transition disabled:opacity-60 min-w-[90px]">{deleting ? 'Deleting…' : 'Yes, Delete'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CustomerRecordPage() {
  useAuth();
  const router      = useRouter();
  const params      = useParams();
  const { can, me } = usePermissions();

  const [form,     setForm]     = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [sales,    setSales]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');
  const [showDel,  setShowDel]  = useState(false);
  const [actMenu,  setActMenu]  = useState(false);
  const [tab,      setTab]      = useState('overview');

  const canEdit   = can('CUSTOMER_EDIT')   || me?.is_system;
  const canDelete = can('CUSTOMER_DELETE') || me?.is_system;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/customers/${params.id}`);
      setForm({ ...EMPTY, ...data });
      setOriginal({ ...EMPTY, ...data });
      setSales(data.sales || []);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => { setForm(p => ({ ...p, [key]: e.target.value })); setError(''); };

  const handleEdit    = () => { setEditing(true); setSaved(false); setError(''); };
  const handleDiscard = () => { setForm(original); setEditing(false); setError(''); };
  const handleSave    = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      await apiPut(`/customers/${params.id}`, form);
      setOriginal(form); setEditing(false); setSaved(true);
      await load();
    } catch (e) { setError(e.message); }
    finally     { setSaving(false); }
  };
  const handleDelete = async () => {
    setDeleting(true);
    try { await apiDelete(`/customers/${params.id}`); router.push('/dashboard/customers'); }
    catch (e) { setError(e.message); setDeleting(false); setShowDel(false); }
  };

  const totalSales  = sales.length;
  const activeSales = sales.filter(s => s.status !== 'INACTIVE').length;
  const lastSale    = sales[0];

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#F4F5F7]">
        <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between">
          <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-28 bg-gray-100 rounded animate-pulse" />
            <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="h-6 w-80 bg-gray-100 rounded animate-pulse" />
            <div className="h-72 bg-white rounded-xl border border-gray-200 animate-pulse" />
            <div className="h-64 bg-white rounded-xl border border-gray-200 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">

      {/* ── Top control bar ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0 text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-700 transition">Dashboard</Link>
            <span className="text-gray-300 mx-0.5">›</span>
            <Link href="/dashboard/customers" className="hover:text-gray-700 transition">Customers</Link>
            <span className="text-gray-300 mx-0.5">›</span>
            <span className="text-gray-700 font-medium">Customer Details</span>
          </nav>

          {saved && !editing && (
            <span className="text-xs text-emerald-600 flex items-center gap-1 shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved
            </span>
          )}

          {editing ? (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleDiscard} disabled={saving}
                className="h-8 px-4 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">Discard</button>
              <button onClick={handleSave} disabled={saving}
                className="h-8 px-5 text-sm rounded-lg text-white font-semibold transition" style={{ backgroundColor: '#875A7B' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/dashboard/customers"
                className="h-8 px-3 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Customers
              </Link>
              {canEdit && (
                <button onClick={handleEdit}
                  className="h-8 px-4 text-sm rounded-lg font-semibold text-white flex items-center gap-1.5 transition"
                  style={{ backgroundColor: '#875A7B' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Edit Customer
                </button>
              )}
              <div className="relative">
                <button onClick={() => setActMenu(v => !v)}
                  className="h-8 px-3 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/></svg>
                  More
                </button>
                {actMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1.5 overflow-hidden">
                    <Link href="/dashboard/sales/new" onClick={() => setActMenu(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <svg className="w-4 h-4 text-[#875A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>New Sale
                    </Link>
                    <Link href="/dashboard/customers/new" onClick={() => setActMenu(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>New Customer
                    </Link>
                    {canDelete && (
                      <>
                        <div className="my-1 border-t border-gray-100" />
                        <button onClick={() => { setActMenu(false); setShowDel(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* Title row */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">
              Customer Details{form.customer_code && <span className="ml-1 text-[#875A7B]">– {form.customer_code}</span>}
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              form.status === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${form.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {form.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            </span>
            {editing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Editing
              </span>
            )}
          </div>

          {/* ── Main info card (3 panels) ───────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex min-h-0" style={{ minHeight: 280 }}>

              {/* LEFT: Profile */}
              <div className="w-52 flex-shrink-0 border-r border-gray-100 p-5 flex flex-col items-center text-center">
                <Avatar name={form.name} size={80} />
                <div className="mt-3 mb-1">
                  {editing ? (
                    <input value={form.name ?? ''} onChange={set('name')} placeholder="Full name"
                      className="text-center text-sm font-bold border border-gray-200 rounded px-2 py-1 w-full focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30" />
                  ) : (
                    <p className="text-base font-bold text-gray-900">{form.name || `Customer #${params.id}`}</p>
                  )}
                </div>
                {form.customer_code && (
                  <span className="inline-block font-mono text-[11px] font-bold text-[#875A7B] bg-[#875A7B]/10 px-2 py-0.5 rounded mb-3">{form.customer_code}</span>
                )}

                {/* Contact items */}
                <div className="w-full mt-1 space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      {editing ? (
                        <input type="tel" value={form.phone ?? ''} onChange={set('phone')} placeholder="+91 XXXXX XXXXX"
                          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 w-full focus:outline-none focus:border-[#875A7B]" />
                      ) : (
                        <p className="text-xs text-gray-700 truncate">{form.phone || <span className="text-gray-300">—</span>}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center shrink-0 mt-px">
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      {editing ? (
                        <input type="email" value={form.email ?? ''} onChange={set('email')} placeholder="email@example.com"
                          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 w-full focus:outline-none focus:border-[#875A7B]" />
                      ) : (
                        <p className="text-xs text-gray-700 break-all">{form.email || <span className="text-gray-300">—</span>}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-px">
                      <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      {editing ? (
                        <textarea value={form.address ?? ''} onChange={set('address')} placeholder="Address" rows={2}
                          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 w-full focus:outline-none focus:border-[#875A7B] resize-none" />
                      ) : (
                        <p className="text-xs text-gray-500 whitespace-pre-wrap">{form.address || <span className="text-gray-300">—</span>}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* CENTER: Two info sections side by side */}
              <div className="flex-1 flex min-w-0">

                {/* Personal Information */}
                <div className="flex-1 p-5 border-r border-gray-100 min-w-0">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <Field label="Customer ID" value={form.customer_code} editing={false} />
                    <Field label="Full Name" value={form.name} editing={editing} onChange={set('name')} />
                    <Field label="Phone" value={form.phone} editing={editing} type="tel" onChange={set('phone')} />
                    <Field label="Email Address" value={form.email} editing={editing} type="email" onChange={set('email')} />
                    <Field label="Type" value={form.type} editing={editing}>
                      {editing && (
                        <select value={form.type ?? 'INDIVIDUAL'} onChange={set('type')}
                          className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 w-full">
                          <option value="INDIVIDUAL">Individual</option>
                          <option value="COMPANY">Company</option>
                        </select>
                      )}
                    </Field>
                    <Field label="Status" value={form.status} editing={editing}>
                      {editing && (
                        <select value={form.status} onChange={set('status')}
                          className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 w-full">
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      )}
                    </Field>
                    {form.created_at && (
                      <Field label="Customer Since" value={fmtDate(form.created_at)} editing={false} />
                    )}
                  </div>
                </div>

                {/* Contact Details / Identity */}
                <div className="flex-1 p-5 min-w-0">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">Contact Details</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <Field label="Address" value={form.address} editing={editing}>
                      {editing && (
                        <textarea value={form.address ?? ''} onChange={set('address')} rows={2} placeholder="Full address"
                          className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 w-full resize-none" />
                      )}
                    </Field>

                    <h3 className="text-sm font-bold text-gray-800 mt-2">Identity Proof</h3>
                    <Field label="PAN" value={form.pan} editing={editing} onChange={set('pan')} />
                    <Field label="Aadhaar" value={form.aadhaar} editing={editing} onChange={set('aadhaar')} />
                    <Field label="Other" value={form.other} editing={editing} onChange={set('other')} />
                  </div>
                </div>
              </div>

              {/* RIGHT: Quick Summary + Actions */}
              <div className="w-56 flex-shrink-0 border-l border-gray-100 p-4 flex flex-col gap-4">

                {/* Quick Summary */}
                <div>
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Summary</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <KPICard label="Total Sales" value={totalSales}
                      iconBg="bg-violet-100"
                      icon={<svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>}
                    />
                    <KPICard label="Active" value={activeSales}
                      iconBg="bg-emerald-100"
                      icon={<svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <KPICard label="Inactive" value={totalSales - activeSales}
                      iconBg="bg-gray-100"
                      icon={<svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <KPICard label="Last Sale" value={lastSale ? fmtDate(lastSale.created_at).split(' ').slice(0,2).join(' ') : '—'}
                      iconBg="bg-blue-100"
                      icon={<svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    />
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick Actions</h4>
                  <div className="space-y-1.5">
                    <ActionBtn variant="primary" href="/dashboard/sales/new" label="New Sale"
                      icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>}
                    />
                    {canEdit && !editing && (
                      <ActionBtn variant="default" onClick={handleEdit} label="Edit Customer"
                        icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                      />
                    )}
                    <ActionBtn variant="default" href="/dashboard/sales" label="All Sales"
                      icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>}
                    />
                    {canDelete && (
                      <ActionBtn variant="danger" onClick={() => setShowDel(true)} label="Delete"
                        icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit save bar inside card */}
            {editing && (
              <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Unsaved changes
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDiscard} disabled={saving}
                    className="h-8 px-4 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition">Discard</button>
                  <button onClick={handleSave} disabled={saving}
                    className="h-8 px-5 text-sm rounded-lg text-white font-semibold transition" style={{ backgroundColor: '#875A7B' }}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Tab card ────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-gray-200 px-2">
              {[
                { key: 'overview', label: 'Overview',
                  icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
                { key: 'sales', label: 'Sales & Plots', count: totalSales,
                  icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg> },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap -mb-px ${
                    tab === t.key
                      ? 'border-[#875A7B] text-[#875A7B]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}>
                  {t.icon}
                  {t.label}
                  {t.count != null && (
                    <span className={`ml-0.5 px-1.5 py-px rounded-full text-[10px] font-bold ${tab === t.key ? 'bg-[#875A7B]/15 text-[#875A7B]' : 'bg-gray-100 text-gray-500'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Overview tab ─────────────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="p-5">
                {sales.length === 0 ? (
                  <div className="text-center py-14">
                    <div className="w-14 h-14 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">No Sales Yet</p>
                    <p className="text-xs text-gray-400 mb-4">Sales linked to this customer will appear here.</p>
                    <Link href="/dashboard/sales/new"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white"
                      style={{ backgroundColor: '#875A7B' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Create First Sale
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Sales table */}
                    <div className="lg:col-span-2">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-800">Sales &amp; Plots</h3>
                        <Link href="/dashboard/sales/new"
                          className="text-xs font-medium text-[#875A7B] hover:text-[#6d4a63] transition">+ New Sale</Link>
                      </div>
                      <div className="rounded-xl border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-left">
                              <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sale ID</th>
                              <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Plot</th>
                              <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</th>
                              <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                              <th className="px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {sales.map(s => (
                              <tr key={s.id} className="hover:bg-gray-50/80 transition group">
                                <td className="px-4 py-3">
                                  <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-2 py-0.5 rounded">
                                    {s.sale_code || `SAL-${String(s.id).padStart(4,'0')}`}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-800">
                                  {s.purchase ? `Plot ${s.purchase.plot_no || s.purchase.sl_no || `#${s.purchase.id}`}` : `Sale #${s.id}`}
                                </td>
                                <td className="px-4 py-3 text-gray-500 text-xs">{s.purchase?.location || '—'}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    s.status === 'ACTIVE'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    <span className={`w-1 h-1 rounded-full ${s.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                    {s.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(s.created_at)}</td>
                                <td className="px-3 py-3">
                                  <button onClick={() => router.push(`/dashboard/sales/${s.id}`)}
                                    className="text-gray-300 hover:text-[#875A7B] transition">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {totalSales >= 10 && (
                        <button onClick={() => setTab('sales')} className="flex items-center gap-1 mt-2 text-xs font-medium text-[#875A7B] hover:text-[#6d4a63] transition">
                          View All Sales →
                        </button>
                      )}
                    </div>

                    {/* Right summary */}
                    <div className="space-y-4">
                      {/* Payment Summary */}
                      <div>
                        <h3 className="text-sm font-bold text-gray-800 mb-3">Sales Summary</h3>
                        <div className="rounded-xl border border-gray-100 overflow-hidden">
                          <div className="px-4 py-3 flex justify-between items-center border-b border-gray-50">
                            <span className="text-sm text-gray-500">Total Sales</span>
                            <span className="text-sm font-bold text-gray-800">{totalSales}</span>
                          </div>
                          <div className="px-4 py-3 flex justify-between items-center border-b border-gray-50">
                            <span className="text-sm text-gray-500">Active</span>
                            <span className="text-sm font-bold text-emerald-600">{activeSales}</span>
                          </div>
                          <div className="px-4 py-3 flex justify-between items-center">
                            <span className="text-sm text-gray-500">Inactive</span>
                            <span className="text-sm font-bold text-gray-400">{totalSales - activeSales}</span>
                          </div>
                        </div>
                      </div>

                      {/* Customer since */}
                      {form.created_at && (
                        <div>
                          <h3 className="text-sm font-bold text-gray-800 mb-3">Customer Since</h3>
                          <div className="rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-800">{fmtDate(form.created_at)}</p>
                              <p className="text-xs text-gray-400">Joined date</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Sales & Plots tab ────────────────────────────────────────── */}
            {tab === 'sales' && (
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-800">All Sales &amp; Plots <span className="text-gray-400 font-normal">({totalSales})</span></h3>
                  <Link href="/dashboard/sales/new"
                    className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold rounded-lg text-white transition" style={{ backgroundColor: '#875A7B' }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>New Sale
                  </Link>
                </div>
                {sales.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">No sales for this customer.</p>
                ) : (
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-left">
                          <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sale ID</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Plot No.</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Booking Date</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {sales.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-2 py-0.5 rounded">
                                {s.sale_code || `SAL-${String(s.id).padStart(4,'0')}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {s.purchase ? `${s.purchase.plot_no || s.purchase.sl_no || `#${s.purchase.id}`}` : `#${s.id}`}
                            </td>
                            <td className="px-4 py-3 text-gray-500">{s.purchase?.location || '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(s.created_at)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${s.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                {s.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 flex items-center gap-3">
                              <button onClick={() => router.push(`/dashboard/sales/${s.id}`)}
                                className="text-[#875A7B] hover:text-[#6d4a63] text-xs font-medium transition">View →</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
