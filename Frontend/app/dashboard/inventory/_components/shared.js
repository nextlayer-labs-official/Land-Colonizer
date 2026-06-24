// Shared constants and atoms for the Inventory module

export const EMPTY = {
  inventory_code:     '',
  purchase_id:        '',
  project_id:         '',
  type:               'PLOT',
  sl_no:              '',
  location:           '',
  plot_no:            '',
  front_area:         '',
  front_area_details: '',
  back_area:          '',
  back_area_details:  '',
  area:               '',
  area_unit:          '',
  rate:               '',
  registration_date:  '',
  status:             'AVAILABLE',
};

export const UNIT_TYPES = ['PLOT', 'SHOP', 'LAND'];
export const AREA_UNITS = ['sq.ft', 'sq.yd', 'sq.m', 'cents', 'acres', 'guntas', 'bigha', 'gaj'];

export const STATUS_RING = {
  AVAILABLE:  'bg-emerald-50 text-emerald-700 ring-emerald-200',
  RESERVED:   'bg-amber-50   text-amber-700   ring-amber-200',
  SOLD:       'bg-blue-50    text-blue-700    ring-blue-200',
  REGISTERED: 'bg-violet-50  text-violet-700  ring-violet-200',
};

export const STATUS_DOT = {
  AVAILABLE:  'bg-emerald-500',
  RESERVED:   'bg-amber-400',
  SOLD:       'bg-blue-500',
  REGISTERED: 'bg-violet-500',
};

export const UNIT_TYPE_RING = {
  PLOT: 'bg-violet-50  text-violet-700  ring-violet-200',
  SHOP: 'bg-blue-50    text-blue-700    ring-blue-200',
  LAND: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export const fmtINR  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const fmtNum  = (n) => Number(n || 0).toLocaleString('en-IN');
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Field atoms ──────────────────────────────────────────────────────────────
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
    <input autoFocus={autoFocus} type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
      className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />
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
    <select value={value} onChange={onChange}
      className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition">
      {children}
    </select>
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
    <textarea value={value ?? ''} onChange={onChange} placeholder={placeholder} rows={rows}
      className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition resize-none placeholder:text-gray-300" />
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
    <div className="col-span-full pt-3 pb-1 border-b border-gray-200">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
    </div>
  );
}
