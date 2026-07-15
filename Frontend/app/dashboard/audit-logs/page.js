'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet } from '@/lib/api';
import { TableSkeleton } from '@/components/Skeleton';

const ACTION_COLORS = {
  CREATE:          { bg: '#dcfce7', color: '#15803d' },
  UPDATE:          { bg: '#dbeafe', color: '#1d4ed8' },
  DELETE:          { bg: '#fee2e2', color: '#b91c1c' },
  ARCHIVE:         { bg: '#fef9c3', color: '#a16207' },
  UNARCHIVE:       { bg: '#e0f2fe', color: '#0369a1' },
  LOGIN:           { bg: '#f3e8ff', color: '#7e22ce' },
  LOGIN_FAILED:    { bg: '#fee2e2', color: '#b91c1c' },
  PASSWORD_CHANGE: { bg: '#ffedd5', color: '#c2410c' },
};

const ENTITIES = ['sale', 'purchase', 'inventory', 'customer', 'broker', 'project', 'user', 'role', 'settings', 'auth'];
const ACTIONS  = ['CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'UNARCHIVE', 'LOGIN', 'LOGIN_FAILED', 'PASSWORD_CHANGE'];

function ActionBadge({ action }) {
  const style = ACTION_COLORS[action] || { bg: '#f3f4f6', color: '#374151' };
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: style.bg, color: style.color }}>
      {action.replace('_', ' ')}
    </span>
  );
}

// ── Field label map ───────────────────────────────────────────────────────────
const FIELD_LABELS = {
  // Common
  id: 'ID', status: 'Status', archived: 'Archived', created_at: 'Created At',
  updated_at: 'Updated At', created_by_id: 'Created By (ID)', created_by_name: 'Created By',

  // Purchase
  purchase_code: 'Purchase Code', purchase_category: 'Category',
  purchase_broker_name: 'Purchase Broker', purchase_broker_details: 'Purchase Broker Details',
  sell_broker_name: 'Sell Broker', sell_broker_details: 'Sell Broker Details',
  seller_details: 'Seller Details', plot_no: 'Plot No.', sl_no: 'SL No.',
  purchased_area: 'Purchased Area', purchased_area_details: 'Area Details',
  purchase_price: 'Purchase Price', global_rate: 'Global Rate', rate: 'Rate',
  rate_details: 'Rate Details', total_amount_details: 'Total Amount Details',
  advance_paid: 'Advance Paid', advance_payment_details: 'Advance Payment Details',
  instalment_details: 'Instalment Details', remaining_paid: 'Remaining Paid',
  registration_date: 'Registration Date', registration_completed: 'Registration Completed',
  registration_details: 'Registration Details', registration_charges: 'Registration Charges',
  registration_charges_details: 'Reg. Charges Details',
  brokerage: 'Brokerage', brokerage_details: 'Brokerage Details',
  extra_expenses: 'Extra Expenses', extra_expenses_details: 'Extra Expenses Details',
  extra_income: 'Extra Income', extra_income_details: 'Extra Income Details',
  other_details: 'Other Details', location: 'Location',

  // Sale
  sale_code: 'Sale Code', sale_date: 'Sale Date', inventory_id: 'Inventory (ID)',
  customer_id: 'Customer (ID)', broker_id: 'Broker (ID)',
  broker_name: 'Broker Name', broker_details: 'Broker Details',
  front_area: 'Front Area', front_area_details: 'Front Area Details',
  back_area: 'Back Area', back_area_details: 'Back Area Details',
  total_area: 'Total Area', total_area_details: 'Total Area Details',
  plot_rate: 'Plot Rate', total_value: 'Total Value', selling_rate: 'Selling Rate',
  actual_price: 'Actual Price', booking_amount: 'Booking Amount',
  booking_details: 'Booking Details', advance_payment: 'Advance Payment',
  advance_payment_date: 'Advance Payment Date',
  balance_amount: 'Balance Amount', balance_amount_details: 'Balance Details',
  registration_paid: 'Registration Paid', registration_area: 'Registration Area',
  intkaal_charges: 'Intkaal Charges', intkaal_paid: 'Intkaal Paid',
  intkaal_details: 'Intkaal Details', intkaal_number: 'Intkaal Number',
  water_connection_charges: 'Water Connection Charges',
  water_connection_paid: 'Water Connection Paid',
  water_connection_details: 'Water Connection Details',
  electricity_meter_charges: 'Electricity Meter Charges',
  electricity_meter_paid: 'Electricity Meter Paid',
  electricity_meter_details: 'Electricity Meter Details',
  payment_due_date: 'Payment Due Date', discount: 'Discount',
  discount_details: 'Discount Details', incentive: 'Incentive',
  incentive_details: 'Incentive Details', net_amount: 'Net Amount',
  date_of_registration: 'Date of Registration', vasika: 'Vasika',
  possession: 'Possession', possession_detail: 'Possession Detail',
  sale_confirmed: 'Sale Confirmed', booking_in_received: 'Booking In Received',
  sold_by_id: 'Sold By (ID)', sold_by_name: 'Sold By',

  // Inventory
  inventory_code: 'Inventory Code', purchase_id: 'Purchase (ID)',
  project_id: 'Project (ID)', area: 'Area', area_unit: 'Area Unit',

  // Customer
  customer_code: 'Customer Code', name: 'Name', phone: 'Phone',
  email: 'Email', address: 'Address', pan: 'PAN', aadhaar: 'Aadhaar',

  // Broker
  broker_code: 'Broker Code', details: 'Details',

  // Project
  project_code: 'Project Code',

  // User / Role
  role_id: 'Role (ID)', is_verified: 'Verified', password: 'Password',
  role_name: 'Role', slug: 'Slug', description: 'Description', is_system: 'System Role',

  // Settings
  company_name: 'Company Name', company_logo: 'Company Logo',
  company_address: 'Company Address', company_phone: 'Company Phone',
  company_email: 'Company Email', company_website: 'Company Website',
  company_gstin: 'Company GSTIN', smtp_host: 'SMTP Host', smtp_port: 'SMTP Port',
  smtp_user: 'SMTP User', smtp_from_name: 'From Name', smtp_from_email: 'From Email',
  email_notifications: 'Email Notifications', login_max_attempts: 'Max Login Attempts',
  login_window_minutes: 'Login Window (min)', max_upload_mb: 'Max Upload (MB)',
  project_prefix: 'Project Prefix', purchase_prefix: 'Purchase Prefix',
  inventory_prefix: 'Inventory Prefix', sale_prefix: 'Sale Prefix',
  customer_prefix: 'Customer Prefix', broker_prefix: 'Broker Prefix',
  google_drive_enabled: 'Google Drive Enabled',
};

