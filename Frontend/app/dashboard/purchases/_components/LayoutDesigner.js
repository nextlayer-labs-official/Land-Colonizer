'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPut, apiPost } from '@/lib/api';

// ── Status colours ────────────────────────────────────────────────────────────
const SC = {
  AVAILABLE:  { bg: '#fefce8', bd: '#fbbf24', tx: '#78350f', lb: 'Avail'  },
  RESERVED:   { bg: '#fff7ed', bd: '#f97316', tx: '#7c2d12', lb: 'Rsvd'   },
  SOLD:       { bg: '#eff6ff', bd: '#3b82f6', tx: '#1e3a8a', lb: 'Sold'   },
  REGISTERED: { bg: '#f5f3ff', bd: '#8b5cf6', tx: '#4c1d95', lb: 'Reg'    },
  ATTORNEY:   { bg: '#fdf4ff', bd: '#d946ef', tx: '#701a75', lb: 'Atty'   },
  FULL_FINAL: { bg: '#f0fdf4', bd: '#22c55e', tx: '#14532d', lb: 'F&F'    },
};
const DC = { bg: '#f9fafb', bd: '#d1d5db', tx: '#6b7280', lb: '—' };

const snapTo = (v, g) => Math.round(v / g) * g;
const mkId   = () => Math.random().toString(36).slice(2, 9);

