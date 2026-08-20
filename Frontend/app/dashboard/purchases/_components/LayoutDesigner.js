'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPut, apiPost } from '@/lib/api';

// ── Status colours ────────────────────────────────────────────────────────────
const SC = {
  AVAILABLE:  { bg: '#fffde7', bg2: '#fef9c3', bd: '#d97706', tx: '#78350f', lb: 'Avail'  },
  RESERVED:   { bg: '#fee2e2', bg2: '#fecaca', bd: '#dc2626', tx: '#7f1d1d', lb: 'Rsvd'   },
  SOLD:       { bg: '#fee2e2', bg2: '#fecaca', bd: '#b91c1c', tx: '#7f1d1d', lb: 'Sold'   },
  REGISTERED: { bg: '#dbeafe', bg2: '#bfdbfe', bd: '#2563eb', tx: '#1e3a8a', lb: 'Reg'    },
  ATTORNEY:   { bg: '#fef9c3', bg2: '#fef08a', bd: '#b45309', tx: '#451a03', lb: 'Atty'   },
  FULL_FINAL: { bg: '#dcfce7', bg2: '#bbf7d0', bd: '#15803d', tx: '#14532d', lb: 'F&F'    },
};
const DC = { bg: '#f9fafb', bg2: '#f3f4f6', bd: '#9ca3af', tx: '#6b7280', lb: '—' };

const snapTo = (v, g) => Math.round(v / g) * g;
const mkId   = () => Math.random().toString(36).slice(2, 9);
const DIM_INSET = 12; // px from rect edge for inside dimension lines

// ── Dimension label along top/bottom edge (inside the rect) ───────────────────
function DimH({ x1, x2, y, label }) {
  if (!label) return null;
  const cx = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1 + 4} y1={y} x2={x2 - 4} y2={y} stroke="#374151" strokeWidth="0.8"/>
      <line x1={x1 + 4} y1={y - 4} x2={x1 + 4} y2={y + 4} stroke="#374151" strokeWidth="0.8"/>
      <line x1={x2 - 4} y1={y - 4} x2={x2 - 4} y2={y + 4} stroke="#374151" strokeWidth="0.8"/>
      <text x={cx} y={y - 2} textAnchor="middle" fontSize="8" fontWeight="700" fill="#1f2937" fontFamily="sans-serif">{label}</text>
    </g>
  );
}

// ── Dimension label along left/right edge (inside the rect, rotated) ──────────
function DimV({ x, y1, y2, label, anchor = 'end' }) {
  if (!label) return null;
  const cy = (y1 + y2) / 2;
  const dx = anchor === 'end' ? -4 : 4;
  return (
    <g>
      <line x1={x} y1={y1 + 4} x2={x} y2={y2 - 4} stroke="#374151" strokeWidth="0.8"/>
      <line x1={x - 4} y1={y1 + 4} x2={x + 4} y2={y1 + 4} stroke="#374151" strokeWidth="0.8"/>
      <line x1={x - 4} y1={y2 - 4} x2={x + 4} y2={y2 - 4} stroke="#374151" strokeWidth="0.8"/>
      <text
        x={x + dx} y={cy}
        textAnchor={anchor}
        fontSize="8" fontWeight="700" fill="#1f2937" fontFamily="sans-serif"
        transform={`rotate(-90,${x + dx},${cy})`}
      >{label}</text>
    </g>
  );
}

