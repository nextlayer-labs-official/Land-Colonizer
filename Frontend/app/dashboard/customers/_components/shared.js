export const EMPTY = {
  name: '', phone: '', email: '', address: '',
  type: 'INDIVIDUAL', pan: '', aadhaar: '', other: '',
  status: 'ACTIVE',
};

export const CUSTOMER_TYPES = ['INDIVIDUAL', 'COMPANY'];

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';


export function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-medium text-gray-500 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
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

export function FTextarea({ value, onChange, placeholder, rows = 3, readOnly }) {
  if (readOnly) {
    return (
      <div className="min-h-[70px] px-3 py-2 bg-gray-50 rounded border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
        {value || <span className="text-gray-300">—</span>}
      </div>
    );
  }
  return (
    <textarea value={value ?? ''} onChange={onChange} placeholder={placeholder} rows={rows}
      className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition resize-none placeholder:text-gray-300" />
  );
}

export function FSelect({ value, onChange, children, readOnly }) {
  if (readOnly) {
    return (
      <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">
        {value || <span className="text-gray-300">—</span>}
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

export function SectionDivider({ title }) {
  return (
    <div className="col-span-full pt-3 pb-1 border-b border-gray-200">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
    </div>
  );
}

export function AvatarCircle({ name, size = 'md' }) {
  const colors = ['#6366F1','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#875A7B'];
  const bg = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  const initials = name ? name.trim().split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-8 h-8 text-xs';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white shrink-0`} style={{ backgroundColor: bg }}>
      {initials}
    </div>
  );
}
