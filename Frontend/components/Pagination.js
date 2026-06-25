'use client';

// Compact inline pagination for top toolbars — matches Users page style
export default function Pagination({ page, totalPages, total, from, to, loading, onPage }) {
  const f = total === 0 ? 0 : from;
  const t = total === 0 ? 0 : to;

  return (
    <div className="flex items-center gap-0.5 shrink-0 text-sm text-gray-500">
      <span className="px-1 tabular-nums whitespace-nowrap">{total === 0 ? '0' : `${f}-${t}`} / {total}</span>
      <button onClick={() => onPage(page - 1)} disabled={page === 1 || loading}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages || loading}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
