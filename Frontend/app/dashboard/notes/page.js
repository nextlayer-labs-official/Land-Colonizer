'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

const COLORS = {
  default: { bg: '#ffffff', border: '#e5e7eb', ring: '#d1d5db', label: 'White'  },
  yellow:  { bg: '#fef9c3', border: '#fde047', ring: '#facc15', label: 'Yellow' },
  blue:    { bg: '#dbeafe', border: '#93c5fd', ring: '#60a5fa', label: 'Blue'   },
  green:   { bg: '#dcfce7', border: '#86efac', ring: '#4ade80', label: 'Green'  },
  pink:    { bg: '#fce7f3', border: '#f9a8d4', ring: '#f472b6', label: 'Pink'   },
  purple:  { bg: '#ede9fe', border: '#c4b5fd', ring: '#a78bfa', label: 'Purple' },
  gray:    { bg: '#f3f4f6', border: '#d1d5db', ring: '#9ca3af', label: 'Gray'   },
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Deleted notes are kept in the Recycle Bin for this many days (matches the server)
const BIN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const daysLeft = (deletedAt) => Math.max(0, Math.ceil((new Date(deletedAt).getTime() + BIN_DAYS * DAY_MS - Date.now()) / DAY_MS));

function RestoreIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5" />
    </svg>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      {Object.entries(COLORS).map(([key, c]) => (
        <button
          key={key}
          type="button"
          title={c.label}
          onClick={() => onChange(key)}
          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 focus:outline-none"
          style={{
            background:   c.bg,
            borderColor:  value === key ? '#875A7B' : c.border,
            boxShadow:    value === key ? '0 0 0 2px #875A7B' : 'none',
          }}
        />
      ))}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export default function NotesPage() {
  useAuth();
  const { can, me } = usePermissions();

  const [notes,   setNotes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [searchQ, setSearchQ] = useState('');

  const canCreate = can('NOTE_CREATE') || me?.is_system;
  const canEdit   = can('NOTE_EDIT')   || me?.is_system;
  const canDelete = can('NOTE_DELETE') || me?.is_system;

  // ── Create panel ─────────────────────────────────────────────
  const [creating,  setCreating]  = useState(false);
  const [newNote,   setNewNote]   = useState({ title: '', content: '', color: 'default' });
  const [saving,    setSaving]    = useState(false);
  const createRef = useRef(null);

  // ── Edit modal ───────────────────────────────────────────────
  const [editNote,   setEditNote]   = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  // ── Delete confirm ───────────────────────────────────────────
  const [delId,    setDelId]    = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Recycle Bin ──────────────────────────────────────────────
  const [view,      setView]      = useState('notes'); // 'notes' | 'bin'
  const [binNotes,  setBinNotes]  = useState([]);
  const [viewNote,  setViewNote]  = useState(null);    // bin note opened read-only
  const [purgeId,   setPurgeId]   = useState(null);
  const [busyId,    setBusyId]    = useState(null);
  const [undoNote,  setUndoNote]  = useState(null);    // just-deleted note offered for Undo
  const undoTimer = useRef(null);

  // ── Load ────────────────────────────────────────────────────
  const load = useCallback(async (q = searchQ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      const binParams = new URLSearchParams(params); binParams.set('bin', '1');
      const [data, bin] = await Promise.all([apiGet(`/notes?${params}`), apiGet(`/notes?${binParams}`).catch(() => [])]);
      setNotes(Array.isArray(data) ? data : []);
      setBinNotes(Array.isArray(bin) ? bin : []);
    } catch { setNotes([]); }
    finally { setLoading(false); }
  }, [searchQ]);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  useEffect(() => { load(); }, [load]);

  // search debounce
  useEffect(() => {
    const t = setTimeout(() => { setSearchQ(search); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // close create panel on outside click (only if empty)
  useEffect(() => {
    const h = (e) => {
      if (createRef.current && !createRef.current.contains(e.target)) {
        if (!newNote.title && !newNote.content) setCreating(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [newNote]);

  // ── Actions ─────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newNote.title && !newNote.content) return;
    setSaving(true);
    try {
      await apiPost('/notes', newNote);
      setNewNote({ title: '', content: '', color: 'default' });
      setCreating(false);
      load('');
      setSearch(''); setSearchQ('');
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editNote) return;
    setEditSaving(true);
    try {
      const updated = await apiPut(`/notes/${editNote.id}`, editNote);
      setNotes(ns => ns.map(n => n.id === updated.id ? updated : n));
      setEditNote(null);
    } finally { setEditSaving(false); }
  };

  // Moves the note to the Recycle Bin and offers a short-lived Undo
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const binned = await apiDelete(`/notes/${delId}`);
      setNotes(ns => ns.filter(n => n.id !== delId));
      setBinNotes(bs => [binned, ...bs.filter(b => b.id !== binned.id)]);
      setDelId(null);
      if (editNote?.id === delId) setEditNote(null);
      clearTimeout(undoTimer.current);
      setUndoNote(binned);
      undoTimer.current = setTimeout(() => setUndoNote(null), 8000);
    } finally { setDeleting(false); }
  };

  const handleRestore = async (id) => {
    setBusyId(id);
    try {
      const restored = await apiPost(`/notes/${id}/restore`, {});
      setBinNotes(bs => bs.filter(b => b.id !== id));
      setNotes(ns => [restored, ...ns.filter(n => n.id !== id)].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
      if (viewNote?.id === id) setViewNote(null);
      if (undoNote?.id === id) { setUndoNote(null); clearTimeout(undoTimer.current); }
    } finally { setBusyId(null); }
  };

  const handlePurge = async () => {
    const id = purgeId;
    setBusyId(id);
    try {
      await apiDelete(`/notes/${id}/permanent`);
      setBinNotes(bs => bs.filter(b => b.id !== id));
      setPurgeId(null);
      if (viewNote?.id === id) setViewNote(null);
    } finally { setBusyId(null); }
  };

  const openEdit = (note) => {
    if (canEdit) setEditNote({ ...note });
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-[#F4F5F7] p-6">

      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6 max-w-5xl mx-auto">
        <h1 className="text-base font-bold text-gray-700 shrink-0">My Notes</h1>
        <div className="flex shrink-0 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          {[['notes', 'Notes', notes.length], ['bin', 'Recycle Bin', binNotes.length]].map(([key, label, n]) => (
            <button key={key} onClick={() => setView(key)}
              className={`px-3 h-7 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${view === key ? 'bg-[#875A7B] text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {key === 'bin' && <TrashIcon />}
              {label}
              {key === 'bin' && n > 0 && <span className={`text-[10px] px-1.5 rounded-full ${view === key ? 'bg-white/25' : 'bg-gray-100 text-gray-500'}`}>{n}</span>}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={view === 'bin' ? 'Search Recycle Bin…' : 'Search notes…'}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#875A7B] focus:ring-1 focus:ring-[#875A7B]/30 transition shadow-sm"
          />
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {(view === 'bin' ? binNotes : notes).length} note{(view === 'bin' ? binNotes : notes).length !== 1 ? 's' : ''}
        </span>
      </div>

      {view === 'bin' && (
        <p className="max-w-5xl mx-auto -mt-3 mb-5 text-xs text-gray-500 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={2}/><path strokeLinecap="round" strokeWidth={2} d="M12 7v5l3 2"/></svg>
          Deleted notes are kept here for {BIN_DAYS} days, then removed permanently. Restore a note to move it back to your notes.
        </p>
      )}

      {/* Create panel */}
      {canCreate && view === 'notes' && (
        <div className="max-w-lg mx-auto mb-8" ref={createRef}>
          <div
            className="bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-150"
            style={{ borderColor: creating ? '#875A7B' : '#e5e7eb' }}
          >
            {creating ? (
              <>
                <input
                  autoFocus
                  value={newNote.title}
                  onChange={e => setNewNote(n => ({ ...n, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && e.target.nextSibling?.focus()}
                  placeholder="Title"
                  className="w-full px-4 pt-3 pb-2 text-sm font-semibold text-gray-800 focus:outline-none border-b border-gray-100 placeholder:font-normal placeholder:text-gray-400"
                />
                <textarea
                  value={newNote.content}
                  onChange={e => setNewNote(n => ({ ...n, content: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleCreate(); }}
                  placeholder="Take a note…"
                  rows={4}
                  className="w-full px-4 py-2.5 text-sm text-gray-700 focus:outline-none resize-none placeholder:text-gray-400"
                />
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                  <ColorPicker value={newNote.color} onChange={c => setNewNote(n => ({ ...n, color: c }))} />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-300">Ctrl+Enter to add</span>
                    <button
                      onClick={() => { setCreating(false); setNewNote({ title: '', content: '', color: 'default' }); }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition">
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={saving || (!newNote.title && !newNote.content)}
                      className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition disabled:opacity-40"
                      style={{ backgroundColor: '#875A7B' }}>
                      {saving ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <button
                className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:text-gray-500 transition flex items-center gap-2"
                onClick={() => setCreating(true)}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Take a note…
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notes grid */}
      {loading ? (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 max-w-5xl mx-auto">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="break-inside-avoid mb-3 bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
              <div className="h-3.5 bg-gray-200 rounded mb-2 w-2/3" />
              <div className="h-3 bg-gray-100 rounded mb-1.5" />
              <div className="h-3 bg-gray-100 rounded mb-1.5 w-4/5" />
              <div className="h-3 bg-gray-100 rounded w-3/5" />
            </div>
          ))}
        </div>
      ) : view === 'bin' ? (
        binNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <svg className="w-16 h-16 mb-3 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <p className="text-sm font-medium text-gray-500">{search ? 'No deleted notes match your search' : 'Recycle Bin is empty'}</p>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-3 max-w-5xl mx-auto">
            {binNotes.map(note => {
              const c = COLORS[note.color] || COLORS.default;
              const left = daysLeft(note.deleted_at);
              return (
                <div key={note.id}
                  className="break-inside-avoid mb-3 rounded-xl border border-dashed transition-shadow hover:shadow-md cursor-pointer"
                  style={{ backgroundColor: c.bg, borderColor: c.ring }}
                  onClick={() => setViewNote(note)}>
                  <div className="p-4 opacity-80">
                    {note.title && <p className="font-semibold text-gray-800 text-sm mb-1.5 leading-snug">{note.title}</p>}
                    {note.content && <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed line-clamp-[8]">{note.content}</p>}
                  </div>
                  <div className="px-4 pb-3 flex items-center justify-between gap-2">
                    <p className={`text-[10px] ${left <= 3 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                      Deleted {fmtDate(note.deleted_at)} · {left} day{left !== 1 ? 's' : ''} left
                    </p>
                    {canDelete && (
                      <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleRestore(note.id)} disabled={busyId === note.id} title="Restore note"
                          className="h-6 px-2 rounded-md bg-white/80 hover:bg-emerald-50 text-emerald-700 text-[10px] font-semibold flex items-center gap-1 shadow-sm transition">
                          <RestoreIcon /> Restore
                        </button>
                        <button onClick={() => setPurgeId(note.id)} disabled={busyId === note.id} title="Delete forever"
                          className="h-6 w-6 rounded-md bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center shadow-sm transition">
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <svg className="w-16 h-16 mb-3 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <p className="text-sm font-medium text-gray-500">
            {search ? 'No notes match your search' : 'No notes yet — take your first note!'}
          </p>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 max-w-5xl mx-auto">
          {notes.map(note => {
            const c = COLORS[note.color] || COLORS.default;
            return (
              <div
                key={note.id}
                className="break-inside-avoid mb-3 group relative rounded-xl border transition-shadow hover:shadow-md"
                style={{ backgroundColor: c.bg, borderColor: c.border, cursor: canEdit ? 'pointer' : 'default' }}
                onClick={() => openEdit(note)}
                role={canEdit ? 'button' : undefined}
              >
                <div className="p-4">
                  {note.title && (
                    <p className="font-semibold text-gray-800 text-sm mb-1.5 leading-snug">{note.title}</p>
                  )}
                  {note.content && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed line-clamp-[12]">{note.content}</p>
                  )}
                  <p className="mt-3 text-[10px] text-gray-400">{fmtDate(note.updated_at)}</p>
                </div>

                {/* Hover action buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canDelete && (
                    <button
                      onClick={e => { e.stopPropagation(); setDelId(note.id); }}
                      title="Delete note"
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-500 transition shadow-sm">
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setEditNote(null)} />
          <div
            className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: (COLORS[editNote.color] || COLORS.default).bg, maxHeight: '80vh' }}>
            <div className="flex-1 overflow-y-auto p-5">
              <input
                autoFocus
                value={editNote.title || ''}
                onChange={e => setEditNote(n => ({ ...n, title: e.target.value }))}
                placeholder="Title"
                className="w-full text-base font-semibold bg-transparent focus:outline-none placeholder:text-gray-400 placeholder:font-normal text-gray-800 border-b border-black/10 pb-2 mb-3"
              />
              <textarea
                value={editNote.content || ''}
                onChange={e => setEditNote(n => ({ ...n, content: e.target.value }))}
                placeholder="Take a note…"
                rows={10}
                className="w-full bg-transparent focus:outline-none resize-none text-sm text-gray-700 leading-relaxed placeholder:text-gray-400"
              />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-black/8 shrink-0">
              <ColorPicker
                value={editNote.color || 'default'}
                onChange={c => setEditNote(n => ({ ...n, color: c }))}
              />
              <div className="flex gap-2">
                {canDelete && (
                  <button
                    onClick={() => { setDelId(editNote.id); setEditNote(null); }}
                    className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition flex items-center gap-1.5">
                    <TrashIcon /> Delete
                  </button>
                )}
                <button
                  onClick={() => setEditNote(null)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-black/5 rounded-lg transition">
                  Close
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={editSaving}
                  className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition disabled:opacity-40"
                  style={{ backgroundColor: '#875A7B' }}>
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDelId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-900 mb-1">Delete note?</h3>
            <p className="text-sm text-gray-500 mb-5">The note will move to the Recycle Bin. You can restore it within {BIN_DAYS} days.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDelId(null)}
                className="px-4 h-8 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 h-8 text-sm rounded-lg text-white bg-red-500 hover:bg-red-600 min-w-[80px]">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deleted note — read-only view */}
      {viewNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setViewNote(null)} />
          <div className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: (COLORS[viewNote.color] || COLORS.default).bg, maxHeight: '80vh' }}>
            <div className="px-5 pt-4 pb-2 text-[11px] font-semibold text-gray-500 flex items-center gap-1.5">
              <TrashIcon /> In Recycle Bin · deleted {fmtDate(viewNote.deleted_at)} · {daysLeft(viewNote.deleted_at)} days left
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {viewNote.title && <p className="text-base font-semibold text-gray-800 border-b border-black/10 pb-2 mb-3">{viewNote.title}</p>}
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{viewNote.content}</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-black/8 shrink-0">
              {canDelete && (
                <button onClick={() => setPurgeId(viewNote.id)}
                  className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition flex items-center gap-1.5">
                  <TrashIcon /> Delete forever
                </button>
              )}
              <button onClick={() => setViewNote(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-black/5 rounded-lg transition">Close</button>
              {canDelete && (
                <button onClick={() => handleRestore(viewNote.id)} disabled={busyId === viewNote.id}
                  className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition disabled:opacity-40 flex items-center gap-1.5"
                  style={{ backgroundColor: '#875A7B' }}>
                  <RestoreIcon /> {busyId === viewNote.id ? 'Restoring…' : 'Restore'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete-forever confirm */}
      {purgeId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setPurgeId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-900 mb-1">Delete forever?</h3>
            <p className="text-sm text-gray-500 mb-5">This note will be permanently deleted and can&apos;t be recovered.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPurgeId(null)} className="px-4 h-8 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handlePurge} disabled={busyId === purgeId}
                className="px-4 h-8 text-sm rounded-lg text-white bg-red-500 hover:bg-red-600 min-w-[80px]">
                {busyId === purgeId ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo bar after moving a note to the bin */}
      {undoNote && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-lg bg-gray-900 text-white px-4 py-2.5 shadow-xl text-sm">
          <span>Note moved to Recycle Bin</span>
          <button onClick={() => handleRestore(undoNote.id)} className="font-semibold text-[#e9c8e0] hover:text-white">Undo</button>
          <button onClick={() => { setUndoNote(null); clearTimeout(undoTimer.current); }} className="text-gray-400 hover:text-white" aria-label="Dismiss">✕</button>
        </div>
      )}
    </div>
  );
}
