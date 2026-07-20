'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt    = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtCr  = (n) => {
  const v = Number(n || 0);
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(2)} L`;
  return v > 0 ? `₹${v.toLocaleString('en-IN')}` : '₹0';
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ── Config ────────────────────────────────────────────────────────────────────
const STATUS_LIST = ['OPEN', 'ONGOING', 'CLOSED'];
const STATUS_CFG = {
  OPEN:    { label: 'Open',    bg: 'bg-emerald-500', pill: 'bg-emerald-500/20 text-emerald-100' },
  ONGOING: { label: 'Ongoing', bg: 'bg-blue-500',    pill: 'bg-blue-500/20 text-blue-100'       },
  CLOSED:  { label: 'Closed',  bg: 'bg-gray-400',    pill: 'bg-gray-400/20 text-gray-200'       },
};
const INV_STATUS = [
  { key: 'available',  label: 'Available',  bar: 'bg-emerald-400', dot: 'bg-emerald-400', chip: 'bg-emerald-50 text-emerald-700',   ring: 'ring-emerald-200' },
  { key: 'reserved',   label: 'Reserved',   bar: 'bg-amber-400',   dot: 'bg-amber-400',   chip: 'bg-amber-50 text-amber-700',       ring: 'ring-amber-200'   },
  { key: 'sold',       label: 'Sold',       bar: 'bg-blue-400',    dot: 'bg-blue-400',    chip: 'bg-blue-50 text-blue-700',         ring: 'ring-blue-200'    },
  { key: 'registered', label: 'Registered', bar: 'bg-[#875A7B]',   dot: 'bg-[#875A7B]',  chip: 'bg-[#875A7B]/10 text-[#875A7B]', ring: 'ring-[#875A7B]/30' },
];

function toForm(p) {
  return { name: p.name || '', location: p.location || '', status: p.status || 'OPEN' };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="p-4 pb-10 max-w-5xl space-y-4">
      <div className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
      <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-72" />
      <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  );
}

// ── Status Bar ────────────────────────────────────────────────────────────────
function StatusBar({ project, height = 'h-3' }) {
  const total = project.unit_count || 0;
  if (!total) return <div className={`${height} bg-white/20 rounded-full w-full`} />;
  return (
    <div className={`flex ${height} rounded-full overflow-hidden gap-px w-full`}>
      {INV_STATUS.map(({ key, bar }) => {
        const c = project[key] || 0;
        if (!c) return null;
        return <div key={key} className={bar} style={{ width: `${(c / total) * 100}%` }} />;
      })}
    </div>
  );
}

// ── Delete Modal ──────────────────────────────────────────────────────────────
function DeleteModal({ name, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
        <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </div>
        <p className="text-base font-semibold text-gray-900 mb-1">Delete &quot;{name}&quot;?</p>
        <p className="text-sm text-gray-500 mb-2">Inventory units linked to this project will be unlinked, not deleted.</p>
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-5">This action cannot be undone — deleted data cannot be recovered.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-9 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Cancel</button>
          <button onClick={onConfirm} className="flex-1 h-9 text-sm rounded-lg text-white font-semibold bg-red-500 hover:bg-red-600 transition">Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Inventory Unit Picker ─────────────────────────────────────────────────────
const STATUS_CHIP = {
  AVAILABLE:  'bg-emerald-50 text-emerald-700 ring-emerald-200',
  RESERVED:   'bg-amber-50 text-amber-700 ring-amber-200',
  SOLD:       'bg-blue-50 text-blue-700 ring-blue-200',
  REGISTERED: 'bg-[#875A7B]/10 text-[#875A7B] ring-[#875A7B]/20',
};

function InventoryPicker({ onPick }) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const url = search.trim()
      ? `/lookup/inventory?no_project=1&search=${encodeURIComponent(search.trim())}&limit=20`
      : `/lookup/inventory?no_project=1&limit=20`;
    apiGet(url).then(d => setResults(d || [])).catch(() => setResults([])).finally(() => setLoading(false));
  }, [open, search]);

  const close = () => { setOpen(false); setSearch(''); setResults([]); };
  const pick  = (unit) => { onPick(unit); setResults(prev => prev.filter(u => u.id !== unit.id)); };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="h-8 px-4 text-sm rounded-lg text-white font-semibold flex items-center gap-1.5 hover:opacity-90 transition"
        style={{ backgroundColor: '#875A7B' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Unit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={close}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-base font-black text-gray-900">Add Inventory Unit</p>
                <p className="text-xs text-gray-400 mt-0.5">Select a unit to link to this project</p>
              </div>
              <button onClick={close} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by code, plot no, location…"
                  className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30" />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1 min-h-0">
              {loading ? (
                <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
              ) : results.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No units available</div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr>
                      {['Code', 'Plot / SL', 'Location', 'Type', 'Area', 'Rate', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map(u => (
                      <tr key={u.id} className="hover:bg-[#875A7B]/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-[#875A7B]">{u.inventory_code}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 font-medium">{u.plot_no || u.sl_no || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">{u.location || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{u.type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {u.area ? `${Number(u.area).toLocaleString('en-IN')} ${u.area_unit || ''}`.trim() : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {u.rate ? `₹${Number(u.rate).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${STATUS_CHIP[u.status] || 'bg-gray-50 text-gray-500 ring-gray-200'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => pick(u)}
                            className="h-7 px-3 text-xs font-semibold rounded-lg text-white hover:opacity-90 transition whitespace-nowrap"
                            style={{ backgroundColor: '#875A7B' }}>
                            Link
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/60">
              <p className="text-xs text-gray-400">Click <span className="font-semibold text-[#875A7B]">Link</span> on any row to add it — modal stays open for multiple selections.</p>
              <button onClick={close}
                className="h-8 px-5 text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-white transition">
                Done
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id } = useParams();
  const router  = useRouter();

  const [project, setProject] = useState(null);
  const [form,    setForm]    = useState({ name: '', location: '', status: 'OPEN' });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [tab,     setTab]     = useState('overview');
  const [invSearch, setInvSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await apiGet(`/projects/${id}`);
      setProject(p); setForm(toForm(p));
    } catch { router.push('/dashboard/projects'); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const setF    = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const discard = () => { setForm(toForm(project)); setEditing(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const p = await apiPut(`/projects/${id}`, form);
      setProject(p); setForm(toForm(p)); setEditing(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await apiDelete(`/projects/${id}`); router.push('/dashboard/projects'); }
    catch { setDelOpen(false); }
  };

  const handleLinkUnit = async (unit) => {
    try {
      await apiPost(`/projects/${id}/link-inventory`, { inventory_id: unit.id });
      setProject(prev => {
        const statusKey = (unit.status || '').toLowerCase();
        return {
          ...prev,
          inventory: [...(prev.inventory || []), { ...unit, sales: [] }],
          unit_count: (prev.unit_count || 0) + 1,
          ...(statusKey ? { [statusKey]: (prev[statusKey] || 0) + 1 } : {}),
        };
      });
    } catch { /* ignore */ }
  };

  const handleUnlinkUnit = async (inventoryId) => {
    const unitToRemove = project.inventory?.find(u => u.id === inventoryId);
    try {
      await apiDelete(`/projects/${id}/link-inventory/${inventoryId}`);
      setProject(prev => {
        const statusKey = (unitToRemove?.status || '').toLowerCase();
        return {
          ...prev,
          inventory: (prev.inventory || []).filter(u => u.id !== inventoryId),
          unit_count: Math.max(0, (prev.unit_count || 0) - 1),
          ...(statusKey ? { [statusKey]: Math.max(0, (prev[statusKey] || 0) - 1) } : {}),
        };
      });
    } catch { /* ignore */ }
  };

  if (loading) return <Skeleton />;
  if (!project) return null;

  // ── Derived values ──
  const inventory  = project.inventory || [];
  const totalVal   = inventory.reduce((s, u) => s + Number(u.sales?.[0]?.actual_price   || 0), 0);
  const totalRcvd  = inventory.reduce((s, u) => {
    const sale = u.sales?.[0];
    return s + Number(sale?.booking_amount || 0) + Number(sale?.advance_payment || 0);
  }, 0);
  const totalBal   = totalVal - totalRcvd;
  const pct        = totalVal > 0 ? Math.min(100, Math.round((totalRcvd / totalVal) * 100)) : 0;
  const statusCfg  = STATUS_CFG[project.status] || STATUS_CFG.OPEN;
  const inp        = 'border border-white/30 rounded-xl px-3 py-2 text-sm bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-white/60 focus:bg-white/20 backdrop-blur-sm transition w-full';

  return (
    <div className="pb-10">

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #875A7B 0%, #5c3d57 100%)' }}>
        {/* decorative circle */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -right-4 bottom-0 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative p-6 pb-5 max-w-7xl mx-auto">
          {/* Top row: back + actions */}
          <div className="flex items-center justify-between mb-5">
            <Link href="/dashboard/projects"
              className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-medium transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              Projects
            </Link>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button onClick={discard}
                    className="h-8 px-3 text-xs rounded-lg border border-white/30 text-white/80 hover:bg-white/10 transition font-medium">
                    Discard
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="h-8 px-4 text-xs rounded-lg bg-white text-[#875A7B] font-bold hover:bg-white/90 transition disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setDelOpen(true)}
                    className="h-8 px-3 text-xs rounded-lg border border-white/20 text-white/60 hover:bg-white/10 hover:text-white transition">
                    Delete
                  </button>
                  <button onClick={() => setEditing(true)}
                    className="h-8 px-4 text-xs rounded-lg bg-white/15 border border-white/25 text-white font-semibold hover:bg-white/25 transition flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Identity block */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white font-black text-2xl shrink-0 backdrop-blur-sm">
              {project.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <input value={form.name} onChange={setF('name')} placeholder="Project name"
                  className={`${inp} text-lg font-bold mb-2`} />
              ) : (
                <h1 className="text-2xl font-black text-white leading-tight">{project.name}</h1>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-white/50 text-xs font-mono">{project.project_code}</span>
                <span className="text-white/30 text-xs">·</span>
                {editing ? (
                  <select value={form.status} onChange={setF('status')}
                    className="text-xs bg-white/15 border border-white/25 rounded-lg px-2 py-1 text-white focus:outline-none">
                    {STATUS_LIST.map(s => <option key={s} value={s} className="text-gray-800">{s}</option>)}
                  </select>
                ) : (
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusCfg.pill}`}>
                    {statusCfg.label}
                  </span>
                )}
                {editing ? (
                  <input value={form.location} onChange={setF('location')} placeholder="Location…"
                    className={`${inp} text-sm`} />
                ) : project.location ? (
                  <span className="text-white/60 text-xs flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    {project.location}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Status bar */}
          <StatusBar project={project} height="h-2" />

          {/* Status chips row */}
          <div className="flex flex-wrap gap-2 mt-3">
            {INV_STATUS.map(({ key, label, dot }) => (
              <div key={key} className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1">
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span className="text-white/70 text-[10px]">{label}</span>
                <span className="text-white font-black text-xs">{project[key] || 0}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1">
              <span className="text-white/70 text-[10px]">Total</span>
              <span className="text-white font-black text-xs">{project.unit_count || 0}</span>
            </div>
          </div>

          {/* Created date */}
          <p className="text-white/30 text-[10px] mt-4">
            Created {fmtDate(project.created_at)} · Updated {fmtDate(project.updated_at)}
          </p>
        </div>
      </div>

      {/* ══ KPI + TABS ═════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-3 gap-px bg-gray-100">
        {[
          { label: 'Total Project Value', value: fmtCr(totalVal),   sub: `${inventory.length} units · ${fmt(project.total_area)} area`, color: 'text-gray-900' },
          { label: 'Amount Received',     value: fmtCr(totalRcvd),  sub: `${pct}% collected`,                                           color: 'text-emerald-700' },
          { label: 'Balance Remaining',   value: fmtCr(totalBal),   sub: totalBal > 0 ? 'outstanding' : 'fully collected',              color: totalBal > 0 ? 'text-amber-700' : 'text-emerald-700' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white px-5 py-4">
            <p className={`text-xl font-black leading-none ${color}`}>{value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1.5">{label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* collection bar */}
      <div className="bg-white border-b border-gray-100 px-5 py-2.5 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-bold text-emerald-600 shrink-0">{pct}% collected</span>
      </div>

      {/* ══ TABS ═══════════════════════════════════════════════════════════════ */}
      <div className="flex bg-white border-b border-gray-100 px-4">
        {[
          { key: 'overview',   label: 'Overview'                        },
          { key: 'inventory',  label: `Inventory (${inventory.length})` },
          { key: 'financials', label: 'Financials'                      },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-[#875A7B] text-[#875A7B]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB CONTENT ════════════════════════════════════════════════════════ */}
      <div className="p-4 space-y-4">

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* Status breakdown + financials side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Inventory health */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <p className="text-sm font-bold text-gray-800">Inventory Breakdown</p>
                <StatusBar project={project} height="h-3" />
                <div className="space-y-2">
                  {INV_STATUS.map(({ key, label, dot, chip, ring }) => {
                    const count = project[key] || 0;
                    const pctSt = project.unit_count > 0 ? Math.round((count / project.unit_count) * 100) : 0;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${dot} rounded-full transition-all`} style={{ width: `${pctSt}%` }} />
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ring-1 shrink-0 ${chip} ${ring}`}>{count}</span>
                        <span className="text-[10px] text-gray-400 w-8 text-right shrink-0">{pctSt}%</span>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-50">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total Units</p>
                    <p className="text-lg font-black text-gray-900">{fmt(project.unit_count)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total Area</p>
                    <p className="text-lg font-black text-gray-900">{project.total_area > 0 ? fmt(project.total_area) : '—'}</p>
                  </div>
                </div>
              </div>

              {/* Financial summary */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <p className="text-sm font-bold text-gray-800">Financial Summary</p>
                <div className="space-y-3">
                  {[
                    { label: 'Total Sale Value',  value: fmtCr(totalVal),  color: 'text-gray-900',    bg: 'bg-gray-50'      },
                    { label: 'Amount Received',   value: fmtCr(totalRcvd), color: 'text-emerald-700', bg: 'bg-emerald-50'   },
                    { label: 'Balance',           value: fmtCr(totalBal),  color: totalBal > 0 ? 'text-amber-700' : 'text-emerald-700',
                      bg: totalBal > 0 ? 'bg-amber-50' : 'bg-emerald-50' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`flex items-center justify-between px-4 py-3 rounded-xl ${bg}`}>
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className={`text-sm font-black ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Collection Progress</span>
                    <span className="text-sm font-black text-emerald-700">{pct}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full transition-all duration-700 relative"
                      style={{ width: `${pct}%` }}>
                      {pct > 15 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-white font-bold">{pct}%</span>}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">{fmtCr(totalRcvd)} received · {fmtCr(totalBal)} pending</p>
                </div>
              </div>
            </div>

            {/* Quick stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {INV_STATUS.map(({ key, label, chip, dot }) => (
                <div key={key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</span>
                  </div>
                  <p className="text-3xl font-black text-gray-900">{project[key] || 0}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {project.unit_count > 0 ? `${Math.round(((project[key] || 0) / project.unit_count) * 100)}% of total` : 'units'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Inventory ── */}
        {tab === 'inventory' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-3">
              <p className="text-xs font-bold text-gray-400 shrink-0">
                {inventory.length} unit{inventory.length !== 1 ? 's' : ''} in this project
              </p>
              {inventory.length > 0 && (
                <div className="relative flex-1 max-w-xs">
                  <input
                    value={invSearch}
                    onChange={e => setInvSearch(e.target.value)}
                    placeholder="Search code, plot no, location…"
                    className="w-full text-xs border border-gray-200 rounded-lg h-7 pl-7 pr-3 focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition"
                  />
                  <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              )}
              <div className="ml-auto">
                <InventoryPicker onPick={handleLinkUnit} />
              </div>
            </div>
            {inventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
                </div>
                <p className="text-sm font-bold text-gray-500">No inventory units linked</p>
                <p className="text-xs text-gray-400 mt-1">Click &quot;Add Unit&quot; above to link units to this project.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/60">
                        {['Unit', 'Plot / SL', 'Area', 'Type', 'Status', 'Customer', 'Value', 'Collection', 'Sale', ''].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {inventory
                        .filter(u => {
                          if (!invSearch.trim()) return true;
                          const q = invSearch.toLowerCase();
                          return (
                            (u.inventory_code || '').toLowerCase().includes(q) ||
                            (u.plot_no || '').toLowerCase().includes(q) ||
                            (u.sl_no   || '').toLowerCase().includes(q) ||
                            (u.location|| '').toLowerCase().includes(q) ||
                            (u.type    || '').toLowerCase().includes(q)
                          );
                        })
                        .map(u => {
                        const sale     = u.sales?.[0];
                        const received = Number(sale?.booking_amount || 0) + Number(sale?.advance_payment || 0);
                        const value    = Number(sale?.actual_price || 0);
                        const colPct   = value > 0 ? Math.min(100, Math.round((received / value) * 100)) : 0;
                        const stCfg    = INV_STATUS.find(s => s.key === (u.status || '').toLowerCase());
                        return (
                          <tr key={u.id} className="hover:bg-gray-50/60 transition-colors group">
                            <td className="px-4 py-3">
                              <Link href={`/dashboard/inventory/${u.id}`}
                                className="text-xs font-bold text-[#875A7B] hover:underline">{u.inventory_code}</Link>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 font-medium">{u.plot_no || u.sl_no || '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {u.area ? `${fmt(u.area)} ${u.area_unit || ''}`.trim() : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{u.type}</span>
                            </td>
                            <td className="px-4 py-3">
                              {stCfg ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${stCfg.chip} ${stCfg.ring}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
                                  {u.status}
                                </span>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700 font-medium">{sale?.customer?.name || '—'}</td>
                            <td className="px-4 py-3 text-xs font-bold text-gray-800 whitespace-nowrap">{value ? fmtINR(value) : '—'}</td>
                            <td className="px-4 py-3">
                              {value > 0 ? (
                                <div className="flex items-center gap-2 min-w-[80px]">
                                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${colPct}%` }} />
                                  </div>
                                  <span className="text-[10px] font-bold text-emerald-600 shrink-0">{colPct}%</span>
                                </div>
                              ) : <span className="text-gray-200 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {sale ? (
                                <Link href={`/dashboard/sales/${sale.id}`}
                                  className="text-[10px] font-bold text-[#875A7B] hover:underline">{sale.sale_code}</Link>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleUnlinkUnit(u.id)}
                                className="text-[10px] font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 px-2 py-1 rounded transition whitespace-nowrap"
                              >
                                Unlink
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Financials ── */}
        {tab === 'financials' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Sale Value',  value: totalVal,   color: 'text-gray-900',    bg: 'bg-white',      borderColor: 'border-gray-100' },
                { label: 'Amount Received',   value: totalRcvd,  color: 'text-emerald-700', bg: 'bg-emerald-50', borderColor: 'border-emerald-100' },
                { label: 'Balance',           value: totalBal,   color: totalBal > 0 ? 'text-amber-700' : 'text-emerald-700',
                  bg: totalBal > 0 ? 'bg-amber-50' : 'bg-emerald-50', borderColor: totalBal > 0 ? 'border-amber-100' : 'border-emerald-100' },
              ].map(({ label, value, color, bg, borderColor }) => (
                <div key={label} className={`${bg} rounded-2xl border ${borderColor} shadow-sm p-5`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
                  <p className={`text-2xl font-black ${color}`}>{fmtCr(value)}</p>
                  <p className="text-xs text-gray-400 mt-1">{fmtINR(value)}</p>
                </div>
              ))}
            </div>

            {/* Per-unit financial table */}
            {inventory.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <p className="text-sm font-bold text-gray-800">Unit-wise Financials</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/60">
                        {['Unit', 'Plot', 'Customer', 'Sale Value', 'Booking', 'Advance', 'Received', 'Balance', 'Collected'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {inventory.map(u => {
                        const sale     = u.sales?.[0];
                        const booking  = Number(sale?.booking_amount  || 0);
                        const advance  = Number(sale?.advance_payment || 0);
                        const received = booking + advance;
                        const value    = Number(sale?.actual_price || 0);
                        const balance  = value - received;
                        const colPct   = value > 0 ? Math.min(100, Math.round((received / value) * 100)) : 0;
                        return (
                          <tr key={u.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3">
                              <Link href={`/dashboard/inventory/${u.id}`}
                                className="text-xs font-bold text-[#875A7B] hover:underline">{u.inventory_code}</Link>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{u.plot_no || u.sl_no || '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-700 font-medium">{sale?.customer?.name || '—'}</td>
                            <td className="px-4 py-3 text-xs font-bold text-gray-800">{value ? fmtINR(value) : '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{booking ? fmtINR(booking) : '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{advance ? fmtINR(advance) : '—'}</td>
                            <td className="px-4 py-3 text-xs font-bold text-emerald-700">{received ? fmtINR(received) : '—'}</td>
                            <td className="px-4 py-3 text-xs font-bold text-amber-700">{balance > 0 ? fmtINR(balance) : '—'}</td>
                            <td className="px-4 py-3">
                              {value > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${colPct}%` }} />
                                  </div>
                                  <span className="text-[10px] font-bold text-emerald-600">{colPct}%</span>
                                </div>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Totals footer */}
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200 font-bold">
                        <td className="px-4 py-3 text-xs text-gray-500" colSpan={3}>Total</td>
                        <td className="px-4 py-3 text-xs text-gray-900">{totalVal ? fmtINR(totalVal) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {fmtINR(inventory.reduce((s, u) => s + Number(u.sales?.[0]?.booking_amount || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {fmtINR(inventory.reduce((s, u) => s + Number(u.sales?.[0]?.advance_payment || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-xs text-emerald-700">{totalRcvd ? fmtINR(totalRcvd) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-amber-700">{totalBal > 0 ? fmtINR(totalBal) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-emerald-600 font-black">{pct}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
      </div>{/* end max-w-7xl */}

      {/* Delete modal */}
      {delOpen && <DeleteModal name={project.name} onClose={() => setDelOpen(false)} onConfirm={handleDelete} />}
    </div>
  );
}
