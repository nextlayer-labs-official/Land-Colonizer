'use client';

import { useEffect, useState } from 'react';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet } from '@/lib/api';

const fmt     = (n) => n == null ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN    = (n) => n == null ? '—' : parseFloat(Number(n).toFixed(4)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtNum  = (n) => n == null ? 0 : Number(n);

async function exportXlsx(sheets, filename) {
  const mod  = await import('xlsx');
  const XLSX = mod.default || mod;
  const wb   = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</span>
      <span className="text-lg font-bold text-gray-800">{value}</span>
    </div>
  );
}

function FilterRow({ children }) {
  return <div className="flex items-end gap-3 flex-wrap">{children}</div>;
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls  = "h-8 text-sm border border-gray-200 rounded px-2.5 focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition bg-white";
const selectCls = inputCls + " pr-7 appearance-none";

function RunBtn({ onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="h-8 px-5 text-sm rounded text-white font-medium transition self-end"
      style={{ backgroundColor: '#875A7B' }}>
      {loading ? 'Loading…' : 'Run Report'}
    </button>
  );
}

function PrintBtn() {
  return (
    <button onClick={() => window.print()}
      className="h-8 px-4 text-sm rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5 self-end print:hidden">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Print
    </button>
  );
}

function ExcelBtn({ onClick }) {
  return (
    <button onClick={onClick}
      className="h-8 px-4 text-sm rounded border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition flex items-center gap-1.5 self-end print:hidden">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Export Excel
    </button>
  );
}

// ── Sales Report ──────────────────────────────────────────────────────────────
function SalesReport() {
  const [filters, setFilters] = useState({ date_from: '', date_to: '', project_id: '', broker_id: '', status: '' });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [brokers,  setBrokers]  = useState([]);

  useEffect(() => {
    apiGet('/lookup/projects').then(d => setProjects(d || [])).catch(() => {});
    apiGet('/lookup/brokers').then(d => setBrokers(d || [])).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      setResult(await apiGet(`/reports/sales?${q}`));
    } finally { setLoading(false); }
  };

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const doExcel = async () => {
    if (!result) return;
    const rows = result.sales.map((s, i) => ({
      '#':            i + 1,
      'Sale Code':    s.sale_code || `SL-${String(s.id).padStart(4,'0')}`,
      'Customer':     s.customer?.name || '',
      'Project':      s.project?.name || '',
      'Broker':       s.broker?.name || '',
      'Total Area':   fmtNum(s.total_area),
      'Actual Price': fmtNum(s.actual_price),
      'Advance':      fmtNum(s.advance_payment),
      'Balance':      fmtNum(s.balance_amount),
      'Status':       s.sale_confirmed ? 'Confirmed' : 'Pending',
      'Date':         fmtDate(s.created_at),
    }));
    await exportXlsx([{ name: 'Sales', rows }], `sales_report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 print:hidden">
        <FilterRow>
          <Field label="From"><input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} className={inputCls} /></Field>
          <Field label="To"><input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} className={inputCls} /></Field>
          <Field label="Project">
            <select value={filters.project_id} onChange={e => set('project_id', e.target.value)} className={selectCls} style={{ minWidth: 140 }}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Broker">
            <select value={filters.broker_id} onChange={e => set('broker_id', e.target.value)} className={selectCls} style={{ minWidth: 140 }}>
              <option value="">All Brokers</option>
              {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.status} onChange={e => set('status', e.target.value)} className={selectCls} style={{ minWidth: 130 }}>
              <option value="">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
            </select>
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <><PrintBtn /><ExcelBtn onClick={doExcel} /></>}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <SummaryCard label="Total Sales"     value={result.summary.count} />
            <SummaryCard label="Total Value"     value={'₹ ' + fmt(result.summary.total_value)} />
            <SummaryCard label="Actual Price"    value={'₹ ' + fmt(result.summary.total_amount)} />
            <SummaryCard label="Advance Received" value={'₹ ' + fmt(result.summary.total_advance)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#','Sale Code','Customer','Project','Broker','Total Area','Actual Price','Advance','Balance','Status','Date'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.sales.length === 0 ? (
                  <tr><td colSpan={11} className="py-10 text-center text-sm text-gray-400">No sales found for the selected criteria</td></tr>
                ) : result.sales.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5"><span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{s.sale_code || `SL-${String(s.id).padStart(4,'0')}`}</span></td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{s.customer?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{s.project?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{s.broker?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fmtN(s.total_area)} sq.yd</td>
                    <td className="px-3 py-2.5 text-gray-800 font-medium">₹ {fmt(s.actual_price)}</td>
                    <td className="px-3 py-2.5 text-emerald-700">₹ {fmt(s.advance_payment)}</td>
                    <td className="px-3 py-2.5 text-orange-600">₹ {fmt(s.balance_amount)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.sale_confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.sale_confirmed ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        {s.sale_confirmed ? 'Confirmed' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Inventory Report ──────────────────────────────────────────────────────────
function InventoryReport() {
  const [filters, setFilters] = useState({ project_id: '', status: '', area_type: '' });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    apiGet('/lookup/projects').then(d => setProjects(d || [])).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      setResult(await apiGet(`/reports/inventory?${q}`));
    } finally { setLoading(false); }
  };

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const doExcel = async () => {
    if (!result) return;
    const rows = result.units.map((u, i) => ({
      '#':           i + 1,
      'Unit Code':   u.unit_code,
      'Project':     u.project?.name || '',
      'Type':        u.area_type || '',
      'Front Area':  fmtNum(u.front_area),
      'Back Area':   fmtNum(u.back_area),
      'Total Area':  fmtNum(u.total_area),
      'Rate/sq.yd':  fmtNum(u.rate_per_sqyd),
      'Total Value': fmtNum(u.total_value),
      'Status':      u.status,
    }));
    await exportXlsx([{ name: 'Inventory', rows }], `inventory_report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 print:hidden">
        <FilterRow>
          <Field label="Project">
            <select value={filters.project_id} onChange={e => set('project_id', e.target.value)} className={selectCls} style={{ minWidth: 160 }}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.status} onChange={e => set('status', e.target.value)} className={selectCls} style={{ minWidth: 130 }}>
              <option value="">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="SOLD">Sold</option>
              <option value="BOOKED">Booked</option>
            </select>
          </Field>
          <Field label="Area Type">
            <select value={filters.area_type} onChange={e => set('area_type', e.target.value)} className={selectCls} style={{ minWidth: 130 }}>
              <option value="">All Types</option>
              <option value="PLOT">Plot</option>
              <option value="SHOP">Shop</option>
              <option value="LAND">Land</option>
              <option value="FLAT">Flat</option>
              <option value="PLOT_WIRE">Plot Wire</option>
              <option value="SHOP_WIRE">Shop Wire</option>
            </select>
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <><PrintBtn /><ExcelBtn onClick={doExcel} /></>}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <SummaryCard label="Total Units" value={result.summary.count} />
            <SummaryCard label="Available"   value={result.summary.available} />
            <SummaryCard label="Sold"        value={result.summary.sold} />
            <SummaryCard label="Booked"      value={result.summary.booked} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <SummaryCard label="Total Area"  value={fmtN(result.summary.total_area) + ' sq.yd'} />
            <SummaryCard label="Total Value" value={'₹ ' + fmt(result.summary.total_value)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#','Unit Code','Project','Type','Front Area','Back Area','Total Area','Rate / sq.yd','Total Value','Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.units.length === 0 ? (
                  <tr><td colSpan={10} className="py-10 text-center text-sm text-gray-400">No inventory found</td></tr>
                ) : result.units.map((u, i) => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5"><span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{u.unit_code}</span></td>
                    <td className="px-3 py-2.5 text-gray-700">{u.project?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{u.area_type || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fmtN(u.front_area)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fmtN(u.back_area)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{fmtN(u.total_area)} sq.yd</td>
                    <td className="px-3 py-2.5 text-gray-700">₹ {fmt(u.rate_per_sqyd)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">₹ {fmt(u.total_value)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                        ${u.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700' : u.status === 'SOLD' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'AVAILABLE' ? 'bg-emerald-500' : u.status === 'SOLD' ? 'bg-red-500' : 'bg-amber-400'}`} />
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Purchase Report ───────────────────────────────────────────────────────────
function PurchaseReport() {
  const [filters, setFilters] = useState({ date_from: '', date_to: '', project_id: '' });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    apiGet('/lookup/projects').then(d => setProjects(d || [])).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      setResult(await apiGet(`/reports/purchases?${q}`));
    } finally { setLoading(false); }
  };

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const doExcel = async () => {
    if (!result) return;
    const rows = result.purchases.map((p, i) => ({
      '#':             i + 1,
      'Purchase Code': p.purchase_code || `PUR-${String(p.id).padStart(4,'0')}`,
      'Project':       p.project?.name || '',
      'Seller':        p.seller_name || '',
      'Total Area':    fmtNum(p.total_area),
      'Rate':          fmtNum(p.rate_per_sqyd),
      'Total Cost':    fmtNum(p.total_cost),
      'Purchase Date': fmtDate(p.purchase_date),
    }));
    await exportXlsx([{ name: 'Purchases', rows }], `purchase_report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 print:hidden">
        <FilterRow>
          <Field label="From"><input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} className={inputCls} /></Field>
          <Field label="To"><input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} className={inputCls} /></Field>
          <Field label="Project">
            <select value={filters.project_id} onChange={e => set('project_id', e.target.value)} className={selectCls} style={{ minWidth: 160 }}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <><PrintBtn /><ExcelBtn onClick={doExcel} /></>}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SummaryCard label="Total Purchases" value={result.summary.count} />
            <SummaryCard label="Total Area"      value={fmtN(result.summary.total_area) + ' sq.yd'} />
            <SummaryCard label="Total Cost"      value={'₹ ' + fmt(result.summary.total_cost)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#','Purchase Code','Project','Seller','Total Area','Rate','Total Cost','Purchase Date'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.purchases.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-sm text-gray-400">No purchases found</td></tr>
                ) : result.purchases.map((p, i) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5"><span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{p.purchase_code || `PUR-${String(p.id).padStart(4,'0')}`}</span></td>
                    <td className="px-3 py-2.5 text-gray-700">{p.project?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{p.seller_name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fmtN(p.total_area)} sq.yd</td>
                    <td className="px-3 py-2.5 text-gray-600">₹ {fmt(p.rate_per_sqyd)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">₹ {fmt(p.total_cost)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDate(p.purchase_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Broker Report ─────────────────────────────────────────────────────────────
function BrokerReport() {
  const [filters, setFilters] = useState({ date_from: '', date_to: '', broker_id: '' });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [brokers, setBrokers] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    apiGet('/lookup/brokers').then(d => setBrokers(d || [])).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true); setExpanded({});
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      setResult(await apiGet(`/reports/brokers?${q}`));
    } finally { setLoading(false); }
  };

  const set    = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const toggle = (id)   => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const doExcel = async () => {
    if (!result) return;
    const rows = [];
    for (const b of result.brokers) {
      if (b.sales.length === 0) {
        rows.push({ Broker: b.name, Phone: b.phone || '', 'Sale Code': '', Customer: '', Project: '', Status: '', 'Total Value': 0 });
      } else {
        for (const s of b.sales) {
          rows.push({
            Broker:        b.name,
            Phone:         b.phone || '',
            'Sale Code':   s.sale_code || `SL-${String(s.id).padStart(4,'0')}`,
            Customer:      s.customer?.name || '',
            Project:       s.project?.name || '',
            Status:        s.sale_confirmed ? 'Confirmed' : 'Pending',
            'Total Value': fmtNum(s.actual_price),
          });
        }
      }
    }
    await exportXlsx([{ name: 'Brokers', rows }], `broker_report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 print:hidden">
        <FilterRow>
          <Field label="From"><input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} className={inputCls} /></Field>
          <Field label="To"><input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} className={inputCls} /></Field>
          <Field label="Broker">
            <select value={filters.broker_id} onChange={e => set('broker_id', e.target.value)} className={selectCls} style={{ minWidth: 160 }}>
              <option value="">All Brokers</option>
              {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <><PrintBtn /><ExcelBtn onClick={doExcel} /></>}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SummaryCard label="Brokers"     value={result.summary.broker_count} />
            <SummaryCard label="Total Sales" value={result.summary.total_sales} />
            <SummaryCard label="Total Value" value={'₹ ' + fmt(result.summary.total_value)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['','#','Broker','Phone','Sales Count','Total Value'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.brokers.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">No broker data found</td></tr>
                ) : result.brokers.map((b, i) => (
                  <>
                    <tr key={b.id} className={`border-b border-gray-100 ${b.sales_count > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      onClick={() => b.sales_count > 0 && toggle(b.id)}>
                      <td className="px-3 py-2.5 w-8">
                        {b.sales_count > 0 && (
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded[b.id] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{b.name}</td>
                      <td className="px-3 py-2.5 text-gray-500">{b.phone || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                          {b.sales_count} sale{b.sales_count !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">₹ {fmt(b.total_value)}</td>
                    </tr>
                    {expanded[b.id] && b.sales.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 bg-gray-50/60">
                        <td className="px-3 py-2" /><td className="px-3 py-2" />
                        <td className="px-3 py-2 pl-6">
                          <span className="font-mono text-xs text-[#875A7B]">{s.sale_code || `SL-${String(s.id).padStart(4,'0')}`}</span>
                          <span className="text-xs text-gray-500 ml-2">{s.customer?.name}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">{s.project?.name}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${s.sale_confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {s.sale_confirmed ? 'Confirmed' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700">₹ {fmt(s.actual_price)}</td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Instalments Report ────────────────────────────────────────────────────────
function InstalmentsReport() {
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandP, setExpandP] = useState({});
  const [expandS, setExpandS] = useState({});

  const run = async () => {
    setLoading(true); setExpandP({}); setExpandS({});
    try { setResult(await apiGet('/reports/instalments')); }
    finally { setLoading(false); }
  };

  const doExcel = async () => {
    if (!result) return;
    const purchaseRows = [];
    for (const r of result.purchase_pending) {
      for (const inst of r.pending_instalments) {
        purchaseRows.push({
          'Purchase Code': r.purchase_code,
          'Seller':        r.seller || '',
          'Project':       r.project?.name || '',
          'Inst #':        inst.no,
          'Amount':        inst.amount,
          'Due Date':      inst.date ? fmtDate(inst.date) : '',
          'Already Paid':  fmtNum(r.paid_amount),
        });
      }
    }
    const saleRows = [];
    for (const r of result.sale_pending) {
      for (const inst of r.pending_instalments) {
        saleRows.push({
          'Sale Code':    r.sale_code,
          'Customer':     r.customer?.name || '',
          'Phone':        r.customer?.phone || '',
          'Project':      r.project?.name || '',
          'Inst #':       inst.no,
          'Amount':       inst.amount,
          'Due Date':     inst.date ? fmtDate(inst.date) : '',
          'Already Paid': fmtNum(r.paid_amount),
        });
      }
    }
    await exportXlsx(
      [
        { name: 'Purchase Pending', rows: purchaseRows.length ? purchaseRows : [{ Note: 'No pending instalments' }] },
        { name: 'Sale Pending',     rows: saleRows.length     ? saleRows     : [{ Note: 'No pending instalments' }] },
      ],
      `instalments_report_${new Date().toISOString().slice(0,10)}.xlsx`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4 print:hidden">
        <FilterRow>
          <RunBtn onClick={run} loading={loading} />
          {result && <><PrintBtn /><ExcelBtn onClick={doExcel} /></>}
        </FilterRow>
      </div>

      {result && (
        <>
          {/* ── A: Purchase Pending ── */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">A · Pending to Seller</h2>
              <span className="text-xs text-gray-400">instalments we still owe the seller (from Purchase)</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <SummaryCard label="Purchases with Pending" value={result.purchase_summary.count} />
              <SummaryCard label="Already Paid"           value={'₹ ' + fmt(result.purchase_summary.total_paid)} />
              <SummaryCard label="Total Pending"          value={'₹ ' + fmt(result.purchase_summary.total_pending)} />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-orange-50/60">
                    {['','#','Purchase','Seller','Project','Paid (Inst.)','Pending','Instalments'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.purchase_pending.length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-sm text-gray-400">No pending purchase instalments</td></tr>
                  ) : result.purchase_pending.map((r, i) => (
                    <>
                      <tr key={r.id} className="border-b border-gray-100 cursor-pointer hover:bg-orange-50/30"
                        onClick={() => setExpandP(e => ({ ...e, [r.id]: !e[r.id] }))}>
                        <td className="px-3 py-2.5 w-8">
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandP[r.id] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5"><span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{r.purchase_code}</span></td>
                        <td className="px-3 py-2.5 text-gray-600 text-xs max-w-[160px] truncate">{r.seller || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{r.project?.name || '—'}</td>
                        <td className="px-3 py-2.5 text-emerald-700">₹ {fmt(r.paid_amount)}</td>
                        <td className="px-3 py-2.5 font-semibold text-orange-600">₹ {fmt(r.pending_amount)}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 ring-1 ring-orange-200">
                            {r.pending_instalments.length} pending
                          </span>
                        </td>
                      </tr>
                      {expandP[r.id] && r.pending_instalments.map(inst => (
                        <tr key={inst.no} className="border-b border-gray-50 bg-orange-50/20">
                          <td /><td />
                          <td className="px-3 py-2 pl-8 text-xs text-gray-500 font-medium" colSpan={2}>Instalment #{inst.no}</td>
                          <td />
                          <td />
                          <td className="px-3 py-2 text-sm font-semibold text-orange-700">₹ {fmt(inst.amount)}</td>
                          <td className="px-3 py-2 text-xs text-gray-400">{inst.date ? fmtDate(inst.date) : 'No due date'}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── B: Sale Pending ── */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">B · Pending from Customer</h2>
              <span className="text-xs text-gray-400">instalments customers still owe us (from Sale)</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <SummaryCard label="Sales with Pending" value={result.sale_summary.count} />
              <SummaryCard label="Already Received"   value={'₹ ' + fmt(result.sale_summary.total_paid)} />
              <SummaryCard label="Total Pending"      value={'₹ ' + fmt(result.sale_summary.total_pending)} />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-blue-50/60">
                    {['','#','Sale','Customer','Project','Received (Inst.)','Pending','Instalments'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.sale_pending.length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-sm text-gray-400">No pending sale instalments</td></tr>
                  ) : result.sale_pending.map((r, i) => (
                    <>
                      <tr key={r.id} className="border-b border-gray-100 cursor-pointer hover:bg-blue-50/30"
                        onClick={() => setExpandS(e => ({ ...e, [r.id]: !e[r.id] }))}>
                        <td className="px-3 py-2.5 w-8">
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandS[r.id] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5"><span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{r.sale_code}</span></td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">
                          {r.customer?.name || '—'}
                          {r.customer?.phone && <p className="text-[10px] text-gray-400 font-normal">{r.customer.phone}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{r.project?.name || '—'}</td>
                        <td className="px-3 py-2.5 text-emerald-700">₹ {fmt(r.paid_amount)}</td>
                        <td className="px-3 py-2.5 font-semibold text-blue-700">₹ {fmt(r.pending_amount)}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                            {r.pending_instalments.length} pending
                          </span>
                        </td>
                      </tr>
                      {expandS[r.id] && r.pending_instalments.map(inst => (
                        <tr key={inst.no} className="border-b border-gray-50 bg-blue-50/20">
                          <td /><td />
                          <td className="px-3 py-2 pl-8 text-xs text-gray-500 font-medium" colSpan={2}>Instalment #{inst.no}</td>
                          <td />
                          <td />
                          <td className="px-3 py-2 text-sm font-semibold text-blue-700">₹ {fmt(inst.amount)}</td>
                          <td className="px-3 py-2 text-xs text-gray-400">{inst.date ? fmtDate(inst.date) : 'No due date'}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Availability Report ───────────────────────────────────────────────────────
function AvailabilityReport() {
  const [filters, setFilters] = useState({ purchase_id: '', project_id: '', status: '', created_by_id: '' });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    apiGet('/lookup/plots').then(d => setPurchases(d || [])).catch(() => {});
    apiGet('/lookup/projects').then(d => setProjects(d || [])).catch(() => {});
    apiGet('/lookup/users').then(d => setEmployees(d || [])).catch(() => {});
  }, []);

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      setResult(await apiGet(`/reports/availability?${q}`));
    } finally { setLoading(false); }
  };

  const doExcel = async () => {
    if (!result) return;
    const rows = result.units.map((u, i) => ({
      '#':           i + 1,
      'SL No.':      u.sl_no   || '',
      'Plot No.':    u.plot_no || '',
      'Total Area':  fmtNum(u.total_area),
      'Status':      u.status,
      'Added By':    u.created_by_name || '',
    }));
    await exportXlsx([{ name: 'Availability', rows }], `availability_report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const statusBadge = (status) => {
    const map = {
      AVAILABLE:  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500',  label: 'Available'   },
      SOLD:       { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500',       label: 'Sold'        },
      RESERVED:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',     label: 'Reserved'    },
      REGISTERED: { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',      label: 'Registered'  },
    };
    const s = map[status] || { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400', label: status };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  };

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 print:hidden">
        <FilterRow>
          <Field label="Purchase">
            <select value={filters.purchase_id} onChange={e => set('purchase_id', e.target.value)} className={selectCls} style={{ minWidth: 200 }}>
              <option value="">All Purchases</option>
              {purchases.map(p => (
                <option key={p.id} value={p.id}>
                  {p.purchase_code || p.plot_no || `PUR-${String(p.id).padStart(4,'0')}`}
                  {p.location ? ` · ${p.location}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Project">
            <select value={filters.project_id} onChange={e => set('project_id', e.target.value)} className={selectCls} style={{ minWidth: 160 }}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.status} onChange={e => set('status', e.target.value)} className={selectCls} style={{ minWidth: 130 }}>
              <option value="">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="SOLD">Sold</option>
              <option value="RESERVED">Reserved</option>
              <option value="REGISTERED">Registered</option>
            </select>
          </Field>
          <Field label="Employee">
            <select value={filters.created_by_id} onChange={e => set('created_by_id', e.target.value)} className={selectCls} style={{ minWidth: 160 }}>
              <option value="">All Employees</option>
              {employees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <><PrintBtn /><ExcelBtn onClick={doExcel} /></>}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <SummaryCard label="Total Units" value={result.summary.count} />
            <SummaryCard label="Available"   value={result.summary.available} />
            <SummaryCard label="Sold"        value={result.summary.sold} />
            <SummaryCard label="Reserved"    value={result.summary.reserved} />
            <SummaryCard label="Registered"  value={result.summary.registered} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#', 'SL No.', 'Plot No.', 'Total Area', 'Status', 'Added By'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.units.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">No inventory found</td></tr>
                ) : result.units.map((u, i) => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5 text-gray-700">{u.sl_no   || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{u.plot_no || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{u.total_area ? fmtN(u.total_area) + ' sq.yd' : '—'}</td>
                    <td className="px-3 py-2.5">{statusBadge(u.status)}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{u.created_by_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'sales',        label: 'Sales Report' },
  { id: 'inventory',    label: 'Inventory Report' },
  { id: 'purchases',    label: 'Purchase Report' },
  { id: 'brokers',      label: 'Broker Report' },
  { id: 'instalments',  label: 'Instalments Report' },
  { id: 'availability', label: 'Availability Report' },
];

export default function ReportsPage() {
  useAuth();
  const { can, me } = usePermissions();
  const [tab, setTab] = useState('sales');

  if (!can('REPORTS_VIEW') && !me?.is_system) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        You don't have permission to view reports.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-200 px-4 py-0 flex items-center gap-0 print:hidden overflow-x-auto" style={{ minHeight: 44 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-[#875A7B] text-[#875A7B]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === 'sales'        && <SalesReport />}
        {tab === 'inventory'    && <InventoryReport />}
        {tab === 'purchases'    && <PurchaseReport />}
        {tab === 'brokers'      && <BrokerReport />}
        {tab === 'instalments'  && <InstalmentsReport />}
        {tab === 'availability' && <AvailabilityReport />}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .flex-1.overflow-auto, .flex-1.overflow-auto * { visibility: visible; }
          .flex-1.overflow-auto { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
