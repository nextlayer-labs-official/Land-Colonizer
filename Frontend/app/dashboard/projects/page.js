'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet, apiDelete } from '@/lib/api';

const fmt    = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtCr  = (n) => {
  const v = Number(n || 0);
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(2)} L`;
  return v > 0 ? `₹${v.toLocaleString('en-IN')}` : '—';
};

const STATUS_COLOR = {
  OPEN:    'bg-emerald-50 text-emerald-700',
  ONGOING: 'bg-blue-50 text-blue-700',
  CLOSED:  'bg-gray-100 text-gray-500',
};

const INV_STATUS = [
  { key: 'available',  label: 'Avail',  bar: 'bg-emerald-400' },
  { key: 'reserved',   label: 'Rsvd',   bar: 'bg-amber-400'   },
  { key: 'sold',       label: 'Sold',   bar: 'bg-blue-400'    },
  { key: 'registered', label: 'Reg',    bar: 'bg-[#875A7B]'   },
];

function MiniBar({ project }) {
  const total = project.unit_count || 0;
  if (!total) return <div className="h-1.5 bg-gray-100 rounded-full w-full" />;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden gap-px w-full">
      {INV_STATUS.map(({ key, bar }) => {
        const c = project[key] || 0;
        if (!c) return null;
        return <div key={key} className={`${bar}`} style={{ width: `${(c / total) * 100}%` }} />;
      })}
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [page,     setPage]     = useState(1);
  const [delId,    setDelId]    = useState(null);
  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page, limit, search, status }).toString();
      const d = await apiGet(`/projects?${q}`);
      setProjects(d.projects || []);
      setTotal(d.total || 0);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status]);

  const handleDelete = async () => {
    if (!delId) return;
    try { await apiDelete(`/projects/${delId}`); setDelId(null); load(); } catch { setDelId(null); }
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="p-4 pb-10 max-w-7xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Projects</h1>
          <p className="text-xs text-gray-400 mt-0.5">{total} project{total !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/projects/new"
          className="h-9 px-4 rounded-xl text-sm font-semibold text-white flex items-center gap-2 shadow-sm hover:opacity-90 transition"
          style={{ backgroundColor: '#875A7B' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          New Project
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, code, location…"
          className="h-9 px-3 text-sm border border-gray-200 rounded-xl w-64 focus:outline-none focus:border-[#875A7B] bg-white" />
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="h-9 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#875A7B] bg-white">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ONGOING">Ongoing</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
          <p className="text-sm font-semibold text-gray-500">No projects found</p>
          <p className="text-xs text-gray-400 mt-1">Create your first project to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => {
            const totalVal = (p.inventory || []).reduce((s, u) => {
              const sale = u.sales?.[0];
              return s + Number(sale?.actual_price || 0);
            }, 0);
            return (
              <div key={p.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer group"
                onClick={() => router.push(`/dashboard/projects/${p.id}`)}>

                {/* Card top */}
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm"
                      style={{ backgroundColor: '#875A7B' }}>
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-500'}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-sm font-black text-gray-900 leading-tight group-hover:text-[#875A7B] transition-colors">{p.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{p.project_code}</p>
                  {p.location && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    {p.location}
                  </p>}
                </div>

                {/* Status bar */}
                <div className="px-5 pb-4">
                  <MiniBar project={p} />
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {INV_STATUS.map(({ key, label, bar }) => (
                      <div key={key} className="text-center">
                        <p className="text-xs font-black text-gray-800">{p[key] || 0}</p>
                        <p className="text-[9px] text-gray-400">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-50 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide">Units</p>
                      <p className="text-xs font-bold text-gray-700">{fmt(p.unit_count)}</p>
                    </div>
                    <div className="w-px h-6 bg-gray-100" />
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide">Total Area</p>
                      <p className="text-xs font-bold text-gray-700">{p.total_area > 0 ? fmt(p.total_area) : '—'}</p>
                    </div>
                    <div className="w-px h-6 bg-gray-100" />
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide">Value</p>
                      <p className="text-xs font-bold text-emerald-700">{fmtCr(totalVal)}</p>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setDelId(p.id); }}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="h-8 px-3 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-xs text-gray-500">{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="h-8 px-3 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}

      {/* Delete modal */}
      {delId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <p className="text-base font-bold text-gray-900 mb-1">Delete project?</p>
            <p className="text-sm text-gray-500 mb-5">This won&apos;t delete linked inventory units, but it will unlink them.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDelId(null)} className="h-9 px-4 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} className="h-9 px-4 text-sm rounded-xl text-white font-semibold bg-red-500 hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
