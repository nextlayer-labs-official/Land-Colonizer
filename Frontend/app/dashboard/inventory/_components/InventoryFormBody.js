'use client';

import { useEffect, useState, useRef } from 'react';
import { apiGet } from '@/lib/api';
import {
  FieldLabel, FInput, FSelect,
  SectionDivider, UNIT_TYPES, AREA_UNITS,
} from './shared';

// ── Searchable purchase picker (DB-backed) ─────────────────────────────────────
function PurchasePicker({ value, onChange, onPick }) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [display, setDisplay] = useState(null);
  const ref      = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (value && !display) {
      apiGet(`/lookup/purchases?id=${value}`).then(d => { if (d?.[0]) setDisplay(d[0]); }).catch(() => {});
    }
    if (!value) setDisplay(null);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = search.trim()
          ? `/lookup/purchases?search=${encodeURIComponent(search.trim())}&limit=10`
          : '/lookup/purchases?limit=3';
        const data = await apiGet(url);
        setResults(data || []);
      } catch { setResults([]); }
      finally  { setLoading(false); }
    }, search.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, search]);

  const code = (p) => p.purchase_code || `PUR-${String(p.id).padStart(4, '0')}`;

  const pick = (p) => {
    setDisplay(p || null);
    onChange({ target: { value: p ? String(p.id) : '' } });
    onPick?.(p || null);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition text-left flex items-center justify-between gap-2 min-h-[36px]">
        {display ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-1.5 py-0.5 rounded shrink-0">{code(display)}</span>
            <span className="text-gray-700 truncate">
              {display.plot_no || display.sl_no || display.type}
              {display.location ? ` · ${display.location}` : ''}
            </span>
          </span>
        ) : (
          <span className="text-gray-300">Select purchase…</span>
        )}
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-40 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by code, plot, location…"
                className="w-full border border-gray-200 rounded pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30" />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-[#875A7B]/30 border-t-[#875A7B] rounded-full animate-spin" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-5 text-sm text-gray-400 text-center">
                {search.trim() ? 'No purchases match' : 'No purchases found'}
              </p>
            ) : (
              <>
                {!search.trim() && (
                  <button type="button" onClick={() => pick(null)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 transition border-b border-gray-50">
                    — None —
                  </button>
                )}
                {results.map(p => {
                  const isActive = String(p.id) === String(value);
                  return (
                    <button key={p.id} type="button" onClick={() => pick(p)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition flex items-center gap-2.5 ${isActive ? 'bg-[#875A7B]/5' : ''}`}>
                      <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-1.5 py-0.5 rounded shrink-0">{code(p)}</span>
                      <span className="flex-1 min-w-0">
                        <span className="text-sm text-gray-800 font-medium">{p.plot_no || p.sl_no || p.type}</span>
                        {p.location && <span className="text-xs text-gray-400 ml-1.5">· {p.location}</span>}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0">{p.type}</span>
                      {isActive && (
                        <svg className="w-4 h-4 text-[#875A7B] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {!loading && (
            <div className="px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-400">
              {search.trim() ? `${results.length} result${results.length !== 1 ? 's' : ''} found` : 'Showing 3 recent · type to search all'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PurchaseDisplay({ form }) {
  const pur = form.purchase;
  if (!pur && !form.purchase_id) {
    return (
      <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm">
        <span className="text-gray-300">—</span>
      </div>
    );
  }
  const code = pur?.purchase_code || (form.purchase_id ? `PUR-${String(form.purchase_id).padStart(4,'0')}` : null);
  const plot = pur ? (pur.plot_no || pur.sl_no) : null;
  const loc  = pur?.location;
  return (
    <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm flex items-center gap-2">
      {code && <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-1.5 py-0.5 rounded">{code}</span>}
      {plot && <span className="text-gray-700 font-medium">{plot}</span>}
      {loc  && <span className="text-gray-400">· {loc}</span>}
      {!code && !plot && !loc && <span className="text-gray-500">Purchase #{form.purchase_id}</span>}
    </div>
  );
}

// ── Searchable project picker ─────────────────────────────────────────────────
function ProjectPicker({ value, onChange }) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [display, setDisplay] = useState(null);
  const ref      = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  useEffect(() => {
    if (value && !display) {
      apiGet(`/lookup/projects?id=${value}`).then(d => { if (d?.[0]) setDisplay(d[0]); }).catch(() => {});
    }
    if (!value) setDisplay(null);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = search.trim()
          ? `/lookup/projects?search=${encodeURIComponent(search.trim())}&limit=10`
          : '/lookup/projects?limit=5';
        setResults(await apiGet(url) || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, search.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, search]);

  const pick = (p) => {
    setDisplay(p || null);
    onChange({ target: { value: p ? String(p.id) : '' } });
    setOpen(false); setSearch('');
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition text-left flex items-center justify-between gap-2 min-h-[36px]">
        {display ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-1.5 py-0.5 rounded shrink-0">{display.project_code}</span>
            <span className="text-gray-700 truncate">{display.name}{display.location ? ` · ${display.location}` : ''}</span>
          </span>
        ) : (
          <span className="text-gray-300">Select project (optional)…</span>
        )}
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-40 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-full border border-gray-200 rounded pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-[#875A7B]" />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-[#875A7B]/30 border-t-[#875A7B] rounded-full animate-spin" />
                Searching…
              </div>
            ) : (
              <>
                <button type="button" onClick={() => pick(null)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-50">
                  — None —
                </button>
                {results.length === 0
                  ? <p className="px-3 py-5 text-sm text-gray-400 text-center">No projects found</p>
                  : results.map(p => (
                    <button key={p.id} type="button" onClick={() => pick(p)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2.5 ${String(p.id) === String(value) ? 'bg-[#875A7B]/5' : ''}`}>
                      <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-1.5 py-0.5 rounded shrink-0">{p.project_code}</span>
                      <span className="flex-1 min-w-0">
                        <span className="text-sm text-gray-800 font-medium">{p.name}</span>
                        {p.location && <span className="text-xs text-gray-400 ml-1.5">· {p.location}</span>}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.status === 'OPEN' ? 'bg-emerald-50 text-emerald-600' : p.status === 'ONGOING' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>{p.status}</span>
                    </button>
                  ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────────
export default function InventoryFormBody({ form, set, onPurchasePick, readOnly = false, isNew = false }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">

      {/* ── IDENTITY ─────────────────────────────────────────── */}
      <SectionDivider title="Identity" />

      {form.inventory_code && (
        <div>
          <FieldLabel>Inventory Code</FieldLabel>
          <div className="min-h-[36px] px-3 py-[7px] bg-[#875A7B]/5 rounded border border-[#875A7B]/20 text-sm font-semibold text-[#875A7B] tracking-wide">
            {form.inventory_code}
          </div>
        </div>
      )}

      <div>
        <FieldLabel required>Purchase</FieldLabel>
        {readOnly || !isNew ? <PurchaseDisplay form={form} /> : <PurchasePicker value={form.purchase_id} onChange={set('purchase_id')} onPick={onPurchasePick} />}
      </div>

      <div>
        <FieldLabel>Project</FieldLabel>
        {readOnly ? (
          <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">
            {form.project
              ? <span className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#875A7B] bg-[#875A7B]/10 px-1.5 py-0.5 rounded">{form.project.project_code}</span>
                  {form.project.name}
                </span>
              : <span className="text-gray-300">—</span>}
          </div>
        ) : (
          <ProjectPicker value={form.project_id} onChange={set('project_id')} />
        )}
      </div>

      <div>
        <FieldLabel required>Type</FieldLabel>
        <FSelect value={form.type} onChange={set('type')} readOnly={readOnly}>
          {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </FSelect>
      </div>

      {/* ── LOCATION DETAILS ─────────────────────────────────── */}
      <SectionDivider title="Location Details" />

      <div>
        <FieldLabel>SL No</FieldLabel>
        <FInput value={form.sl_no} onChange={set('sl_no')} placeholder="Survey / Serial number" readOnly={readOnly} autoFocus={!readOnly} />
      </div>

      <div>
        <FieldLabel>Location</FieldLabel>
        <FInput value={form.location} onChange={set('location')} placeholder="Location / area" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Plot No</FieldLabel>
        <FInput value={form.plot_no} onChange={set('plot_no')} placeholder="e.g. P-01, Lot-5" readOnly={readOnly} />
      </div>

      {/* ── AREA ─────────────────────────────────────────────── */}
      <SectionDivider title="Area" />

      <div>
        <FieldLabel>Area</FieldLabel>
        <FInput type="number" value={form.area} onChange={set('area')} placeholder="0" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Area Unit</FieldLabel>
        <FSelect value={form.area_unit} onChange={set('area_unit')} readOnly={readOnly}>
          <option value="">— Select —</option>
          {AREA_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </FSelect>
      </div>

      {/* ── REGISTRATION ─────────────────────────────────────── */}
      <SectionDivider title="Registration" />

      <div>
        <FieldLabel>Registration Date</FieldLabel>
        <FInput type="date" value={form.registration_date ? String(form.registration_date).split('T')[0] : ''} onChange={set('registration_date')} readOnly={readOnly} />
      </div>

    </div>
  );
}
