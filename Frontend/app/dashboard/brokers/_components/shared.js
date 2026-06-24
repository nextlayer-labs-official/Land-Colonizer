export const EMPTY = { name: '', phone: '', email: '', details: '', status: 'ACTIVE' };

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtINR = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

export function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-medium text-gray-500 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}
export function FInput({ value, onChange, type = 'text', placeholder, readOnly, autoFocus }) {
  if (readOnly) return <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</div>;
  return <input autoFocus={autoFocus} type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
    className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition placeholder:text-gray-300" />;
}
export function FTextarea({ value, onChange, placeholder, rows = 3, readOnly }) {
  if (readOnly) return <div className="min-h-[70px] px-3 py-2 bg-gray-50 rounded border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">{value || <span className="text-gray-300">—</span>}</div>;
  return <textarea value={value ?? ''} onChange={onChange} placeholder={placeholder} rows={rows}
    className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition resize-none placeholder:text-gray-300" />;
}
export function FSelect({ value, onChange, children, readOnly }) {
  if (readOnly) return <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</div>;
  return <select value={value ?? ''} onChange={onChange}
    className="w-full border border-gray-200 rounded px-3 py-[7px] text-sm text-gray-800 bg-white focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition">{children}</select>;
}