// ── Main ─────────────────────────────────────────────────────────────────────
export default function LayoutDesigner({ purchaseId, inventory = [], canEdit = true }) {
  const scrollRef   = useRef(null);
  const interactRef = useRef(null);   // current pointer interaction
  const drawPrevRef = useRef(null);   // draw preview synced from state
  const snapRef     = useRef(10);
  const toolRef     = useRef('select');
  const selRef      = useRef(null);
  const itemsRef    = useRef([]);

  const [layout,       setLayout]      = useState(null);
  const [loading,      setLoading]     = useState(true);
  const [saving,       setSaving]      = useState(false);
  const [saved,        setSaved]       = useState(false);
  const [items,        setItems]       = useState([]);
  const [canvasW,      setCanvasW]     = useState(1200);
  const [canvasH,      setCanvasH]     = useState(1500);
  const [snapG,        setSnapG]       = useState(10);
  const [tool,         setTool]        = useState('select');
  const [selected,     setSelected]    = useState(null);
  const [drawPreview,  setDrawPreview] = useState(null);
  const [lockConfirm,  setLockConfirm] = useState(false);
  const [configOpen,   setConfigOpen]  = useState(false);
  const [editLabel,    setEditLabel]   = useState(null);  // {id, value}

  // Keep refs in sync
  useEffect(() => { itemsRef.current = items; },   [items]);
  useEffect(() => { snapRef.current  = snapG; },   [snapG]);
  useEffect(() => { toolRef.current  = tool; },    [tool]);
  useEffect(() => { selRef.current   = selected; },[selected]);
  useEffect(() => { drawPrevRef.current = drawPreview; }, [drawPreview]);

  // Load
  useEffect(() => {
    if (!purchaseId) return;
    apiGet(`/purchases/${purchaseId}/layout`)
      .then(d => {
        if (d) {
          setLayout(d);
          setItems(Array.isArray(d.items) ? d.items : []);
          if (d.grid_cols > 100) setCanvasW(d.grid_cols);
          if (d.grid_rows > 100) setCanvasH(d.grid_rows);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [purchaseId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current) {
        if (layout?.locked || !canEdit) return;
        setItems(prev => prev.filter(i => i.id !== selRef.current));
        setSelected(null);
      }
      if (e.key === 'Escape') { setSelected(null); setEditLabel(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [layout, canEdit]);

  const locked    = layout?.locked || false;
  const placedIds = new Set(items.filter(i => i.type === 'plot').map(i => i.inventory_id));
  const unplaced  = inventory.filter(u => !placedIds.has(u.id));
  const unitFor   = id => inventory.find(u => u.id === id);

  // ── Canvas coordinate helper ───────────────────────────────────────────────
  const getPos = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: e.clientX - rect.left + el.scrollLeft,
      y: e.clientY - rect.top  + el.scrollTop,
    };
  }, []);

  // ── Pointer handlers (all on the scroll container) ────────────────────────
  const onPointerDown = useCallback((e) => {
    if (locked || !canEdit) return;
    const pos = getPos(e);

    // Resize handle?
    const resizeEl = e.target.closest('[data-resize]');
    if (resizeEl) {
      const id   = resizeEl.dataset.resize;
      const item = itemsRef.current.find(i => i.id === id);
      if (!item) return;
      interactRef.current = { type: 'resize', id, sx: pos.x, sy: pos.y, ow: item.w, oh: item.h };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault(); e.stopPropagation();
      return;
    }

    // Item drag?
    const itemEl = e.target.closest('[data-item]');
    if (itemEl) {
      const id   = itemEl.dataset.item;
      const item = itemsRef.current.find(i => i.id === id);
      if (!item || toolRef.current !== 'select') return;
      setSelected(id);
      setEditLabel(null);
      interactRef.current = { type: 'drag', id, ox: pos.x - item.x, oy: pos.y - item.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Canvas background
    setSelected(null);
    setEditLabel(null);
    const t = toolRef.current;
    if (t === 'road' || t === 'open') {
      interactRef.current = { type: 'draw', tool: t, sx: pos.x, sy: pos.y };
      setDrawPreview({ tool: t, x: pos.x, y: pos.y, w: 0, h: 0 });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [locked, canEdit, getPos]);

  const onPointerMove = useCallback((e) => {
    const intr = interactRef.current;
    if (!intr) return;
    const pos = getPos(e);
    const g   = snapRef.current;

    if (intr.type === 'drag') {
      const x = snapTo(pos.x - intr.ox, g);
      const y = snapTo(pos.y - intr.oy, g);
      setItems(prev => prev.map(i => i.id === intr.id ? { ...i, x, y } : i));
    }
    if (intr.type === 'resize') {
      const w = snapTo(Math.max(50, intr.ow + (pos.x - intr.sx)), g);
      const h = snapTo(Math.max(36, intr.oh + (pos.y - intr.sy)), g);
      setItems(prev => prev.map(i => i.id === intr.id ? { ...i, w, h } : i));
    }
    if (intr.type === 'draw') {
      setDrawPreview({
        tool: intr.tool,
        x: Math.min(intr.sx, pos.x),
        y: Math.min(intr.sy, pos.y),
        w: Math.abs(pos.x - intr.sx),
        h: Math.abs(pos.y - intr.sy),
      });
    }
  }, [getPos]);

  const onPointerUp = useCallback((e) => {
    const intr = interactRef.current;
    if (!intr) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}

    if (intr.type === 'draw') {
      const dp = drawPrevRef.current;
      if (dp && dp.w > 15 && dp.h > 10) {
        const g = snapRef.current;
        setItems(prev => [...prev, {
          id: mkId(), type: intr.tool,
          x: snapTo(dp.x, g), y: snapTo(dp.y, g),
          w: snapTo(dp.w, g), h: snapTo(dp.h, g),
          label: intr.tool === 'road' ? '7.50 MT WIDE ROAD' : 'C.O.P. (Garden)',
        }]);
      }
      setDrawPreview(null);
    }
    interactRef.current = null;
  }, []);

  // ── HTML5 drag from sidebar ───────────────────────────────────────────────
  const onSidebarDragStart = (e, inventoryId) => {
    if (locked || !canEdit) { e.preventDefault(); return; }
    e.dataTransfer.setData('text/plain', String(inventoryId));
    e.dataTransfer.effectAllowed = 'copy';
  };
  const onCanvasDragOver = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  const onCanvasDrop = e => {
    e.preventDefault();
    if (locked || !canEdit) return;
    const inventoryId = Number(e.dataTransfer.getData('text/plain'));
    if (!inventoryId) return;
    const pos = getPos(e);
    const g   = snapRef.current;
    setItems(prev => [
      ...prev.filter(i => !(i.type === 'plot' && i.inventory_id === inventoryId)),
      { id: mkId(), type: 'plot', inventory_id: inventoryId, x: snapTo(pos.x - 40, g), y: snapTo(pos.y - 30, g), w: 80, h: 60 },
    ]);
  };

  // ── Label edit ────────────────────────────────────────────────────────────
  const startEdit = (e, item) => {
    if (locked || !canEdit) return;
    e.stopPropagation();
    setEditLabel({ id: item.id, value: item.label || '' });
  };
  const commitEdit = () => {
    if (!editLabel) return;
    setItems(prev => prev.map(i => i.id === editLabel.id ? { ...i, label: editLabel.value } : i));
    setEditLabel(null);
  };

  // ── Rotate item (swap w ↔ h) ─────────────────────────────────────────────
  const rotateItem = useCallback((e, id) => {
    e.stopPropagation();
    setItems(prev => prev.map(i => i.id === id ? { ...i, w: i.h, h: i.w, rotated: !i.rotated } : i));
  }, []);

  // ── Save / lock ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      const d = await apiPut(`/purchases/${purchaseId}/layout`, { grid_rows: canvasH, grid_cols: canvasW, items });
      setLayout(d); setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch {}
    finally { setSaving(false); }
  };
  const handleToggleLock = async () => {
    try { const d = await apiPost(`/purchases/${purchaseId}/layout/lock`, {}); setLayout(d); setLockConfirm(false); }
    catch {}
  };

  if (loading) return <div className="py-16 text-center text-sm text-gray-400">Loading layout…</div>;

  const cursor = { select: 'default', road: 'crosshair', open: 'crosshair' }[tool] || 'default';

  const ToolBtn = ({ t, label, color }) => (
    <button onClick={() => setTool(t)}
      className="h-8 px-3 text-xs font-bold rounded-lg border transition select-none"
      style={tool === t
        ? { backgroundColor: color, color: '#fff', borderColor: color }
        : { color: '#6b7280', borderColor: '#e5e7eb', backgroundColor: 'transparent' }}>
      {label}
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4" style={{ minHeight: 600 }}>

      {/* ──────────── Sidebar ──────────── */}
      <div className="w-48 shrink-0 flex flex-col rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
        <div className="px-3 py-2.5 border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Inventory Units</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{unplaced.length} unplaced · {placedIds.size} on canvas</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
          {unplaced.length === 0
            ? <p className="text-[10px] text-gray-300 text-center mt-10">All units placed</p>
            : unplaced.map(u => {
                const c = SC[u.status] || DC;
                return (
                  <div key={u.id}
                    draggable={!locked && canEdit}
                    onDragStart={e => onSidebarDragStart(e, u.id)}
                    className="rounded-lg flex flex-col p-1.5 select-none"
                    style={{
                      height: 54, border: `2px solid ${c.bd}`, backgroundColor: c.bg,
                      cursor: !locked && canEdit ? 'grab' : 'default',
                    }}>
                    <p className="text-[12px] font-black leading-none truncate" style={{ color: c.tx }}>
                      {u.plot_no || u.sl_no || `#${u.id}`}
                    </p>
                    {(u.front_area && u.back_area) ? (
                      <p className="text-[9px] mt-0.5 opacity-75 truncate font-semibold" style={{ color: c.tx }}>
                        {u.front_area}{u.front_area_details || ''} × {u.back_area}{u.front_area_details || ''}
                      </p>
                    ) : u.area ? (
                      <p className="text-[9px] mt-0.5 opacity-70 truncate" style={{ color: c.tx }}>
                        {Number(u.area).toFixed(0)} {u.area_unit || ''}
                      </p>
                    ) : null}
                    <span className="mt-auto text-[7px] font-bold px-1 py-px rounded-sm self-start"
                      style={{ backgroundColor: c.bd + '50', color: c.tx }}>{c.lb}</span>
                  </div>
                );
              })}
        </div>
        {/* Legend */}
        <div className="px-3 py-2 border-t border-gray-100 space-y-0.5 shrink-0">
          <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest mb-1">Status</p>
          {Object.entries(SC).map(([, c]) => (
            <div key={c.lb} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm border shrink-0" style={{ backgroundColor: c.bg, borderColor: c.bd }} />
              <span className="text-[8px] text-gray-500">{c.lb}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1 space-y-0.5">
            {[['#bae6fd','#0369a1','Road'],['#bbf7d0','#22c55e','Garden']].map(([bg,bd,lb]) => (
              <div key={lb} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm border shrink-0" style={{ backgroundColor: bg, borderColor: bd }} />
                <span className="text-[8px] text-gray-500">{lb}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ──────────── Canvas area ──────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {!locked && canEdit ? (
            <>
              <ToolBtn t="select" label="↖ Select & Move" color="#875A7B" />
              <ToolBtn t="road"   label="⏤ Draw Road"     color="#0369a1" />
              <ToolBtn t="open"   label="🌿 Draw Garden"   color="#15803d" />
              <div className="h-5 w-px bg-gray-200 mx-0.5" />
              {selected && (
                <button
                  onClick={() => { setItems(p => p.filter(i => i.id !== selected)); setSelected(null); }}
                  className="h-8 px-3 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition font-semibold">
                  ✕ Delete
                </button>
              )}
              <button onClick={() => setConfigOpen(v => !v)}
                className={`h-8 px-3 text-xs border rounded-lg transition ${configOpen ? 'border-[#875A7B] text-[#875A7B]' : 'border-gray-200 text-gray-500'}`}>
                Canvas
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={handleSave} disabled={saving}
                  className="h-8 px-4 text-xs rounded-lg text-white font-semibold transition"
                  style={{ backgroundColor: saved ? '#059669' : '#875A7B' }}>
                  {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Layout'}
                </button>
                <button onClick={() => setLockConfirm(true)}
                  className="h-8 px-3 text-xs border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition">
                  Lock
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                Layout Locked
              </span>
              {canEdit && (
                <button onClick={() => setLockConfirm(true)}
                  className="h-8 px-3 text-xs border border-gray-200 text-gray-600 rounded-lg ml-2">Unlock</button>
              )}
            </>
          )}
        </div>

        {/* Canvas config */}
        {configOpen && !locked && canEdit && (
          <div className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-2 flex-wrap">
            {[['Width', canvasW, setCanvasW, 600, 3000], ['Height', canvasH, setCanvasH, 600, 5000]].map(([lbl, val, setter, min, max]) => (
              <div key={lbl} className="flex items-center gap-2">
                <label className="text-xs text-gray-500">{lbl} (px)</label>
                <input type="number" min={min} max={max} step={50} value={val}
                  onChange={e => setter(Math.max(min, Math.min(max, Number(e.target.value))))}
                  className="w-20 h-7 px-2 text-sm border border-gray-200 rounded text-center focus:outline-none focus:border-[#875A7B]" />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Snap</label>
              <select value={snapG} onChange={e => setSnapG(Number(e.target.value))}
                className="h-7 px-2 text-xs border border-gray-200 rounded focus:outline-none">
                {[5,10,20,40].map(v => <option key={v} value={v}>{v}px</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Hint strip */}
        <div className="text-[10px] text-gray-400 mb-2">
          {!locked && tool === 'select' && (
            <span>
              <span className="font-semibold text-[#875A7B]">Drag</span> sidebar units onto canvas to place &nbsp;·&nbsp;
              <span className="font-semibold text-[#875A7B]">Drag</span> placed items to move &nbsp;·&nbsp;
              <span className="font-semibold text-[#875A7B]">Corner handle</span> to resize &nbsp;·&nbsp;
              <span className="font-semibold text-[#875A7B]">Del</span> to remove &nbsp;·&nbsp;
              <span className="font-semibold text-[#875A7B]">Dbl-click</span> road/garden to rename
            </span>
          )}
          {!locked && tool === 'road'   && <span className="text-[#0369a1] font-semibold">Click and drag on the canvas to draw a road area</span>}
          {!locked && tool === 'open'   && <span className="text-[#15803d] font-semibold">Click and drag on the canvas to draw a garden / open area</span>}
          {locked && <span className="text-amber-600">Layout is locked — unlock to make changes</span>}
        </div>

        {/* ── Scrollable canvas ── */}
        <div
          ref={scrollRef}
          className="flex-1 rounded-xl border border-gray-300 overflow-auto"
          style={{ minHeight: 400, maxHeight: 660, cursor, backgroundColor: '#d8dce5', userSelect: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}>

          {/* Inner canvas — position: relative, dot grid */}
          <div
            style={{
              position: 'relative', width: canvasW, height: canvasH,
              backgroundImage: 'radial-gradient(circle, #b0b5c0 1px, transparent 1px)',
              backgroundSize: `${Math.max(snapG * 2, 20)}px ${Math.max(snapG * 2, 20)}px`,
            }}>

            {/* Items */}
            {items.map(item => {
              const isSel    = selected === item.id;
              const selStyle = isSel ? { outline: '2px solid #875A7B', outlineOffset: 2, zIndex: 10 } : {};
              const basePos  = { position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h };

              /* ── Plot ── */
              if (item.type === 'plot') {
                const unit = unitFor(item.inventory_id);
                if (!unit) return null;
                const c = SC[unit.status] || DC;
                const fa = unit.front_area, ba = unit.back_area;
                const unit_ = unit.front_area_details || '';
                // Show front × back; when rotated swap them
                const dimLabel = fa && ba
                  ? item.rotated
                    ? `${ba}${unit_} × ${fa}${unit_}`
                    : `${fa}${unit_} × ${ba}${unit_}`
                  : unit.area ? `${Number(unit.area).toFixed(0)} ${unit.area_unit || ''}` : '';
                return (
                  <div key={item.id} data-item={item.id}
                    style={{ ...basePos, ...selStyle, backgroundColor: c.bg, border: `2px solid ${c.bd}`, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '3px 5px', touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default' }}>
                    <p style={{ fontSize: 13, fontWeight: 900, color: c.tx, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {unit.plot_no || unit.sl_no || `#${unit.id}`}
                    </p>
                    {dimLabel && (
                      <p style={{ fontSize: 9, color: c.tx, opacity: 0.75, marginTop: 2, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                        {dimLabel}
                      </p>
                    )}
                    <span style={{ marginTop: 'auto', fontSize: 7, fontWeight: 700, padding: '1px 3px', borderRadius: 2, backgroundColor: c.bd + '50', color: c.tx, display: 'inline-block' }}>
                      {c.lb}
                    </span>
                    {isSel && !locked && canEdit && (
                      <>
                        {/* Rotate button */}
                        <button
                          data-item={item.id}
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => rotateItem(e, item.id)}
                          title="Rotate 90°"
                          style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, backgroundColor: '#875A7B', border: 'none', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                          </svg>
                        </button>
                        <ResizeHandle id={item.id} color="#875A7B" />
                      </>
                    )}
                  </div>
                );
              }

              /* ── Road ── */
              if (item.type === 'road') {
                const isEditThis = editLabel?.id === item.id;
                return (
                  <div key={item.id} data-item={item.id}
                    onDoubleClick={e => startEdit(e, item)}
                    style={{ ...basePos, ...selStyle, backgroundColor: '#bae6fd', border: `2px solid ${isSel ? '#875A7B' : '#7dd3fc'}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default' }}>
                    {isEditThis ? (
                      <input autoFocus value={editLabel.value}
                        onChange={e => setEditLabel(p => ({ ...p, value: e.target.value }))}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditLabel(null); }}
                        onClick={e => e.stopPropagation()}
                        style={{ border: 'none', background: 'transparent', textAlign: 'center', fontSize: 11, fontWeight: 900, color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: '0.08em', width: '92%', outline: 'none' }} />
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 900, color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: '0.08em', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 8px' }}>
                        {item.label || '7.50 MT WIDE ROAD'}
                      </span>
                    )}
                    {isSel && !locked && canEdit && <ResizeHandle id={item.id} color="#0369a1" />}
                  </div>
                );
              }

              /* ── Open / Garden ── */
              if (item.type === 'open') {
                const isEditThis = editLabel?.id === item.id;
                return (
                  <div key={item.id} data-item={item.id}
                    onDoubleClick={e => startEdit(e, item)}
                    style={{ ...basePos, ...selStyle, backgroundColor: '#bbf7d0', border: `2px solid ${isSel ? '#875A7B' : '#4ade80'}`, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default' }}>
                    <span style={{ fontSize: Math.min(item.h / 3, 24), lineHeight: 1, pointerEvents: 'none' }}>🌿</span>
                    {isEditThis ? (
                      <input autoFocus value={editLabel.value}
                        onChange={e => setEditLabel(p => ({ ...p, value: e.target.value }))}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditLabel(null); }}
                        onClick={e => e.stopPropagation()}
                        style={{ border: 'none', background: 'transparent', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#14532d', width: '90%', outline: 'none' }} />
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#14532d', textAlign: 'center', pointerEvents: 'none', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {item.label || 'Garden'}
                      </span>
                    )}
                    {isSel && !locked && canEdit && <ResizeHandle id={item.id} color="#15803d" />}
                  </div>
                );
              }
              return null;
            })}

            {/* Draw preview */}
            {drawPreview && drawPreview.w > 5 && drawPreview.h > 5 && (
              <div style={{
                position: 'absolute', left: drawPreview.x, top: drawPreview.y,
                width: drawPreview.w, height: drawPreview.h, pointerEvents: 'none', borderRadius: 4,
                backgroundColor: drawPreview.tool === 'road' ? '#bae6fd70' : '#bbf7d070',
                border: `2px dashed ${drawPreview.tool === 'road' ? '#0369a1' : '#15803d'}`,
              }} />
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
          <span>{items.filter(i => i.type === 'plot').length} plots</span>
          <span>{items.filter(i => i.type === 'road').length} roads</span>
          <span>{items.filter(i => i.type === 'open').length} gardens</span>
          <span>{unplaced.length} unplaced</span>
          {!locked && <span className="ml-auto">Canvas {canvasW}×{canvasH}px · Snap {snapG}px</span>}
        </div>
      </div>

      {/* ── Lock confirm ── */}
      {lockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setLockConfirm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-black text-gray-900 mb-2">{locked ? 'Unlock Layout?' : 'Lock Layout?'}</h3>
            <p className="text-sm text-gray-500 mb-5">
              {locked ? 'Allow editing and moving plots again.' : 'Freeze the layout — no further changes until unlocked.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setLockConfirm(false)} className="h-9 px-4 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleToggleLock} className="h-9 px-5 text-sm rounded-xl text-white font-semibold"
                style={{ backgroundColor: locked ? '#875A7B' : '#d97706' }}>
                {locked ? 'Unlock' : 'Lock Layout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Resize handle (bottom-right corner) ──────────────────────────────────────
function ResizeHandle({ id, color }) {
  return (
    <div
      data-resize={id}
      style={{
        position: 'absolute', right: 0, bottom: 0,
        width: 12, height: 12,
        backgroundColor: color,
        borderRadius: '4px 0 3px 0',
        cursor: 'nwse-resize',
        touchAction: 'none',
      }}
    />
  );
}