// ── Plot SVG content ──────────────────────────────────────────────────────────
function PlotContent({ item, unit, isSel }) {
  const c   = SC[unit?.status] || DC;
  const W   = item.w, H = item.h;
  const gid = `pg-${item.id}`;
  const no  = unit ? (unit.plot_no || unit.sl_no || `#${unit.id}`) : '?';

  // Area label: split number and unit for two-line display
  let areaNum = '', areaUnit = '';
  if (unit) {
    if (unit.area) {
      areaNum  = Number(unit.area).toFixed(2);
      areaUnit = unit.area_unit || 'Sq.Yds.';
    }
  }

  // Dimension labels from DB fields:
  // front_area → top & bottom (front of plot); back_area → left & right (depth/sides)
  const dimUnit  = unit?.front_area_details || '';
  const frontDim = unit?.front_area ? `${unit.front_area}${dimUnit}` : null;
  const backDim  = unit?.back_area  ? `${unit.back_area}${dimUnit}`  : null;

  // Content area (inside the dim-line insets)
  const cx      = W / 2;
  const inner_y1 = DIM_INSET + 4;
  const inner_y2 = H - DIM_INSET - 4;
  const innerH   = inner_y2 - inner_y1;

  // Oval sizing — constrained to inner width
  const noStr  = String(no);
  const ovalRx = Math.min(Math.max(12, noStr.length * 4.5 + 4), W / 2 - 8);
  const ovalRy = Math.min(10, innerH * 0.28);

  // Vertical positions: oval in upper portion, area below
  const ovalCy   = inner_y1 + ovalRy + 2;
  const areaY1   = ovalCy + ovalRy + 6;   // top of area text
  const fontSize  = Math.min(11, (inner_y2 - areaY1) * 0.55);
  const smallFont = Math.min(8,  (inner_y2 - areaY1) * 0.35);

  return (
    <>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.bg2}/>
          <stop offset="100%" stopColor={c.bg}/>
        </linearGradient>
      </defs>

      {/* Selection ring */}
      {isSel && (
        <rect x={-3} y={-3} width={W + 6} height={H + 6}
          fill="none" stroke="#875A7B" strokeWidth="2" strokeDasharray="5 2.5" rx="5"/>
      )}

      {/* Plot rectangle */}
      <rect x={0} y={0} width={W} height={H}
        fill={`url(#${gid})`} stroke={c.bd} strokeWidth={isSel ? 2.5 : 1.8} rx="3"/>

      {/* Plot number oval — centered, upper portion */}
      <ellipse cx={cx} cy={ovalCy} rx={ovalRx} ry={ovalRy}
        fill="white" stroke={c.bd} strokeWidth="1.5"/>
      <text x={cx} y={ovalCy + ovalRy * 0.38}
        textAnchor="middle" fontSize={Math.min(11, ovalRy * 1.6)}
        fontWeight="900" fill={c.tx} fontFamily="sans-serif">{no}</text>

      {/* Area text — centered, below oval */}
      {areaNum && fontSize > 3 && (
        <>
          <text x={cx} y={areaY1 + fontSize}
            textAnchor="middle" fontSize={fontSize} fontWeight="700" fill={c.tx} fontFamily="sans-serif">
            {areaNum}
          </text>
          {areaUnit && smallFont > 2 && (
            <text x={cx} y={areaY1 + fontSize + smallFont + 1}
              textAnchor="middle" fontSize={smallFont} fontWeight="600" fill={c.tx} opacity="0.8" fontFamily="sans-serif">
              {areaUnit}
            </text>
          )}
        </>
      )}

      {/* Dimension lines — swap when rotated so labels follow orientation */}
      {(() => {
        const hDim = item.rotated ? backDim  : frontDim;
        const vDim = item.rotated ? frontDim : backDim;
        return (
          <>
            <DimH x1={0} x2={W} y={DIM_INSET}       label={hDim} />
            <DimH x1={0} x2={W} y={H - DIM_INSET}   label={hDim} />
            <DimV x={DIM_INSET}     y1={0} y2={H}   label={vDim} anchor="start" />
            <DimV x={W - DIM_INSET} y1={0} y2={H}   label={vDim} anchor="end"   />
          </>
        );
      })()}
    </>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function LayoutDesigner({ purchaseId, inventory = [], canEdit = true }) {
  const scrollRef    = useRef(null);
  const interactRef  = useRef(null);
  const drawPrevRef  = useRef(null);
  const snapRef      = useRef(10);
  const toolRef      = useRef('select');
  const selRef       = useRef(null);
  const itemsRef     = useRef([]);

  const [layout,      setLayout]     = useState(null);
  const [loading,     setLoading]    = useState(true);
  const [saving,      setSaving]     = useState(false);
  const [saved,       setSaved]      = useState(false);
  const [items,       setItems]      = useState([]);
  const [canvasW,     setCanvasW]    = useState(1400);
  const [canvasH,     setCanvasH]    = useState(1800);
  const [snapG,       setSnapG]      = useState(10);
  const [tool,        setTool]       = useState('select');
  const [selected,    setSelected]   = useState(null);
  const [drawPreview, setDrawPreview]= useState(null);
  const [lockConfirm, setLockConfirm]= useState(false);
  const [configOpen,  setConfigOpen] = useState(false);
  const [editLabel,   setEditLabel]  = useState(null);

  useEffect(() => { itemsRef.current  = items;   }, [items]);
  useEffect(() => { snapRef.current   = snapG;   }, [snapG]);
  useEffect(() => { toolRef.current   = tool;    }, [tool]);
  useEffect(() => { selRef.current    = selected;}, [selected]);
  useEffect(() => { drawPrevRef.current = drawPreview; }, [drawPreview]);

  // Load layout
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

  const getPos = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left + el.scrollLeft, y: e.clientY - rect.top + el.scrollTop };
  }, []);

  const onPointerDown = useCallback((e) => {
    if (locked || !canEdit) return;
    const pos = getPos(e);

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
      const w = snapTo(Math.max(60, intr.ow + (pos.x - intr.sx)), g);
      const h = snapTo(Math.max(40, intr.oh + (pos.y - intr.sy)), g);
      setItems(prev => prev.map(i => i.id === intr.id ? { ...i, w, h } : i));
    }
    if (intr.type === 'draw') {
      setDrawPreview({
        tool: intr.tool,
        x: Math.min(intr.sx, pos.x), y: Math.min(intr.sy, pos.y),
        w: Math.abs(pos.x - intr.sx), h: Math.abs(pos.y - intr.sy),
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

  // Sidebar drag-and-drop
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
      { id: mkId(), type: 'plot', inventory_id: inventoryId, x: snapTo(pos.x - 50, g), y: snapTo(pos.y - 35, g), w: 100, h: 70 },
    ]);
  };

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

  const rotateItem = useCallback((e, id) => {
    e.stopPropagation();
    setItems(prev => prev.map(i => i.id === id ? { ...i, w: i.h, h: i.w, rotated: !i.rotated } : i));
  }, []);

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

  return (
    <div className="flex gap-4" style={{ minHeight: 600 }}>

      {/* ── Sidebar ── */}
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
                const no = u.plot_no || u.sl_no || `#${u.id}`;
                const area = u.area ? `${Number(u.area).toFixed(0)} ${u.area_unit || ''}` : '';
                return (
                  <div key={u.id}
                    draggable={!locked && canEdit}
                    onDragStart={e => onSidebarDragStart(e, u.id)}
                    className="rounded-lg p-1.5 select-none"
                    style={{ border: `2px solid ${c.bd}`, backgroundColor: c.bg2, cursor: !locked && canEdit ? 'grab' : 'default' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black leading-none" style={{ color: c.tx }}>{no}</span>
                      {area && <span className="text-[9px] opacity-70 truncate font-semibold" style={{ color: c.tx }}>{area}</span>}
                    </div>
                    <span className="mt-1 text-[7px] font-bold px-1 py-px rounded-sm inline-block"
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
              <span className="w-2 h-2 rounded-sm border shrink-0" style={{ backgroundColor: c.bg2, borderColor: c.bd }}/>
              <span className="text-[8px] text-gray-500">{c.lb}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1 space-y-0.5">
            {[['#bae6fd','#0369a1','Road'],['#bbf7d0','#22c55e','Garden']].map(([bg,bd,lb]) => (
              <div key={lb} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm border shrink-0" style={{ backgroundColor: bg, borderColor: bd }}/>
                <span className="text-[8px] text-gray-500">{lb}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {!locked && canEdit ? (
            <>
              <ToolBtn t="select" label="↖ Select" color="#875A7B" />
              <ToolBtn t="road"   label="⏤ Road"   color="#0369a1" />
              <ToolBtn t="open"   label="🌿 Garden" color="#15803d" />
              <div className="h-5 w-px bg-gray-200 mx-0.5"/>
              {selected && (() => {
                const si = items.find(i => i.id === selected);
                return (
                  <>
                    {si?.type === 'plot' && (
                      <button onClick={e => rotateItem(e, selected)}
                        className="h-8 px-3 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition font-semibold">
                        ↺ Rotate
                      </button>
                    )}
                    <button onClick={() => { setItems(p => p.filter(i => i.id !== selected)); setSelected(null); }}
                      className="h-8 px-3 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition font-semibold">
                      ✕ Remove
                    </button>
                  </>
                );
              })()}
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
            {[['Width', canvasW, setCanvasW, 600, 4000], ['Height', canvasH, setCanvasH, 600, 6000]].map(([lbl, val, setter, min, max]) => (
              <div key={lbl} className="flex items-center gap-2">
                <label className="text-xs text-gray-500">{lbl} (px)</label>
                <input type="number" min={min} max={max} step={50} value={val}
                  onChange={e => setter(Math.max(min, Math.min(max, Number(e.target.value))))}
                  className="w-20 h-7 px-2 text-sm border border-gray-200 rounded text-center focus:outline-none focus:border-[#875A7B]"/>
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
              <span className="font-semibold text-[#875A7B]">Corner</span> to resize &nbsp;·&nbsp;
              <span className="font-semibold text-[#875A7B]">Del</span> to remove
            </span>
          )}
          {!locked && tool === 'road' && <span className="text-[#0369a1] font-semibold">Click and drag to draw a road area</span>}
          {!locked && tool === 'open' && <span className="text-[#15803d] font-semibold">Click and drag to draw a garden / open area</span>}
          {locked && <span className="text-amber-600">Layout is locked — unlock to make changes</span>}
        </div>

        {/* ── Scrollable canvas ── */}
        <div
          ref={scrollRef}
          className="flex-1 rounded-xl border border-gray-300 overflow-auto"
          style={{ minHeight: 400, maxHeight: 700, cursor, backgroundColor: '#c8cdd8', userSelect: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}>

          <div style={{
            position: 'relative', width: canvasW, height: canvasH,
            backgroundImage: 'radial-gradient(circle, #a0a5b0 1px, transparent 1px)',
            backgroundSize: `${Math.max(snapG * 2, 20)}px ${Math.max(snapG * 2, 20)}px`,
          }}>

            {items.map(item => {
              const isSel   = selected === item.id;
              const basePos = { position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h };

              /* ── Plot ── */
              if (item.type === 'plot') {
                const unit = unitFor(item.inventory_id);
                if (!unit) return null;
                return (
                  <div key={item.id} data-item={item.id}
                    style={{ ...basePos, touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default' }}>
                    <svg width={item.w} height={item.h} style={{ overflow: 'visible', display: 'block' }}>
                      <PlotContent item={item} unit={unit} isSel={isSel}/>
                    </svg>
                    {isSel && !locked && canEdit && (
                      <ResizeHandle id={item.id} color="#875A7B"/>
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
                    style={{ ...basePos, backgroundColor: '#bae6fd', border: `2px solid ${isSel ? '#875A7B' : '#7dd3fc'}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default',
                      outline: isSel ? '2px solid #875A7B' : 'none', outlineOffset: 2 }}>
                    {isEditThis ? (
                      <input autoFocus value={editLabel.value}
                        onChange={e => setEditLabel(p => ({ ...p, value: e.target.value }))}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditLabel(null); }}
                        onClick={e => e.stopPropagation()}
                        style={{ border: 'none', background: 'transparent', textAlign: 'center', fontSize: 11, fontWeight: 900, color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: '0.08em', width: '92%', outline: 'none' }}/>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 900, color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: '0.08em', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 8px' }}>
                        {item.label || '7.50 MT WIDE ROAD'}
                      </span>
                    )}
                    {isSel && !locked && canEdit && <ResizeHandle id={item.id} color="#0369a1"/>}
                  </div>
                );
              }

              /* ── Garden / Open ── */
              if (item.type === 'open') {
                const isEditThis = editLabel?.id === item.id;
                return (
                  <div key={item.id} data-item={item.id}
                    onDoubleClick={e => startEdit(e, item)}
                    style={{ ...basePos, backgroundColor: '#bbf7d0', border: `2px solid ${isSel ? '#875A7B' : '#4ade80'}`, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default',
                      outline: isSel ? '2px solid #875A7B' : 'none', outlineOffset: 2 }}>
                    <span style={{ fontSize: Math.min(item.h / 3, 22), lineHeight: 1, pointerEvents: 'none' }}>🌿</span>
                    {isEditThis ? (
                      <input autoFocus value={editLabel.value}
                        onChange={e => setEditLabel(p => ({ ...p, value: e.target.value }))}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditLabel(null); }}
                        onClick={e => e.stopPropagation()}
                        style={{ border: 'none', background: 'transparent', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#14532d', width: '90%', outline: 'none' }}/>
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#14532d', textAlign: 'center', pointerEvents: 'none', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {item.label || 'Garden'}
                      </span>
                    )}
                    {isSel && !locked && canEdit && <ResizeHandle id={item.id} color="#15803d"/>}
                  </div>
                );
              }

              return null;
            })}

            {/* ── Cumulative dimension indicator (horizontal row or vertical column) ── */}
            {selected && (() => {
              const sel = items.find(i => i.id === selected);
              if (!sel || sel.type !== 'plot') return null;

              const selCX = sel.x + sel.w / 2;
              const selCY = sel.y + sel.h / 2;

              // Detect horizontal neighbours (same Y band)
              const rowPlots = items
                .filter(i => i.type === 'plot' && Math.abs((i.y + i.h / 2) - selCY) < Math.max(sel.h * 0.6, 30))
                .sort((a, b) => a.x - b.x);

              // Detect vertical neighbours (same X band)
              const colPlots = items
                .filter(i => i.type === 'plot' && Math.abs((i.x + i.w / 2) - selCX) < Math.max(sel.w * 0.6, 30))
                .sort((a, b) => a.y - b.y);

              // Use whichever axis has more plots (prefer horizontal on tie)
              const isVertical = colPlots.length > rowPlots.length;
              const dimUnit = unitFor(sel.inventory_id)?.front_area_details || "'";

              if (!isVertical) {
                // ── Horizontal ──
                const selIdx = rowPlots.findIndex(i => i.id === selected);
                if (selIdx <= 0) return null;
                const leftPlots = rowPlots.slice(0, selIdx);
                const cumVal = leftPlots.reduce((sum, item) => {
                  const u = unitFor(item.inventory_id);
                  const v = item.rotated ? parseFloat(u?.back_area) : parseFloat(u?.front_area);
                  return sum + (isNaN(v) ? 0 : v);
                }, 0);
                if (!cumVal) return null;
                const label = `${Number.isInteger(cumVal) ? cumVal : cumVal.toFixed(2)}${dimUnit}`;
                const x1 = leftPlots[0].x, x2 = sel.x;
                const barY = Math.max(18, Math.min(...rowPlots.map(i => i.y)) - 26);
                const midX = (x1 + x2) / 2, tw = label.length * 5.5 + 14;
                return (
                  <svg key="cum-dim" style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none', overflow: 'visible' }}>
                    <line x1={x1} y1={barY + 7} x2={x1} y2={Math.min(...rowPlots.map(i => i.y))} stroke="#875A7B" strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                    <line x1={x2} y1={barY + 7} x2={x2} y2={Math.min(...rowPlots.map(i => i.y))} stroke="#875A7B" strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                    <line x1={x1} y1={barY} x2={x2} y2={barY} stroke="#875A7B" strokeWidth="1.4"/>
                    <line x1={x1} y1={barY - 6} x2={x1} y2={barY + 6} stroke="#875A7B" strokeWidth="1.4"/>
                    <line x1={x2} y1={barY - 6} x2={x2} y2={barY + 6} stroke="#875A7B" strokeWidth="1.4"/>
                    <rect x={midX - tw / 2} y={barY - 15} width={tw} height={14} rx="3" fill="#875A7B"/>
                    <text x={midX} y={barY - 5} textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="sans-serif">{label}</text>
                  </svg>
                );
              } else {
                // ── Vertical ──
                const selIdx = colPlots.findIndex(i => i.id === selected);
                if (selIdx <= 0) return null;
                const abovePlots = colPlots.slice(0, selIdx);
                const cumVal = abovePlots.reduce((sum, item) => {
                  const u = unitFor(item.inventory_id);
                  // vertical stacking: height dim = back_area (normal), front_area (rotated)
                  const v = item.rotated ? parseFloat(u?.front_area) : parseFloat(u?.back_area);
                  return sum + (isNaN(v) ? 0 : v);
                }, 0);
                if (!cumVal) return null;
                const label = `${Number.isInteger(cumVal) ? cumVal : cumVal.toFixed(2)}${dimUnit}`;
                const y1 = abovePlots[0].y, y2 = sel.y;
                const barX = Math.max(18, Math.min(...colPlots.map(i => i.x)) - 26);
                const midY = (y1 + y2) / 2, tw = label.length * 5.5 + 14;
                return (
                  <svg key="cum-dim" style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none', overflow: 'visible' }}>
                    <line x1={barX + 7} y1={y1} x2={Math.min(...colPlots.map(i => i.x))} y2={y1} stroke="#875A7B" strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                    <line x1={barX + 7} y1={y2} x2={Math.min(...colPlots.map(i => i.x))} y2={y2} stroke="#875A7B" strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                    <line x1={barX} y1={y1} x2={barX} y2={y2} stroke="#875A7B" strokeWidth="1.4"/>
                    <line x1={barX - 6} y1={y1} x2={barX + 6} y2={y1} stroke="#875A7B" strokeWidth="1.4"/>
                    <line x1={barX - 6} y1={y2} x2={barX + 6} y2={y2} stroke="#875A7B" strokeWidth="1.4"/>
                    <g transform={`rotate(-90,${barX},${midY})`}>
                      <rect x={barX - tw / 2} y={midY - 15} width={tw} height={14} rx="3" fill="#875A7B"/>
                      <text x={barX} y={midY - 5} textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="sans-serif">{label}</text>
                    </g>
                  </svg>
                );
              }
            })()}

            {/* Draw preview */}
            {drawPreview && drawPreview.w > 5 && drawPreview.h > 5 && (
              <div style={{
                position: 'absolute', left: drawPreview.x, top: drawPreview.y,
                width: drawPreview.w, height: drawPreview.h, pointerEvents: 'none', borderRadius: 4,
                backgroundColor: drawPreview.tool === 'road' ? '#bae6fd70' : '#bbf7d070',
                border: `2px dashed ${drawPreview.tool === 'road' ? '#0369a1' : '#15803d'}`,
              }}/>
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

      {/* Lock confirm modal */}
      {lockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setLockConfirm(false)}>
          <div className="absolute inset-0 bg-black/40"/>
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

// ── Resize handle ─────────────────────────────────────────────────────────────
function ResizeHandle({ id, color }) {
  return (
    <div data-resize={id}
      style={{
        position: 'absolute', right: 0, bottom: 0,
        width: 13, height: 13,
        backgroundColor: color,
        borderRadius: '4px 0 3px 0',
        cursor: 'nwse-resize',
        touchAction: 'none',
      }}
    />
  );
}