function snakeToTitle(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function labelFor(field) {
  return FIELD_LABELS[field] || snakeToTitle(field);
}

function formatValue(v) {
  if (v == null)          return null;
  if (v === true)         return 'Yes';
  if (v === false)        return 'No';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v))
    return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return String(v);
}

function ChangesModal({ log, onClose }) {
  const changes = log.changes;

  // Filter: skip rows where both before and after are null (pure noise)
  const rows = changes && typeof changes === 'object'
    ? Object.entries(changes).filter(([, [before, after]]) => !(before == null && after == null))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-white rounded-lg shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 capitalize">
              {log.entity_code ? `${log.entity} · ${log.entity_code}` : log.entity}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(log.created_at).toLocaleString()} · {log.user_name || log.user_email || 'System'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No field-level changes recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs text-gray-500 font-medium w-1/3">Field</th>
                  <th className="pb-2 text-left text-xs text-gray-500 font-medium w-1/3">Before</th>
                  <th className="pb-2 text-left text-xs text-gray-500 font-medium w-1/3">After</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([field, [before, after]]) => {
                  const bFmt = formatValue(before);
                  const aFmt = formatValue(after);
                  return (
                    <tr key={field} className="border-b border-gray-50">
                      <td className="py-2 pr-3 text-xs font-medium text-gray-600">{labelFor(field)}</td>
                      <td className="py-2 pr-3 text-xs break-all">
                        {bFmt == null
                          ? <span className="text-gray-300 italic">—</span>
                          : <span className="text-red-500">{bFmt}</span>}
                      </td>
                      <td className="py-2 text-xs break-all">
                        {aFmt == null
                          ? <span className="text-gray-300 italic">—</span>
                          : <span className="text-green-700">{aFmt}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditLogsPageInner() {
  useAuth();
  const { me, can, loading: permLoading } = usePermissions();

  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail,  setDetail]  = useState(null);

  // Filters
  const [search,  setSearch]  = useState('');
  const [entity,  setEntity]  = useState('');
  const [action,  setAction]  = useState('');
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');

  const limit = 20;
  const canView = me?.is_system || can('AUDIT_VIEW');

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:   p,
        limit,
        ...(search ? { search } : {}),
        ...(entity ? { entity } : {}),
        ...(action ? { action } : {}),
        ...(from   ? { from }   : {}),
        ...(to     ? { to }     : {}),
      });
      const data = await apiGet(`/audit?${params}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPage(p);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [search, entity, action, from, to]);

  useEffect(() => {
    if (!permLoading && canView) fetchLogs(1);
    else if (!permLoading) setLoading(false);
  }, [permLoading]);

  const handleSearch = (e) => { e.preventDefault(); fetchLogs(1); };
  const handleClear  = () => {
    setSearch(''); setEntity(''); setAction(''); setFrom(''); setTo('');
  };

  const from_n = total === 0 ? 0 : (page - 1) * limit + 1;
  const to_n   = Math.min(page * limit, total);

  if (permLoading || loading) return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="h-12 border-b border-gray-200 animate-pulse bg-gray-50" />
      <TableSkeleton cols={6} rows={10} />
    </div>
  );

  if (!canView) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <p className="text-sm font-semibold text-gray-700 mb-1">Access Denied</p>
      <p className="text-sm text-gray-500">You don&apos;t have permission to view audit logs.</p>
    </div>
  );

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-gray-800">Audit Logs</h1>
        <span className="text-sm text-gray-400">{total.toLocaleString()} entries</span>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch}
        className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex flex-wrap items-end gap-3">

        <div className="flex flex-col gap-1 min-w-[200px] flex-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Search</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, code…"
            className="ams-input text-sm" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Entity</label>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="ams-input text-sm min-w-[130px]">
            <option value="">All entities</option>
            {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Action</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="ams-input text-sm min-w-[150px]">
            <option value="">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ams-input text-sm" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ams-input text-sm" />
        </div>

        <div className="flex gap-2">
          <button type="submit"
            className="px-4 py-2 text-sm font-medium text-white rounded"
            style={{ backgroundColor: '#714B67' }}>
            Filter
          </button>
          <button type="button" onClick={() => { handleClear(); setTimeout(() => fetchLogs(1), 0); }}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition">
            Clear
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Pagination bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
          <span className="text-sm text-gray-500 tabular-nums">
            {total === 0 ? '0' : `${from_n}–${to_n}`} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => fetchLogs(page - 1)} disabled={page === 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <span className="text-sm text-gray-500 px-1">Page {page}</span>
            <button onClick={() => fetchLogs(page + 1)} disabled={page * limit >= total}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {logs.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-400">No audit logs found.</div>
          ) : (
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Timestamp</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">User</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Action</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Entity</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Code / ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">IP</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Changes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const hasChanges = log.changes && Object.keys(log.changes).length > 0;
                  return (
                    <tr key={log.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap tabular-nums">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-800 font-medium text-xs">{log.user_name || '—'}</div>
                        <div className="text-gray-400 text-[11px]">{log.user_email || ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{log.entity}</td>
                      <td className="px-4 py-3">
                        {log.entity_code
                          ? <span className="font-mono text-xs text-gray-700">{log.entity_code}</span>
                          : log.entity_id
                            ? <span className="font-mono text-xs text-gray-400">#{log.entity_id}</span>
                            : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ip_address || '—'}</td>
                      <td className="px-4 py-3">
                        {hasChanges ? (
                          <button onClick={() => setDetail(log)}
                            className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition">
                            {Object.keys(log.changes).length} field{Object.keys(log.changes).length !== 1 ? 's' : ''}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {detail && <ChangesModal log={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

export default function AuditLogsPage() {
  return <Suspense><AuditLogsPageInner /></Suspense>;
}
