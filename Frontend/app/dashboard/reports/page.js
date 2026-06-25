'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet } from '@/lib/api';

const fmt = (n) => n == null ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n) => n == null ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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

const inputCls = "h-8 text-sm border border-gray-200 rounded px-2.5 focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition bg-white";
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

// ── Sales Report ──────────────────────────────────────────────────────────────
function SalesReport() {
  const [filters, setFilters] = useState({ date_from: '', date_to: '', project_id: '', broker_id: '', status: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [brokers, setBrokers] = useState([]);

  useEffect(() => {
    apiGet('/lookup/projects').then(d => setProjects(d || [])).catch(() => {});
    apiGet('/lookup/brokers').then(d => setBrokers(d || [])).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      const data = await apiGet(`/reports/sales?${q}`);
      setResult(data);
    } finally { setLoading(false); }
  };

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 print:hidden">
        <FilterRow>
          <Field label="From">
            <input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} className={inputCls} />
          </Field>
          <Field label="To">
            <input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} className={inputCls} />
          </Field>
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
          {result && <PrintBtn />}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <SummaryCard label="Total Sales" value={result.summary.count} />
            <SummaryCard label="Total Value" value={'₹ ' + fmt(result.summary.total_value)} />
            <SummaryCard label="Actual Price" value={'₹ ' + fmt(result.summary.total_amount)} />
            <SummaryCard label="Advance Received" value={'₹ ' + fmt(result.summary.total_advance)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#', 'Sale Code', 'Customer', 'Project', 'Broker', 'Total Area', 'Actual Price', 'Advance', 'Balance', 'Status', 'Date'].map(h => (
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
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{s.sale_code || `SL-${String(s.id).padStart(4,'0')}`}</span>
                    </td>
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
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    apiGet('/lookup/projects').then(d => setProjects(d || [])).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      const data = await apiGet(`/reports/inventory?${q}`);
      setResult(data);
    } finally { setLoading(false); }
  };

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

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
              <option value="FLAT">Flat</option>
            </select>
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <PrintBtn />}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <SummaryCard label="Total Units" value={result.summary.count} />
            <SummaryCard label="Available" value={result.summary.available} />
            <SummaryCard label="Sold" value={result.summary.sold} />
            <SummaryCard label="Booked" value={result.summary.booked} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <SummaryCard label="Total Area" value={fmtN(result.summary.total_area) + ' sq.yd'} />
            <SummaryCard label="Total Value" value={'₹ ' + fmt(result.summary.total_value)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#', 'Unit Code', 'Project', 'Type', 'Front Area', 'Back Area', 'Total Area', 'Rate / sq.yd', 'Total Value', 'Status'].map(h => (
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
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{u.unit_code}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{u.project?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{u.area_type || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fmtN(u.front_area)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fmtN(u.back_area)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{fmtN(u.total_area)} sq.yd</td>
                    <td className="px-3 py-2.5 text-gray-700">₹ {fmt(u.rate_per_sqyd)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">₹ {fmt(u.total_value)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                        ${u.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700' :
                          u.status === 'SOLD' ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-700'}`}>
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
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    apiGet('/lookup/projects').then(d => setProjects(d || [])).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      const data = await apiGet(`/reports/purchases?${q}`);
      setResult(data);
    } finally { setLoading(false); }
  };

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 print:hidden">
        <FilterRow>
          <Field label="From">
            <input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} className={inputCls} />
          </Field>
          <Field label="To">
            <input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Project">
            <select value={filters.project_id} onChange={e => set('project_id', e.target.value)} className={selectCls} style={{ minWidth: 160 }}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <PrintBtn />}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SummaryCard label="Total Purchases" value={result.summary.count} />
            <SummaryCard label="Total Area" value={fmtN(result.summary.total_area) + ' sq.yd'} />
            <SummaryCard label="Total Cost" value={'₹ ' + fmt(result.summary.total_cost)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#', 'Purchase Code', 'Project', 'Seller', 'Total Area', 'Rate', 'Total Cost', 'Purchase Date'].map(h => (
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
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs font-semibold text-[#875A7B] bg-[#875A7B]/8 px-1.5 py-0.5 rounded">{p.purchase_code || `PUR-${String(p.id).padStart(4,'0')}`}</span>
                    </td>
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
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [brokers, setBrokers] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    apiGet('/lookup/brokers').then(d => setBrokers(d || [])).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true);
    setExpanded({});
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      const data = await apiGet(`/reports/brokers?${q}`);
      setResult(data);
    } finally { setLoading(false); }
  };

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 print:hidden">
        <FilterRow>
          <Field label="From">
            <input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} className={inputCls} />
          </Field>
          <Field label="To">
            <input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Broker">
            <select value={filters.broker_id} onChange={e => set('broker_id', e.target.value)} className={selectCls} style={{ minWidth: 160 }}>
              <option value="">All Brokers</option>
              {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <RunBtn onClick={run} loading={loading} />
          {result && <PrintBtn />}
        </FilterRow>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SummaryCard label="Brokers" value={result.summary.broker_count} />
            <SummaryCard label="Total Sales" value={result.summary.total_sales} />
            <SummaryCard label="Total Value" value={'₹ ' + fmt(result.summary.total_value)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['', '#', 'Broker', 'Phone', 'Sales Count', 'Total Value'].map(h => (
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
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2" />
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

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'sales',     label: 'Sales Report' },
  { id: 'inventory', label: 'Inventory Report' },
  { id: 'purchases', label: 'Purchase Report' },
  { id: 'brokers',   label: 'Broker Report' },
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
      <div className="bg-white border-b border-gray-200 px-4 py-0 flex items-center gap-0 print:hidden" style={{ minHeight: 44 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-[#875A7B] text-[#875A7B]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === 'sales'     && <SalesReport />}
        {tab === 'inventory' && <InventoryReport />}
        {tab === 'purchases' && <PurchaseReport />}
        {tab === 'brokers'   && <BrokerReport />}
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
