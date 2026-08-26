'use client';

import { useEffect, useState } from 'react';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet } from '@/lib/api';

const TYPE_LABEL = { PLOT: 'Plot', LAND: 'Land', SHOP: 'Shop', SCO: 'S.C.O', FLAT: 'Flat' };
const TYPE_BADGE = {
  PLOT: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  LAND: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  SHOP: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  SCO:  'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
  FLAT: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
};

const fmt     = (n) => { if (n == null) return '—'; const v = Number(n); const d = v % 1 === 0 ? 0 : 2; return v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: 2 }); };
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
const POSSESSION_STYLE = {
  PENDING:  'bg-amber-50 text-amber-700',
  SYMBOLIC: 'bg-blue-50 text-blue-700',
  PHYSICAL: 'bg-emerald-50 text-emerald-700',
};

function SalesReport() {
  const [filters, setFilters] = useState({ date_from: '', date_to: '', project_id: '', broker_id: '', status: '', possession: '', sold_by_id: '', facing: '' });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects,  setProjects]  = useState([]);
  const [brokers,   setBrokers]   = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    apiGet('/lookup/projects?limit=500').then(d => setProjects(d || [])).catch(() => {});
    apiGet('/lookup/brokers?limit=500').then(d => setBrokers(d || [])).catch(() => {});
    apiGet('/lookup/users').then(d => setEmployees(d || [])).catch(() => {});
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
      '#':                   i + 1,
      'Sale Code':           s.sale_code || `SL-${String(s.id).padStart(4,'0')}`,
      'Customer':            s.customer?.name || '',
      'Broker':              s.broker?.name || '',
      'Project':             s.project?.name || '',
      'Inventory Unit':      s.inventory_unit || '',
      'Total Area':          fmtNum(s.total_area),
      'Facing':              s.facing || '',
      'Plot Rate':           fmtNum(s.plot_rate),
      'Total Value':         fmtNum(s.total_value),
      'Selling Rate':        fmtNum(s.selling_rate),
      'Actual Price':        fmtNum(s.actual_price),
      'Balance':             fmtNum(s.balance_amount),
      'Status':              s.full_final_completed ? 'Full and Final' : s.attorney_completed ? 'Attorney' : s.registration_completed ? 'Registered' : s.status === 'ACTIVE' ? 'Active' : 'Inactive',
      'Date of Registration': fmtDate(s.date_of_registration),
      'Intkaal Number':      s.intkaal_number || '',
      'Vasika':              s.vasika || '',
      'Possession':          s.possession || '',
      'Entry By':            s.sold_by_name || '',
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="registered">Registered</option>
              <option value="attorney">Attorney</option>
              <option value="full_final">Full &amp; Final</option>
            </select>
          </Field>
          <Field label="Possession">
            <select value={filters.possession} onChange={e => set('possession', e.target.value)} className={selectCls} style={{ minWidth: 120 }}>
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="PHYSICAL">Physical</option>
              <option value="SYMBOLIC">Symbolic</option>
            </select>
          </Field>
          <Field label="Entry By">
            <select value={filters.sold_by_id} onChange={e => set('sold_by_id', e.target.value)} className={selectCls} style={{ minWidth: 150 }}>
              <option value="">All Employees</option>
              {employees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Facing">
            <input type="text" value={filters.facing} onChange={e => set('facing', e.target.value)} className={inputCls} placeholder="e.g. North" style={{ minWidth: 110 }} />
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <><PrintBtn /><ExcelBtn onClick={doExcel} /></>}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <SummaryCard label="Total Sales"   value={result.summary.count} />
            <SummaryCard label="Total Value"   value={'₹ ' + fmt(result.summary.total_value)} />
            <SummaryCard label="Actual Price"  value={'₹ ' + fmt(result.summary.actual_price)} />
            <SummaryCard label="Balance Due"   value={'₹ ' + fmt(result.summary.total_balance)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-[70vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#','Sale Code','Customer','Broker','Project','Unit','Total Area','Facing','Plot Rate','Total Value','Selling Rate','Actual Price','Balance','Status','Reg. Date','Intkaal No.','Vasika','Possession','Entry By'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.sales.length === 0 ? (
                  <tr><td colSpan={19} className="py-10 text-center text-sm text-gray-400">No sales found for the selected criteria</td></tr>
                ) : result.sales.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{s.sale_code || `SL-${String(s.id).padStart(4,'0')}`}</span></td>
                    <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{s.customer?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{s.broker?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{s.project?.name || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="font-mono text-xs text-gray-600">{s.inventory_unit || '—'}</span></td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{s.total_area ? fmtN(s.total_area) + (s.total_area_details ? ' ' + s.total_area_details : '') : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{s.facing || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{s.plot_rate ? '₹ ' + fmt(s.plot_rate) : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{s.total_value ? '₹ ' + fmt(s.total_value) : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{s.selling_rate ? '₹ ' + fmt(s.selling_rate) : '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{s.actual_price ? '₹ ' + fmt(s.actual_price) : '—'}</td>
                    <td className="px-3 py-2.5 text-orange-600 whitespace-nowrap">{s.balance_amount ? '₹ ' + fmt(s.balance_amount) : '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.full_final_completed ? 'bg-violet-50 text-violet-700' : s.attorney_completed ? 'bg-indigo-50 text-indigo-700' : s.registration_completed ? 'bg-blue-50 text-blue-700' : s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.full_final_completed ? 'bg-violet-500' : s.attorney_completed ? 'bg-indigo-500' : s.registration_completed ? 'bg-blue-500' : s.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {s.full_final_completed ? 'Full and Final' : s.attorney_completed ? 'Attorney' : s.registration_completed ? 'Registered' : s.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDate(s.date_of_registration)}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{s.intkaal_number || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{s.vasika || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${POSSESSION_STYLE[s.possession] || 'bg-gray-100 text-gray-500'}`}>
                        {s.possession ? s.possession.charAt(0) + s.possession.slice(1).toLowerCase() : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{s.sold_by_name || '—'}</td>
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
  const [filters, setFilters] = useState({ project_id: '', status: '', area_type: '', facing: '' });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    apiGet('/lookup/projects?limit=500').then(d => setProjects(d || [])).catch(() => {});
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
      'Plot No':     u.plot_no || '',
      'Project':     u.project?.name || '',
      'Type':        u.area_type || '',
      'Facing':      u.facing || '',
      'Front Area':  fmtNum(u.front_area),
      'Back Area':   fmtNum(u.back_area),
      'Total Area':  fmtNum(u.total_area),
      'Rate/Unit':   fmtNum(u.rate_per_sqyd),
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
              <option value="RESERVED">Reserved</option>
              <option value="REGISTERED">Registered</option>
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
          <Field label="Facing">
            <input type="text" value={filters.facing} onChange={e => set('facing', e.target.value)} className={inputCls} placeholder="e.g. North" style={{ minWidth: 110 }} />
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
          <div className="grid grid-cols-2 gap-3 mb-4">
            <SummaryCard label="Total Area"  value={fmtN(result.summary.total_area)} />
            <SummaryCard label="Total Value" value={'₹ ' + fmt(result.summary.total_value)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-[70vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#','Unit Code','Plot No','Project','Type','Facing','Front Area','Back Area','Total Area','Rate / Unit','Total Value','Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.units.length === 0 ? (
                  <tr><td colSpan={12} className="py-10 text-center text-sm text-gray-400">No inventory found</td></tr>
                ) : result.units.map((u, i) => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5"><span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{u.unit_code}</span></td>
                    <td className="px-3 py-2.5 text-gray-700 font-medium">{u.plot_no || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{u.project?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{u.area_type || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{u.facing || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fmtN(u.front_area)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fmtN(u.back_area)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{fmtN(u.total_area)}{u.area_unit ? ' ' + u.area_unit : ''}</td>
                    <td className="px-3 py-2.5 text-gray-700">₹ {fmt(u.rate_per_sqyd)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">₹ {fmt(u.total_value)}</td>
                    <td className="px-3 py-2.5">
                      {(() => {
                        const sc = { AVAILABLE: 'bg-emerald-50 text-emerald-700', SOLD: 'bg-red-50 text-red-700', RESERVED: 'bg-amber-50 text-amber-700', REGISTERED: 'bg-blue-50 text-blue-700' };
                        const sd = { AVAILABLE: 'bg-emerald-500', SOLD: 'bg-red-500', RESERVED: 'bg-amber-400', REGISTERED: 'bg-blue-500' };
                        const sl = { AVAILABLE: 'Available', SOLD: 'Sold', RESERVED: 'Reserved', REGISTERED: 'Registered' };
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc[u.status] || 'bg-gray-50 text-gray-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sd[u.status] || 'bg-gray-400'}`} />
                            {sl[u.status] || u.status}
                          </span>
                        );
                      })()}
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
const STAGE_STYLE = {
  'Draft':       'bg-gray-100 text-gray-500',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  'Registered':  'bg-blue-100 text-blue-700',
  'Completed':   'bg-green-100 text-green-700',
};

function PurchaseReport() {
  const [filters, setFilters] = useState({ date_from: '', date_to: '', category: '', type: '', status: '' });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);

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
      '#':                i + 1,
      'Purchase Code':    p.purchase_code || `PUR-${String(p.id).padStart(4,'0')}`,
      'Category':         p.purchase_category || '',
      'Type':             p.type || '',
      'Status':           p.status || '',
      'SL No.':           p.sl_no || '',
      'Location':         p.location || '',
      'Purchased Area':   fmtNum(p.purchased_area),
      'Total Amount':     fmtNum(p.total_amount),
      'Advance Paid':     fmtNum(p.advance_paid),
      'Total Cost':       fmtNum(p.total_cost),
      'Balance to Pay':   fmtNum(p.balance_to_pay),
      'Stage':            p.stage || '',
      'Registration Date': fmtDate(p.registration_date),
    }));
    await exportXlsx([{ name: 'Purchases', rows }], `purchase_report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 print:hidden">
        <FilterRow>
          <Field label="From"><input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} className={inputCls} /></Field>
          <Field label="To"><input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} className={inputCls} /></Field>
          <Field label="Category">
            <select value={filters.category} onChange={e => set('category', e.target.value)} className={selectCls}>
              <option value="">All</option>
              <option value="SINGLE">Single</option>
              <option value="DIVIDED">Divided</option>
            </select>
          </Field>
          <Field label="Type">
            <select value={filters.type} onChange={e => set('type', e.target.value)} className={selectCls}>
              <option value="">All</option>
              <option value="PLOT">Plot</option>
              <option value="LAND">Land</option>
              <option value="SHOP">Shop</option>
              <option value="SCO">S.C.O</option>
              <option value="FLAT">Flat</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.status} onChange={e => set('status', e.target.value)} className={selectCls}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <><PrintBtn /><ExcelBtn onClick={doExcel} /></>}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <SummaryCard label="Total Purchases" value={result.summary.count} />
            <SummaryCard label="Total Area"      value={fmtN(result.summary.total_area)} />
            <SummaryCard label="Total Amount"    value={'₹ ' + fmt(result.summary.total_amount)} />
            <SummaryCard label="Total Cost"      value={'₹ ' + fmt(result.summary.total_cost)} />
            <SummaryCard label="Balance to Pay"  value={'₹ ' + fmt(result.summary.total_balance)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-[70vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#','Purchase Code','Category','Type','Status','SL No.','Location','Purchased Area','Total Amount','Advance Paid','Total Cost','Balance to Pay','Stage','Reg. Date'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.purchases.length === 0 ? (
                  <tr><td colSpan={14} className="py-10 text-center text-sm text-gray-400">No purchases found</td></tr>
                ) : result.purchases.map((p, i) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{p.purchase_code || `PUR-${String(p.id).padStart(4,'0')}`}</span></td>
                    <td className="px-3 py-2.5 text-gray-600 capitalize">{p.purchase_category ? p.purchase_category.charAt(0) + p.purchase_category.slice(1).toLowerCase() : '—'}</td>
                    <td className="px-3 py-2.5"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE[p.type] || 'bg-gray-100 text-gray-500'}`}>{TYPE_LABEL[p.type] || p.type || '—'}</span></td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.status ? p.status.charAt(0) + p.status.slice(1).toLowerCase() : '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{p.sl_no || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[140px] truncate">{p.location || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{p.purchased_area ? fmtN(p.purchased_area) + (p.purchased_area_details ? ' ' + p.purchased_area_details : '') : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{p.total_amount ? '₹ ' + fmt(p.total_amount) : '—'}</td>
                    <td className="px-3 py-2.5 text-emerald-700 whitespace-nowrap">{p.advance_paid ? '₹ ' + fmt(p.advance_paid) : '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{p.total_cost ? '₹ ' + fmt(p.total_cost) : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{p.balance_to_pay ? '₹ ' + fmt(p.balance_to_pay) : '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_STYLE[p.stage] || ''}`}>{p.stage}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDate(p.registration_date)}</td>
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
  const [filters, setFilters] = useState({ date_from: '', date_to: '', broker_id: '', project_id: '', purchase_id: '' });
  const [result,    setResult]   = useState(null);
  const [loading,   setLoading]  = useState(false);
  const [brokers,   setBrokers]  = useState([]);
  const [projects,  setProjects] = useState([]);
  const [purchases, setPurchases]= useState([]);
  const [brokerTab, setBrokerTab]= useState('sales');
  const [expanded,  setExpanded] = useState({});

  useEffect(() => {
    apiGet('/lookup/brokers?limit=500').then(d  => setBrokers(d  || [])).catch(() => {});
    apiGet('/lookup/projects?limit=500').then(d => setProjects(d || [])).catch(() => {});
    apiGet('/lookup/purchases?limit=500').then(d => setPurchases(d || [])).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      setResult(await apiGet(`/reports/brokers?${q}`));
    } finally { setLoading(false); }
  };

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));
  const switchTab = (tab) => {
    setBrokerTab(tab); setResult(null); setExpanded({});
    setFilters(f => tab === 'sales' ? { ...f, purchase_id: '' } : { ...f, project_id: '' });
  };

  const doExcel = async () => {
    if (!result) return;
    const salesRows = [], purchaseRows = [];
    for (const b of result.brokers) {
      for (const s of b.sales) {
        salesRows.push({
          Broker:       b.name,
          'Sale Code':  s.sale_code || `SL-${String(s.id).padStart(4,'0')}`,
          Customer:     s.customer?.name || '',
          Project:      s.project?.name || '',
          'Plot No':    s.plot_no || '',
          Area:         s.area ? `${s.area} ${s.area_unit}` : '',
          Brokerage:    fmtNum(s.brokerage),
        });
      }
      for (const p of b.purchases) {
        purchaseRows.push({
          Broker:          b.name,
          'Purchase Code': p.purchase_code || `PUR-${String(p.id).padStart(4,'0')}`,
          'Plot No':       p.plot_no || '',
          Location:        p.location || '',
          Area:            p.purchased_area ? `${p.purchased_area} ${p.purchased_area_details || ''}` : '',
          Brokerage:       fmtNum(p.brokerage),
        });
      }
    }
    await exportXlsx(
      [{ name: 'Sales', rows: salesRows }, { name: 'Purchases', rows: purchaseRows }],
      `broker_report_${new Date().toISOString().slice(0,10)}.xlsx`
    );
  };

  return (
    <div>
      {/* ── Tabs — always visible ── */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-lg overflow-hidden print:hidden">
        {[
          { key: 'sales',     label: 'Sales',     color: 'violet' },
          { key: 'purchases', label: 'Purchases', color: 'amber'  },
        ].map(t => (
          <button key={t.key} onClick={() => switchTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${
              brokerTab === t.key
                ? t.color === 'violet' ? 'border-violet-600 text-violet-700' : 'border-amber-500 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Filters — tab-aware ── */}
      <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg p-4 mb-4 print:hidden">
        <FilterRow>
          <Field label="From"><input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} className={inputCls} /></Field>
          <Field label="To"><input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} className={inputCls} /></Field>
          <Field label="Broker">
            <select value={filters.broker_id} onChange={e => set('broker_id', e.target.value)} className={selectCls} style={{ minWidth: 150 }}>
              <option value="">All Brokers</option>
              {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          {brokerTab === 'sales' && (
            <Field label="Project">
              <select value={filters.project_id} onChange={e => set('project_id', e.target.value)} className={selectCls} style={{ minWidth: 150 }}>
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
          {brokerTab === 'purchases' && (
            <Field label="Purchase">
              <select value={filters.purchase_id} onChange={e => set('purchase_id', e.target.value)} className={selectCls} style={{ minWidth: 150 }}>
                <option value="">All Purchases</option>
                {purchases.map(p => <option key={p.id} value={p.id}>{p.purchase_code || p.location || `PUR-${p.id}`}</option>)}
              </select>
            </Field>
          )}
          <RunBtn onClick={run} loading={loading} />
          {result && <><PrintBtn /><ExcelBtn onClick={doExcel} /></>}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 print:hidden">
            <SummaryCard label="Brokers"         value={result.summary.broker_count} />
            <SummaryCard label="Total Sales"     value={result.summary.total_sales} />
            <SummaryCard label="Total Purchases" value={result.summary.total_purchases} />
            <SummaryCard label="Total Brokerage" value={'₹ ' + fmt(result.summary.total_brokerage)} />
          </div>

          {/* ── Sales tab ── */}
          {brokerTab === 'sales' && (
            <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg overflow-auto max-h-[70vh]">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col style={{width:32}}/>
                  <col style={{width:36}}/>
                  <col style={{width:160}}/>
                  <col style={{width:80}}/>
                  <col style={{width:120}}/>
                </colgroup>
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    {['','#','Broker','Sales','Sale Brokerage'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.brokers.filter(b => b.sales_count > 0).length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">No sale brokerage records found</td></tr>
                  ) : result.brokers.filter(b => b.sales_count > 0).map((b, i) => (
                    <>
                      <tr key={b.id} className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                        onClick={() => toggle(b.id)}>
                        <td className="px-3 py-2.5">
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded[b.id] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">{b.name}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-200">{b.sales_count}</span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-violet-700">₹ {fmt(b.sales_brokerage)}</td>
                      </tr>
                      {expanded[b.id] && (
                        <>
                          <tr className="bg-violet-50/40">
                            <td/><td/>
                            <td className="px-3 py-1 text-[10px] font-bold text-violet-500 uppercase tracking-widest">Sale Code · Customer</td>
                            <td className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Project · Plot No · Area</td>
                            <td className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Brokerage</td>
                          </tr>
                          {b.sales.map(s => (
                            <tr key={`s-${s.id}`} className="border-b border-gray-50 bg-violet-50/20 text-xs">
                              <td/><td/>
                              <td className="px-3 py-2">
                                <span className="font-mono font-semibold text-violet-700">{s.sale_code || `SL-${String(s.id).padStart(4,'0')}`}</span>
                                <span className="text-gray-500 ml-2">{s.customer?.name || '—'}</span>
                              </td>
                              <td className="px-3 py-2 text-gray-500">
                                {s.project?.name || '—'} · {s.plot_no || '—'} · {s.area ? `${s.area} ${s.area_unit || ''}` : '—'}
                              </td>
                              <td className="px-3 py-2 font-semibold text-violet-700 whitespace-nowrap">₹ {fmt(s.brokerage)}</td>
                            </tr>
                          ))}
                        </>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Purchases tab ── */}
          {brokerTab === 'purchases' && (
            <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg overflow-auto max-h-[70vh]">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col style={{width:32}}/>
                  <col style={{width:36}}/>
                  <col style={{width:160}}/>
                  <col style={{width:80}}/>
                  <col style={{width:120}}/>
                </colgroup>
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    {['','#','Broker','Purchases','Purchase Brokerage'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.brokers.filter(b => b.purchases_count > 0).length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">No purchase brokerage records found</td></tr>
                  ) : result.brokers.filter(b => b.purchases_count > 0).map((b, i) => (
                    <>
                      <tr key={b.id} className="border-b border-gray-100 cursor-pointer hover:bg-amber-50/20"
                        onClick={() => toggle(b.id)}>
                        <td className="px-3 py-2.5">
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded[b.id] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">{b.name}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">{b.purchases_count}</span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-amber-700">₹ {fmt(b.purchase_brokerage)}</td>
                      </tr>
                      {expanded[b.id] && (
                        <>
                          <tr className="bg-amber-50/40">
                            <td/><td/>
                            <td className="px-3 py-1 text-[10px] font-bold text-amber-600 uppercase tracking-widest">Purchase Code · Location</td>
                            <td className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Plot No · Area</td>
                            <td className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Brokerage</td>
                          </tr>
                          {b.purchases.map(p => (
                            <tr key={`p-${p.id}`} className="border-b border-gray-50 bg-amber-50/20 text-xs">
                              <td/><td/>
                              <td className="px-3 py-2">
                                <span className="font-mono font-semibold text-amber-700">{p.purchase_code || `PUR-${String(p.id).padStart(4,'0')}`}</span>
                                <span className="text-gray-500 ml-2">{p.location || '—'}</span>
                              </td>
                              <td className="px-3 py-2 text-gray-500">{p.plot_no || '—'} · {p.purchased_area ? `${p.purchased_area} ${p.purchased_area_details || ''}` : '—'}</td>
                              <td className="px-3 py-2 font-semibold text-amber-700 whitespace-nowrap">₹ {fmt(p.brokerage)}</td>
                            </tr>
                          ))}
                        </>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [instTab, setInstTab] = useState('seller');

  useEffect(() => {
    apiGet('/lookup/projects?limit=500').then(d => setProjects(d || [])).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true); setExpandP({}); setExpandS({});
    try {
      const p = new URLSearchParams();
      if (projectId) p.set('project_id', projectId);
      setResult(await apiGet('/reports/instalments?' + p));
    } finally { setLoading(false); }
  };

  const doExcel = async () => {
    if (!result) return;
    const purchaseRows = [];
    for (const r of result.purchase_pending) {
      for (const inst of r.pending_instalments) {
        purchaseRows.push({
          'Purchase Code': r.purchase_code,
          'Plot No':       r.plot_no || '',
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
          'Plot No':      r.plot_no || '',
          'Front Area':   r.front_area ?? '',
          'Back Area':    r.back_area  ?? '',
          'Total Area':   r.total_area ? `${r.total_area}${r.area_unit ? ' ' + r.area_unit : ''}` : '',
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
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold text-gray-900">Instalments Report</h1>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 print:hidden">
        <FilterRow>
          <Field label="Project">
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className={selectCls} style={{ minWidth: 160 }}>
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
          {/* ── Tab bar ── */}
          <div className="flex border-b border-gray-200 bg-white rounded-t-lg overflow-hidden">
            {[
              { id: 'seller',   label: 'A · Pending to Seller',      count: result.purchase_pending.length },
              { id: 'customer', label: 'B · Pending from Customer',   count: result.sale_pending.length },
            ].map(t => (
              <button key={t.id} onClick={() => setInstTab(t.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${instTab === t.id ? 'border-[#875A7B] text-[#875A7B]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'}`}>
                {t.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${instTab === t.id ? 'bg-[#875A7B]/10 text-[#875A7B]' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* ── A: Purchase Pending ── */}
          {instTab === 'seller' && <div>
            <div className="flex items-center gap-3 mb-3 print:hidden">
              <span className="text-xs text-gray-400">Instalments we still owe the seller (from Purchase)</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3 print:hidden">
              <SummaryCard label="Purchases with Pending" value={result.purchase_summary.count} />
              <SummaryCard label="Already Paid"           value={'₹ ' + fmt(result.purchase_summary.total_paid)} />
              <SummaryCard label="Total Pending"          value={'₹ ' + fmt(result.purchase_summary.total_pending)} />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-[70vh]">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-orange-50">
                  <tr className="border-b border-gray-200 bg-orange-50/60">
                    {['','#','Purchase','Plot No','Seller','Project','Paid (Inst.)','Pending','Instalments'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.purchase_pending.length === 0 ? (
                    <tr><td colSpan={9} className="py-10 text-center text-sm text-gray-400">No pending purchase instalments</td></tr>
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
                        <td className="px-3 py-2.5 text-sm font-semibold text-gray-700">{r.plot_no || '—'}</td>
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
          </div>}

          {/* ── B: Sale Pending ── */}
          {instTab === 'customer' && <div>
            <div className="flex items-center gap-3 mb-3 print:hidden">
              <span className="text-xs text-gray-400">Instalments customers still owe us (from Sale)</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3 print:hidden">
              <SummaryCard label="Sales with Pending" value={result.sale_summary.count} />
              <SummaryCard label="Already Received"   value={'₹ ' + fmt(result.sale_summary.total_paid)} />
              <SummaryCard label="Total Pending"      value={'₹ ' + fmt(result.sale_summary.total_pending)} />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-[70vh]">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-blue-50">
                  <tr className="border-b border-gray-200 bg-blue-50/60">
                    {['','#','Sale','Plot No','Area','Customer','Project','Received (Inst.)','Pending','Instalments'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.sale_pending.length === 0 ? (
                    <tr><td colSpan={10} className="py-10 text-center text-sm text-gray-400">No pending sale instalments</td></tr>
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
                        <td className="px-3 py-2.5 text-sm font-semibold text-gray-700">{r.plot_no || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                          {r.front_area && r.back_area
                            ? `${fmtN(r.front_area)} × ${fmtN(r.back_area)}`
                            : r.total_area ? fmtN(r.total_area) : '—'}
                          {r.total_area && r.front_area && r.back_area
                            ? <span className="text-xs text-gray-400 ml-1">({fmtN(r.total_area)}{r.area_unit ? ' ' + r.area_unit : ''})</span>
                            : null}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">
                          {r.customer?.name || '—'}
                          {r.customer?.phone && <p className="text-sm font-medium text-gray-800">{r.customer.phone}</p>}
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
          </div>}
        </>
      )}
    </div>
  );
}

// ── Availability Report ───────────────────────────────────────────────────────
function AvailabilityReport() {
  const [filters, setFilters] = useState({ purchase_id: '', project_id: '', status: '', created_by_id: '', facing: '' });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    apiGet('/lookup/plots').then(d => setPurchases(d || [])).catch(() => {});
    apiGet('/lookup/projects?limit=500').then(d => setProjects(d || [])).catch(() => {});
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
    const TYPE_LABEL = { PLOT: 'Plot', SHOP: 'Shop', LAND: 'Land', FLAT: 'Flat', PLOT_WIRE: 'Plot Wire', SHOP_WIRE: 'Shop Wire' };
    const rows = result.units.map((u, i) => ({
      '#':           i + 1,
      'SL No.':      u.sl_no   || '',
      'Plot No.':    u.plot_no || '',
      'Customer':    ['SOLD','RESERVED','REGISTERED','ATTORNEY','FULL_FINAL'].includes(u.display_status || u.status) ? (u.customer_name || '') : '',
      'Facing':      u.facing  || '',
      'Type':        TYPE_LABEL[u.type] || u.type || '',
      'Front Area':  u.front_area ? fmtNum(u.front_area) : '',
      'Back Area':   u.back_area  ? fmtNum(u.back_area)  : '',
      'Total Area':  fmtNum(u.total_area),
      'Status':      { FULL_FINAL: 'Full & Final', ATTORNEY: 'Attorney' }[u.display_status] || u.status,
    }));
    await exportXlsx([{ name: 'Availability', rows }], `availability_report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const statusBadge = (status) => {
    const map = {
      AVAILABLE:  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500',  label: 'Available'    },
      SOLD:       { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500',       label: 'Sold'         },
      RESERVED:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',     label: 'Reserved'     },
      REGISTERED: { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',      label: 'Registered'   },
      ATTORNEY:   { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500',    label: 'Attorney'     },
      FULL_FINAL: { bg: 'bg-green-50',   text: 'text-green-800',   dot: 'bg-green-600',     label: 'Full & Final' },
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
              <option value="ATTORNEY">Attorney</option>
              <option value="FULL_FINAL">Full &amp; Final</option>
            </select>
          </Field>
          <Field label="Employee">
            <select value={filters.created_by_id} onChange={e => set('created_by_id', e.target.value)} className={selectCls} style={{ minWidth: 160 }}>
              <option value="">All Employees</option>
              {employees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Facing">
            <input type="text" value={filters.facing} onChange={e => set('facing', e.target.value)} className={inputCls} placeholder="e.g. North" style={{ minWidth: 110 }} />
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <><PrintBtn /><ExcelBtn onClick={doExcel} /></>}
        </FilterRow>
      </div>

      {result && (
        <>
          {(() => {
            const totalArea = result.units.reduce((s, u) => s + (Number(u.total_area) || 0), 0);
            const areaUnit  = result.units.find(u => u.area_unit)?.area_unit || '';
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                <SummaryCard label="Total Units" value={result.summary.count} />
                <SummaryCard label="Available"   value={result.summary.available} />
                <SummaryCard label="Sold"        value={result.summary.sold} />
                <SummaryCard label="Reserved"    value={result.summary.reserved} />
                <SummaryCard label="Registered"  value={result.summary.registered} />
                <SummaryCard label="Total Area"  value={totalArea > 0 ? `${fmtN(totalArea)}${areaUnit ? ' ' + areaUnit : ''}` : '—'} />
              </div>
            );
          })()}
          <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-[70vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#', 'SL No.', 'Plot No.', 'Customer', 'Facing', 'Type', 'Front Area', 'Back Area', 'Total Area', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.units.length === 0 ? (
                  <tr><td colSpan={10} className="py-10 text-center text-sm text-gray-400">No inventory found</td></tr>
                ) : result.units.map((u, i) => {
                  const TYPE_LABEL = { PLOT: 'Plot', SHOP: 'Shop', LAND: 'Land', FLAT: 'Flat', PLOT_WIRE: 'Plot Wire', SHOP_WIRE: 'Shop Wire' };
                  return (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5 text-gray-700">{u.sl_no   || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{u.plot_no || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-800 font-medium">
                      {['SOLD','RESERVED','REGISTERED','ATTORNEY','FULL_FINAL'].includes(u.display_status || u.status) && u.customer_name
                        ? u.customer_name : ''}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{u.facing  || '—'}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-gray-700">{TYPE_LABEL[u.type] || u.type || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{u.front_area ? fmtN(u.front_area) : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{u.back_area  ? fmtN(u.back_area)  : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{u.total_area ? fmtN(u.total_area) + (u.area_unit ? ' ' + u.area_unit : '') : '—'}</td>
                    <td className="px-3 py-2.5">{statusBadge(u.display_status || u.status)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Balance Due Report ─────────────────────────────────────────────────────────
function BalanceDueReport() {
  const [filters, setFilters] = useState({ due_date_from: '', due_date_to: '', project_id: '' });
  const [projects, setProjects] = useState([]);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet('/lookup/projects?limit=500').then(d => setProjects(d || [])).catch(() => {});
  }, []);

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.due_date_from) p.set('due_date_from', filters.due_date_from);
      if (filters.due_date_to)   p.set('due_date_to',   filters.due_date_to);
      if (filters.project_id) p.set('project_id', filters.project_id);
      setResult(await apiGet('/reports/balance-due?' + p));
    } finally { setLoading(false); }
  };

  const doExcel = async () => {
    if (!result) return;
    const rows = result.rows.map((r, i) => ({
      '#':               i + 1,
      'Sale Code':       r.sale_code,
      'Project':         r.project?.name || '',
      'Plot No':         r.plot_no || '',
      'Total Area':      r.total_area ? `${r.total_area}${r.area_unit ? ' ' + r.area_unit : ''}` : '',
      'Customer':        r.customer?.name || '',
      'Phone':           r.customer?.phone || '',
      'Actual Price':    fmtNum(r.actual_price),
      'Received':        fmtNum(r.received),
      'Pending (Inst.)': fmtNum(r.pending),
      'Balance':         fmtNum(r.balance),
      'Payment Due Date': r.next_due_date ? fmtDate(r.next_due_date) : '',
    }));
    await exportXlsx(
      [{ name: 'Balance Due', rows: rows.length ? rows : [{ Note: 'No records' }] }],
      `balance_due_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold text-gray-900">Balance Due Report</h1>
      </div>
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <FilterRow>
          <Field label="Payment Due From">
            <input type="date" value={filters.due_date_from} onChange={e => set('due_date_from', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Payment Due To">
            <input type="date" value={filters.due_date_to} onChange={e => set('due_date_to', e.target.value)} className={inputCls} />
          </Field>
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
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
            <SummaryCard label="Sales with Balance" value={result.summary.count} />
            <SummaryCard label="Total Received"     value={'₹ ' + fmt(result.summary.total_received)} />
            <SummaryCard label="Pending (Inst.)"    value={'₹ ' + fmt(result.summary.total_pending)} />
            <SummaryCard label="Total Balance Due"  value={'₹ ' + fmt(result.summary.total_balance)} />
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-[70vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#','Sale','Project','Plot No','Total Area','Customer','Actual Price','Received','Pending (Inst.)','Balance Due','Payment Due Date'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr><td colSpan={11} className="py-10 text-center text-sm text-gray-400">No sales with outstanding balance</td></tr>
                ) : result.rows.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5"><span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{r.sale_code}</span></td>
                    <td className="px-3 py-2.5 text-gray-600">{r.project?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-gray-700">{r.plot_no || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{r.total_area ? fmtN(r.total_area) + (r.area_unit ? ' ' + r.area_unit : '') : '—'}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-bold text-gray-900">{r.customer?.name || '—'}</p>
                      {r.customer?.phone && <p className="text-xs font-bold text-gray-900">{r.customer.phone}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">₹ {fmt(r.actual_price)}</td>
                    <td className="px-3 py-2.5 text-emerald-700 font-medium">₹ {fmt(r.received)}</td>
                    <td className="px-3 py-2.5 text-blue-700">₹ {fmt(r.pending)}</td>
                    <td className="px-3 py-2.5 font-bold text-red-600">₹ {fmt(r.balance)}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.next_due_date ? fmtDate(r.next_due_date) : '—'}</td>
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
  { id: 'balance-due',  label: 'Balance Due Report' },
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
        {tab === 'balance-due'  && <BalanceDueReport />}
        {tab === 'availability' && <AvailabilityReport />}
      </div>

      <style>{`
        @media print {
          /* Remove the bg colour so report prints on white */
          .bg-\\[\\#F4F5F7\\] { background: white !important; }
          /* Summary cards: remove shadow, keep border */
          .rounded-lg { box-shadow: none !important; }
          /* Padding on the content wrapper */
          .p-4 { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
