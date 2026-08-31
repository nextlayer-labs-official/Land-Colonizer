'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPut, apiPost } from '@/lib/api';

// ── Status colours ────────────────────────────────────────────────────────────
const SC = {
  AVAILABLE:  { bg: '#fffde7', bg2: '#fef9c3', bd: '#d97706', tx: '#78350f', lb: 'Available'  },
  RESERVED:   { bg: '#fee2e2', bg2: '#fecaca', bd: '#dc2626', tx: '#7f1d1d', lb: 'Reserved'   },
  SOLD:       { bg: '#fee2e2', bg2: '#fecaca', bd: '#b91c1c', tx: '#7f1d1d', lb: 'Sold'       },
  REGISTERED: { bg: '#dbeafe', bg2: '#bfdbfe', bd: '#2563eb', tx: '#1e3a8a', lb: 'Registered' },
  ATTORNEY:   { bg: '#fef9c3', bg2: '#fef08a', bd: '#b45309', tx: '#451a03', lb: 'Attorney'   },
  FULL_FINAL: { bg: '#dcfce7', bg2: '#bbf7d0', bd: '#15803d', tx: '#14532d', lb: 'Full & Final'},
};
const DC = { bg: '#f9fafb', bg2: '#f3f4f6', bd: '#9ca3af', tx: '#6b7280', lb: '—' };

const snapTo   = (v, g) => Math.round(v / g) * g;
const mkId     = () => Math.random().toString(36).slice(2, 9);
const DIM_INSET = 12;
const PRI       = '#875A7B';
const CANVAS_W  = 3000;
const CANVAS_H  = 3600;
const clampZoom = z => Math.min(20, Math.max(0.05, z));

// ── Dimension helpers ─────────────────────────────────────────────────────────
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
function DimV({ x, y1, y2, label, anchor = 'end' }) {
  if (!label) return null;
  const cy = (y1 + y2) / 2, dx = anchor === 'end' ? -4 : 4;
  return (
    <g>
      <line x1={x} y1={y1 + 4} x2={x} y2={y2 - 4} stroke="#374151" strokeWidth="0.8"/>
      <line x1={x - 4} y1={y1 + 4} x2={x + 4} y2={y1 + 4} stroke="#374151" strokeWidth="0.8"/>
      <line x1={x - 4} y1={y2 - 4} x2={x + 4} y2={y2 - 4} stroke="#374151" strokeWidth="0.8"/>
      <text x={x + dx} y={cy} textAnchor={anchor} fontSize="8" fontWeight="700" fill="#1f2937" fontFamily="sans-serif"
        transform={`rotate(-90,${x + dx},${cy})`}>{label}</text>
    </g>
  );
}

// ── Plot content ──────────────────────────────────────────────────────────────
function PlotContent({ item, unit, isSel }) {
  const c   = SC[unit?.status] || DC;
  const W   = item.w, H = item.h;
  const gid = `pg-${item.id}`;
  const no  = unit ? (unit.plot_no || unit.sl_no || `#${unit.id}`) : '?';
  let areaNum = '', areaUnit = '';
  if (unit?.area) { areaNum = Number(unit.area).toFixed(2); areaUnit = unit.area_unit || 'Sq.Yds.'; }
  const dimUnit  = unit?.front_area_details || '';
  const frontDim = unit?.front_area ? `${unit.front_area}${dimUnit}` : null;
  const backDim  = unit?.back_area  ? `${unit.back_area}${dimUnit}`  : null;
  const cx = W / 2, inner_y1 = DIM_INSET + 4, inner_y2 = H - DIM_INSET - 4, innerH = inner_y2 - inner_y1;
  const noStr = String(no);
  const ovalRx = Math.min(Math.max(12, noStr.length * 4.5 + 4), W / 2 - 8);
  const ovalRy = Math.min(10, innerH * 0.28);
  const ovalCy = inner_y1 + ovalRy + 2, areaY1 = ovalCy + ovalRy + 6;
  const fontSize = Math.min(11, (inner_y2 - areaY1) * 0.55), smallFont = Math.min(8, (inner_y2 - areaY1) * 0.35);
  return (
    <>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.bg2}/><stop offset="100%" stopColor={c.bg}/>
        </linearGradient>
      </defs>
      {isSel && <rect x={-3} y={-3} width={W + 6} height={H + 6} fill="none" stroke={PRI} strokeWidth="2" strokeDasharray="5 2.5" rx="5"/>}
      <rect x={0} y={0} width={W} height={H} fill={`url(#${gid})`} stroke={isSel ? PRI : c.bd} strokeWidth={isSel ? 2.5 : 1.8} rx="3"/>
      <ellipse cx={cx} cy={ovalCy} rx={ovalRx} ry={ovalRy} fill="white" stroke={c.bd} strokeWidth="1.5"/>
      <text x={cx} y={ovalCy + ovalRy * 0.38} textAnchor="middle" fontSize={Math.min(11, ovalRy * 1.6)} fontWeight="900" fill={c.tx} fontFamily="sans-serif">{no}</text>
      {areaNum && fontSize > 3 && (
        <>
          <text x={cx} y={areaY1 + fontSize} textAnchor="middle" fontSize={fontSize} fontWeight="700" fill={c.tx} fontFamily="sans-serif">{areaNum}</text>
          {areaUnit && smallFont > 2 && <text x={cx} y={areaY1 + fontSize + smallFont + 1} textAnchor="middle" fontSize={smallFont} fontWeight="600" fill={c.tx} opacity="0.8" fontFamily="sans-serif">{areaUnit}</text>}
        </>
      )}
      {(() => {
        const hDim = item.rotated ? backDim : frontDim, vDim = item.rotated ? frontDim : backDim;
        return (
          <>
            <DimH x1={0} x2={W} y={DIM_INSET}     label={hDim}/>
            <DimH x1={0} x2={W} y={H - DIM_INSET} label={hDim}/>
            <DimV x={DIM_INSET}     y1={0} y2={H} label={vDim} anchor="start"/>
            <DimV x={W - DIM_INSET} y1={0} y2={H} label={vDim} anchor="end"/>
          </>
        );
      })()}
    </>
  );
}

// ── 8-handle resize ───────────────────────────────────────────────────────────
function ResizeHandles({ id }) {
  return (
    <>
      {[
        { c: 'nw', s: { top: -4,  left: -4,  cursor: 'nwse-resize' }},
        { c: 'ne', s: { top: -4,  right: -4, cursor: 'nesw-resize' }},
        { c: 'sw', s: { bottom: -4, left: -4,  cursor: 'nesw-resize' }},
        { c: 'se', s: { bottom: -4, right: -4, cursor: 'nwse-resize' }},
        { c: 'n',  s: { top: -4,  left: 'calc(50% - 4px)', cursor: 'ns-resize' }},
        { c: 's',  s: { bottom: -4, left: 'calc(50% - 4px)', cursor: 'ns-resize' }},
        { c: 'w',  s: { top: 'calc(50% - 4px)', left: -4,  cursor: 'ew-resize' }},
        { c: 'e',  s: { top: 'calc(50% - 4px)', right: -4, cursor: 'ew-resize' }},
      ].map(h => (
        <div key={h.c} data-corner={h.c} data-id={id}
          style={{ position: 'absolute', width: 8, height: 8, backgroundColor: PRI, border: '2px solid white',
            borderRadius: 2, touchAction: 'none', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.25)', ...h.s }}/>
      ))}
    </>
  );
}

// ── Shared input style ────────────────────────────────────────────────────────
const inp = { width: '100%', height: 28, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 5, color: '#111827', fontSize: 12, padding: '0 7px', boxSizing: 'border-box', outline: 'none' };

// ── Main component ────────────────────────────────────────────────────────────
export default function LayoutDesigner({ purchaseId, inventory: inventoryProp = [], canEdit = true }) {
  const canvasRef   = useRef(null);  // the container div (overflow:hidden)
  const innerRef    = useRef(null);  // the transformed inner div
  const interactRef = useRef(null);
  const drawPrevRef = useRef(null);
  const snapRef     = useRef(10);
  const toolRef     = useRef('select');
  const selRef      = useRef(null);
  const itemsRef    = useRef([]);
  const zoomRef     = useRef(0.5);
  const panRef      = useRef({ x: 40, y: 40 });
  const spaceRef    = useRef(false);

  const [layout,      setLayout]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [items,       setItems]       = useState([]);
  const [inventory,   setInventory]   = useState(inventoryProp);
  const [snapG,       setSnapG]       = useState(10);
  const [canvasW,     setCanvasW]     = useState(CANVAS_W);
  const [canvasH,     setCanvasH]     = useState(CANVAS_H);
  const [tool,        setTool]        = useState('select');
  const [selected,    setSelected]    = useState(null);
  const [drawPreview, setDrawPreview] = useState(null);
  const [lockConfirm, setLockConfirm] = useState(false);
  const [editLabel,   setEditLabel]   = useState(null);
  const [startPin,    setStartPin]    = useState(null);
  const [endPin,      setEndPin]      = useState(null);
  const [zoom,        setZoom]        = useState(0.5);
  const [pan,         setPan]         = useState({ x: 40, y: 40 });
  const [spaceDown,   setSpaceDown]   = useState(false);

  useEffect(() => { itemsRef.current    = items;       }, [items]);
  useEffect(() => { snapRef.current     = snapG;       }, [snapG]);
  useEffect(() => { toolRef.current     = tool;        }, [tool]);
  useEffect(() => { selRef.current      = selected;    }, [selected]);
  useEffect(() => { drawPrevRef.current = drawPreview; }, [drawPreview]);

  const applyZoom = useCallback((newZ, newPx, newPy) => {
    zoomRef.current = newZ; panRef.current = { x: newPx, y: newPy };
    setZoom(newZ); setPan({ x: newPx, y: newPy });
  }, []);

  const applyPan = useCallback((x, y) => {
    panRef.current = { x, y }; setPan({ x, y });
  }, []);

  // Load layout + inventory
  useEffect(() => {
    if (!purchaseId) {
      // Global mode: load from localStorage
      try {
        const saved = localStorage.getItem('global-layout');
        if (saved) {
          const data = JSON.parse(saved);
          setItems(Array.isArray(data.items) ? data.items : []);
          if (data.grid_cols > 100) setCanvasW(data.grid_cols);
          if (data.grid_rows > 100) setCanvasH(data.grid_rows);
        }
      } catch {}
      setLoading(false);
      return;
    }
    Promise.all([
      apiGet(`/purchases/${purchaseId}/layout`),
      inventoryProp.length === 0 ? apiGet(`/purchases/${purchaseId}`) : Promise.resolve(null),
    ]).then(([layoutData, purchaseData]) => {
      if (layoutData) {
        setLayout(layoutData);
        setItems(Array.isArray(layoutData.items) ? layoutData.items : []);
        if (layoutData.grid_cols > 100) setCanvasW(layoutData.grid_cols);
        if (layoutData.grid_rows > 100) setCanvasH(layoutData.grid_rows);
      }
      if (purchaseData?.inventory) setInventory(purchaseData.inventory);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [purchaseId]);

  // Fit to screen on first load after loading
  useEffect(() => {
    if (loading) return;
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const zX = rect.width / canvasW, zY = rect.height / canvasH;
    const z = Math.min(zX, zY) * 0.88;
    const px = (rect.width  - canvasW * z) / 2;
    const py = (rect.height - canvasH * z) / 2;
    applyZoom(z, px, py);
  }, [loading]);

  // Wheel: pan (scroll) or zoom (Ctrl+scroll)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const newZ  = clampZoom(zoomRef.current * factor);
        const ratio = newZ / zoomRef.current;
        applyZoom(newZ, cx - ratio * (cx - panRef.current.x), cy - ratio * (cy - panRef.current.y));
      } else {
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0        : e.deltaY;
        applyPan(panRef.current.x - dx, panRef.current.y - dy);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [loading, applyZoom, applyPan]);

  // Space key for pan
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); spaceRef.current = true; setSpaceDown(true);
      }
      if (document.activeElement?.tagName === 'INPUT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current) {
        if (layout?.locked || !canEdit) return;
        setItems(prev => prev.filter(i => i.id !== selRef.current));
        setSelected(null);
      }
      if (e.key === 'Escape') { setSelected(null); setEditLabel(null); }
    };
    const up = (e) => { if (e.code === 'Space') { spaceRef.current = false; setSpaceDown(false); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [layout, canEdit]);

  const locked    = layout?.locked || false;
  const placedIds = new Set(items.filter(i => i.type === 'plot').map(i => i.inventory_id));
  const unplaced  = inventory.filter(u => !placedIds.has(u.id));
  const unitFor   = id => inventory.find(u => u.id === id);
  const selItem   = selected ? items.find(i => i.id === selected) : null;

  // Convert screen coords → canvas coords
  const getPos = useCallback((e) => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (e.clientY - rect.top  - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const onPointerDown = useCallback((e) => {
    const el = canvasRef.current;

    // Pan: Space+drag or middle mouse
    if (spaceRef.current || e.button === 1) {
      interactRef.current = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: panRef.current.x, oy: panRef.current.y };
      el.setPointerCapture(e.pointerId);
      e.preventDefault(); return;
    }

    if (locked || !canEdit) return;
    const pos = getPos(e);

    // 8-handle resize
    const cornerEl = e.target.closest('[data-corner]');
    if (cornerEl) {
      const corner = cornerEl.dataset.corner, id = cornerEl.dataset.id;
      const item = itemsRef.current.find(i => i.id === id);
      if (!item) return;
      interactRef.current = { type: 'resize', id, corner, sx: pos.x, sy: pos.y, ox: item.x, oy: item.y, ow: item.w, oh: item.h };
      el.setPointerCapture(e.pointerId);
      e.preventDefault(); e.stopPropagation(); return;
    }

    const itemEl = e.target.closest('[data-item]');
    if (itemEl) {
      const id = itemEl.dataset.item, item = itemsRef.current.find(i => i.id === id);
      if (!item || toolRef.current !== 'select') return;
      setSelected(id); setEditLabel(null);
      interactRef.current = { type: 'drag', id, ox: pos.x - item.x, oy: pos.y - item.y };
      el.setPointerCapture(e.pointerId); return;
    }

    setSelected(null); setEditLabel(null);
    const t = toolRef.current;
    if (t === 'road' || t === 'open') {
      interactRef.current = { type: 'draw', tool: t, sx: pos.x, sy: pos.y };
      setDrawPreview({ tool: t, x: pos.x, y: pos.y, w: 0, h: 0 });
      el.setPointerCapture(e.pointerId);
    }
  }, [locked, canEdit, getPos]);

  const onPointerMove = useCallback((e) => {
    const intr = interactRef.current;
    if (!intr) return;
    if (intr.type === 'pan') {
      applyPan(intr.ox + (e.clientX - intr.sx), intr.oy + (e.clientY - intr.sy)); return;
    }
    const pos = getPos(e), g = snapRef.current;
    if (intr.type === 'drag') {
      setItems(prev => prev.map(i => i.id === intr.id
        ? { ...i, x: snapTo(pos.x - intr.ox, g), y: snapTo(pos.y - intr.oy, g) } : i));
    }
    if (intr.type === 'resize') {
      const dx = pos.x - intr.sx, dy = pos.y - intr.sy, c = intr.corner;
      let x = intr.ox, y = intr.oy, w = intr.ow, h = intr.oh;
      if (c.includes('e')) { w = snapTo(Math.max(60, intr.ow + dx), g); }
      if (c.includes('w')) { const nw = snapTo(Math.max(60, intr.ow - dx), g); x = intr.ox + intr.ow - nw; w = nw; }
      if (c.includes('s')) { h = snapTo(Math.max(40, intr.oh + dy), g); }
      if (c.includes('n')) { const nh = snapTo(Math.max(40, intr.oh - dy), g); y = intr.oy + intr.oh - nh; h = nh; }
      setItems(prev => prev.map(i => i.id === intr.id ? { ...i, x, y, w, h } : i));
    }
    if (intr.type === 'draw') {
      setDrawPreview({ tool: intr.tool, x: Math.min(intr.sx, pos.x), y: Math.min(intr.sy, pos.y), w: Math.abs(pos.x - intr.sx), h: Math.abs(pos.y - intr.sy) });
    }
  }, [getPos, applyPan]);

  const onPointerUp = useCallback((e) => {
    const intr = interactRef.current;
    if (!intr) return;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch {}
    if (intr.type === 'draw') {
      const dp = drawPrevRef.current;
      if (dp && dp.w > 15 && dp.h > 10) {
        const g = snapRef.current;
        setItems(prev => [...prev, { id: mkId(), type: intr.tool, x: snapTo(dp.x, g), y: snapTo(dp.y, g), w: snapTo(dp.w, g), h: snapTo(dp.h, g), label: intr.tool === 'road' ? '7.50 MT WIDE ROAD' : 'C.O.P. (Garden)' }]);
      }
      setDrawPreview(null);
    }
    interactRef.current = null;
  }, []);

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
    const pos = getPos(e), g = snapRef.current;
    setItems(prev => [
      ...prev.filter(i => !(i.type === 'plot' && i.inventory_id === inventoryId)),
      { id: mkId(), type: 'plot', inventory_id: inventoryId, x: snapTo(pos.x - 50, g), y: snapTo(pos.y - 35, g), w: 100, h: 70 },
    ]);
  };

  const commitEdit = () => {
    if (!editLabel) return;
    setItems(prev => prev.map(i => i.id === editLabel.id ? { ...i, label: editLabel.value } : i));
    setEditLabel(null);
  };

  const rotateItem = useCallback((id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, w: i.h, h: i.w, rotated: !i.rotated } : i));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      if (!purchaseId) {
        localStorage.setItem('global-layout', JSON.stringify({ grid_rows: canvasH, grid_cols: canvasW, items }));
        setSaved(true); setTimeout(() => setSaved(false), 2500);
      } else {
        const d = await apiPut(`/purchases/${purchaseId}/layout`, { grid_rows: canvasH, grid_cols: canvasW, items });
        setLayout(d); setSaved(true); setTimeout(() => setSaved(false), 2500);
      }
    } catch {} finally { setSaving(false); }
  };

  const handleToggleLock = async () => {
    if (!purchaseId) return;
    try { const d = await apiPost(`/purchases/${purchaseId}/layout/lock`, {}); setLayout(d); setLockConfirm(false); } catch {}
  };

  const fitScreen = useCallback(() => {
    const el = canvasRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const z = Math.min(rect.width / canvasW, rect.height / canvasH) * 0.88;
    applyZoom(z, (rect.width - canvasW * z) / 2, (rect.height - canvasH * z) / 2);
  }, [canvasW, canvasH, applyZoom]);

  const stepZoom = useCallback((dir) => {
    const el = canvasRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const newZ = clampZoom(zoomRef.current * (dir > 0 ? 1.2 : 1 / 1.2));
    const ratio = newZ / zoomRef.current;
    applyZoom(newZ, cx - ratio * (cx - panRef.current.x), cy - ratio * (cy - panRef.current.y));
  }, [applyZoom]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f4f5f7', color: '#9ca3af', fontSize: 13 }}>
      Loading layout…
    </div>
  );

  // Grid step: always ≥ 20px visually on screen, snapped to a multiple of snapG
  const gridStep = Math.max(snapG, Math.ceil(20 / Math.max(zoom, 0.01) / snapG) * snapG);
  // Background grid tile size and position (moves with pan/zoom so dots align to canvas coords)
  const gSize   = gridStep * zoom;
  const bgPosX  = ((pan.x % gSize) + gSize) % gSize;
  const bgPosY  = ((pan.y % gSize) + gSize) % gSize;

  const isPanning  = spaceDown;
  const canvasCursor = interactRef.current?.type === 'pan' ? 'grabbing' : isPanning ? 'grab' : { select: 'default', road: 'crosshair', open: 'crosshair' }[tool] || 'default';

  const ToolBtn = ({ t, icon, label }) => {
    const active = tool === t;
    return (
      <button onClick={() => setTool(t)} title={label}
        style={{ height: 32, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5, background: active ? `${PRI}15` : 'transparent', border: active ? `1px solid ${PRI}50` : '1px solid transparent', borderRadius: 6, color: active ? PRI : '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.12s' }}>
        <span style={{ fontSize: 14 }}>{icon}</span><span>{label}</span>
      </button>
    );
  };

  const PLabel = ({ children }) => (
    <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{children}</div>
  );

  const Sep = () => <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }}/>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f4f5f7', color: '#111827', fontFamily: 'system-ui,-apple-system,sans-serif', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{ height: 48, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', flexShrink: 0, zIndex: 20 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PRI} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginRight: 6, whiteSpace: 'nowrap' }}>Layout Designer</span>
        <Sep/>
        {!locked && canEdit ? (
          <>
            <ToolBtn t="select" icon="↖" label="Select"/>
            <ToolBtn t="road"   icon="═" label="Road"/>
            <ToolBtn t="open"   icon="⬡" label="Garden"/>
            <Sep/>
            {/* Snap grid */}
            <span style={{ fontSize: 10, color: '#9ca3af', marginRight: 2 }}>Snap</span>
            <input type="number" min={1} max={500} value={snapG}
              onChange={e => setSnapG(Math.max(1, Number(e.target.value) || 1))}
              style={{ height: 28, width: 56, padding: '0 6px', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: 11, color: '#374151', background: '#f9fafb', outline: 'none' }}/>
            <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 2 }}>px</span>
            <Sep/>
            <span style={{ fontSize: 10, color: '#d1d5db' }}>
              {tool === 'select' ? 'Drag units · Move/resize · Space+drag to pan · Del to remove' : tool === 'road' ? 'Drag to draw a road area' : 'Drag to draw a garden area'}
            </span>
          </>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '0 10px', height: 28 }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            Layout Locked
          </span>
        )}

        <div style={{ flex: 1 }}/>

        {/* Zoom controls */}
        <button onClick={() => stepZoom(-1)}
          style={{ height: 28, width: 28, border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        <button onClick={fitScreen}
          style={{ height: 28, padding: '0 8px', border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: 11, minWidth: 52, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => stepZoom(1)}
          style={{ height: 28, width: 28, border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>

        <Sep/>

        <button onClick={handleSave} disabled={saving}
          style={{ height: 32, padding: '0 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: 'none', cursor: saving ? 'wait' : 'pointer', background: saved ? '#059669' : PRI, color: '#fff', transition: 'background 0.15s' }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Layout'}
        </button>
        {canEdit && purchaseId && (
          <button onClick={() => setLockConfirm(true)}
            style={{ height: 32, padding: '0 12px', fontSize: 12, borderRadius: 7, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#f9fafb', color: locked ? '#b45309' : '#6b7280', marginLeft: 4 }}>
            {locked ? '🔒 Unlock' : '🔓 Lock'}
          </button>
        )}
      </div>

      {/* ── Middle ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Left panel */}
        <div style={{ width: 216, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Inventory Units</div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{unplaced.length} unplaced · {placedIds.size} placed</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
            {inventory.length === 0
              ? <div style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', marginTop: 40, lineHeight: 1.7 }}>No inventory units<br/>found for this purchase</div>
              : unplaced.length === 0
              ? <div style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', marginTop: 40 }}>All units placed on canvas</div>
              : unplaced.map(u => {
                  const c  = SC[u.status] || DC;
                  const no = u.plot_no || u.sl_no || `#${u.id}`;
                  const area = u.area ? `${Number(u.area).toFixed(0)} ${u.area_unit || ''}` : '';
                  return (
                    <div key={u.id} draggable={!locked && canEdit} onDragStart={e => onSidebarDragStart(e, u.id)}
                      style={{ padding: '7px 9px', borderRadius: 7, background: c.bg, border: `1.5px solid ${c.bd}`, cursor: !locked && canEdit ? 'grab' : 'default', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: c.tx }}>{no}</span>
                        {area && <span style={{ fontSize: 10, color: c.tx, opacity: 0.7, marginLeft: 'auto' }}>{area}</span>}
                      </div>
                      <span style={{ display: 'inline-block', marginTop: 3, fontSize: 8, fontWeight: 700, color: c.tx, background: `${c.bd}25`, border: `1px solid ${c.bd}40`, borderRadius: 3, padding: '1px 5px' }}>
                        {c.lb}
                      </span>
                    </div>
                  );
                })
            }
          </div>
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
            <PLabel>Status Legend</PLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
              {Object.entries(SC).map(([, c]) => (
                <div key={c.lb} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: c.bd, flexShrink: 0 }}/>
                  <span style={{ fontSize: 9, color: '#6b7280' }}>{c.lb}</span>
                </div>
              ))}
              {[['#0369a1','Road'],['#22c55e','Garden']].map(([col, lb]) => (
                <div key={lb} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: col, flexShrink: 0 }}/>
                  <span style={{ fontSize: 9, color: '#6b7280' }}>{lb}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Canvas viewport — overflow hidden, pan+zoom via transform ── */}
        <div
          ref={canvasRef}
          style={{ flex: 1, overflow: 'hidden', cursor: canvasCursor, userSelect: 'none', position: 'relative', backgroundColor: '#c8cdd8', backgroundImage: 'radial-gradient(circle, #a0a5b0 1px, transparent 1px)', backgroundSize: `${gSize}px ${gSize}px`, backgroundPosition: `${bgPosX}px ${bgPosY}px` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}>

          {/* Transformed canvas */}
          <div ref={innerRef} style={{
            position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}>

            {items.map(item => {
              const isSel   = selected === item.id;
              const basePos = { position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h };

              if (item.type === 'plot') {
                const unit = unitFor(item.inventory_id);
                if (!unit) return null;
                return (
                  <div key={item.id} data-item={item.id}
                    style={{ ...basePos, touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default' }}>
                    <svg width={item.w} height={item.h} style={{ overflow: 'visible', display: 'block' }}>
                      <PlotContent item={item} unit={unit} isSel={isSel}/>
                    </svg>
                    {item.id === startPin && <div style={{ position: 'absolute', top: 2, left: 2, background: '#059669', color: 'white', fontSize: 7, fontWeight: 900, padding: '1px 4px', borderRadius: 3, pointerEvents: 'none', lineHeight: 1.4 }}>START</div>}
                    {item.id === endPin   && <div style={{ position: 'absolute', top: 2, right: 2, background: '#ea580c', color: 'white', fontSize: 7, fontWeight: 900, padding: '1px 4px', borderRadius: 3, pointerEvents: 'none', lineHeight: 1.4 }}>END</div>}
                    {isSel && !locked && canEdit && <ResizeHandles id={item.id}/>}
                  </div>
                );
              }

              if (item.type === 'road') {
                return (
                  <div key={item.id} data-item={item.id}
                    onDoubleClick={e => { e.stopPropagation(); setEditLabel({ id: item.id, value: item.label || '' }); }}
                    style={{ ...basePos, backgroundColor: '#bae6fd', border: `2px solid ${isSel ? PRI : '#7dd3fc'}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default', outline: isSel ? `2px solid ${PRI}` : 'none', outlineOffset: 2 }}>
                    {editLabel?.id === item.id
                      ? <input autoFocus value={editLabel.value} onChange={e => setEditLabel(p => ({ ...p, value: e.target.value }))} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditLabel(null); }} onClick={e => e.stopPropagation()} style={{ border: 'none', background: 'transparent', textAlign: 'center', fontSize: 11, fontWeight: 900, color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: '0.08em', width: '92%', outline: 'none' }}/>
                      : <span style={{ fontSize: 11, fontWeight: 900, color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: '0.08em', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 8px' }}>{item.label || '7.50 MT WIDE ROAD'}</span>
                    }
                    {isSel && !locked && canEdit && <ResizeHandles id={item.id}/>}
                  </div>
                );
              }

              if (item.type === 'open') {
                return (
                  <div key={item.id} data-item={item.id}
                    onDoubleClick={e => { e.stopPropagation(); setEditLabel({ id: item.id, value: item.label || '' }); }}
                    style={{ ...basePos, backgroundColor: '#bbf7d0', border: `2px solid ${isSel ? PRI : '#4ade80'}`, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default', outline: isSel ? `2px solid ${PRI}` : 'none', outlineOffset: 2 }}>
                    <span style={{ fontSize: Math.min(item.h / 3, 22), lineHeight: 1, pointerEvents: 'none' }}>🌿</span>
                    {editLabel?.id === item.id
                      ? <input autoFocus value={editLabel.value} onChange={e => setEditLabel(p => ({ ...p, value: e.target.value }))} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditLabel(null); }} onClick={e => e.stopPropagation()} style={{ border: 'none', background: 'transparent', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#14532d', width: '90%', outline: 'none' }}/>
                      : <span style={{ fontSize: 9, fontWeight: 700, color: '#14532d', textAlign: 'center', pointerEvents: 'none', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{item.label || 'Garden'}</span>
                    }
                    {isSel && !locked && canEdit && <ResizeHandles id={item.id}/>}
                  </div>
                );
              }
              return null;
            })}

            {/* Cumulative dimension indicator */}
            {selected && (() => {
              const sel = items.find(i => i.id === selected);
              if (!sel || sel.type !== 'plot') return null;
              const selCX = sel.x + sel.w / 2, selCY = sel.y + sel.h / 2;
              const dimUnit = unitFor(sel.inventory_id)?.front_area_details || "'";
              const hDimVal = p => { const u = unitFor(p.inventory_id); const v = p.rotated ? parseFloat(u?.back_area) : parseFloat(u?.front_area); return isNaN(v) ? 0 : v; };
              const vDimVal = p => { const u = unitFor(p.inventory_id); const v = p.rotated ? parseFloat(u?.front_area) : parseFloat(u?.back_area); return isNaN(v) ? 0 : v; };
              const fmt = v => `${Number.isInteger(v) ? v : v.toFixed(2)}${dimUnit}`;

              const HBar = ({ x1, x2, barY, refY, color, label }) => {
                const mx = (x1 + x2) / 2, tw = label.length * 5.5 + 14;
                return (<g>
                  <line x1={x1} y1={barY + 7} x2={x1} y2={refY} stroke={color} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                  <line x1={x2} y1={barY + 7} x2={x2} y2={refY} stroke={color} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                  <line x1={x1} y1={barY} x2={x2} y2={barY} stroke={color} strokeWidth="1.4"/>
                  <line x1={x1} y1={barY-6} x2={x1} y2={barY+6} stroke={color} strokeWidth="1.4"/>
                  <line x1={x2} y1={barY-6} x2={x2} y2={barY+6} stroke={color} strokeWidth="1.4"/>
                  <rect x={mx-tw/2} y={barY-15} width={tw} height={14} rx="3" fill={color}/>
                  <text x={mx} y={barY-5} textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="sans-serif">{label}</text>
                </g>);
              };
              const VBar = ({ y1, y2, barX, refX, color, label }) => {
                const my = (y1 + y2) / 2, tw = label.length * 5.5 + 14;
                return (<g>
                  <line x1={barX+7} y1={y1} x2={refX} y2={y1} stroke={color} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                  <line x1={barX+7} y1={y2} x2={refX} y2={y2} stroke={color} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                  <line x1={barX} y1={y1} x2={barX} y2={y2} stroke={color} strokeWidth="1.4"/>
                  <line x1={barX-6} y1={y1} x2={barX+6} y2={y1} stroke={color} strokeWidth="1.4"/>
                  <line x1={barX-6} y1={y2} x2={barX+6} y2={y2} stroke={color} strokeWidth="1.4"/>
                  <g transform={`rotate(-90,${barX},${my})`}>
                    <rect x={barX-tw/2} y={my-15} width={tw} height={14} rx="3" fill={color}/>
                    <text x={barX} y={my-5} textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="sans-serif">{label}</text>
                  </g>
                </g>);
              };

              const rowPlots = items.filter(i => i.type === 'plot' && Math.abs((i.y + i.h / 2) - selCY) < Math.max(sel.h * 0.6, 30)).sort((a, b) => a.x - b.x);
              const colPlots = items.filter(i => i.type === 'plot' && Math.abs((i.x + i.w / 2) - selCX) < Math.max(sel.w * 0.6, 30)).sort((a, b) => a.y - b.y);
              const isVert = colPlots.length > rowPlots.length;
              const sp = startPin ? items.find(i => i.id === startPin) : null;
              const ep = endPin   ? items.find(i => i.id === endPin)   : null;

              if (sp && ep && startPin !== selected && endPin !== selected) {
                if (!isVert) {
                  const si = rowPlots.findIndex(i => i.id === startPin), ei = rowPlots.findIndex(i => i.id === endPin), xi = rowPlots.findIndex(i => i.id === selected);
                  if (si < 0 || ei < 0 || xi < 0) return null;
                  const [l, r] = si < ei ? [si, ei] : [ei, si];
                  if (xi <= l || xi >= r) return null;
                  const refY = Math.min(...rowPlots.map(i => i.y)), barY = Math.max(18, refY - 26);
                  const dL = rowPlots.slice(l, xi).reduce((s, p) => s + hDimVal(p), 0);
                  const dR = rowPlots.slice(xi + 1, r + 1).reduce((s, p) => s + hDimVal(p), 0);
                  if (!dL && !dR) return null;
                  const x1 = rowPlots[l].x, x2 = sel.x, x3 = sel.x + sel.w, x4 = rowPlots[r].x + rowPlots[r].w, sd = hDimVal(sel);
                  return (<svg key="cd" style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none', overflow: 'visible' }}>
                    {dL > 0 && <HBar x1={x1} x2={x2} barY={barY} refY={refY} color="#059669" label={fmt(dL)}/>}
                    {sd > 0 && <HBar x1={x2} x2={x3} barY={barY} refY={refY} color={PRI}     label={fmt(sd)}/>}
                    {dR > 0 && <HBar x1={x3} x2={x4} barY={barY} refY={refY} color="#ea580c" label={fmt(dR)}/>}
                  </svg>);
                } else {
                  const si = colPlots.findIndex(i => i.id === startPin), ei = colPlots.findIndex(i => i.id === endPin), xi = colPlots.findIndex(i => i.id === selected);
                  if (si < 0 || ei < 0 || xi < 0) return null;
                  const [t, b] = si < ei ? [si, ei] : [ei, si];
                  if (xi <= t || xi >= b) return null;
                  const refX = Math.min(...colPlots.map(i => i.x)), barX = Math.max(18, refX - 26);
                  const dA = colPlots.slice(t, xi).reduce((s, p) => s + vDimVal(p), 0);
                  const dB = colPlots.slice(xi + 1, b + 1).reduce((s, p) => s + vDimVal(p), 0);
                  if (!dA && !dB) return null;
                  const y1 = colPlots[t].y, y2 = sel.y, y3 = sel.y + sel.h, y4 = colPlots[b].y + colPlots[b].h, sv = vDimVal(sel);
                  return (<svg key="cd" style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none', overflow: 'visible' }}>
                    {dA > 0 && <VBar y1={y1} y2={y2} barX={barX} refX={refX} color="#059669" label={fmt(dA)}/>}
                    {sv > 0 && <VBar y1={y2} y2={y3} barX={barX} refX={refX} color={PRI}     label={fmt(sv)}/>}
                    {dB > 0 && <VBar y1={y3} y2={y4} barX={barX} refX={refX} color="#ea580c" label={fmt(dB)}/>}
                  </svg>);
                }
              }

              if (!isVert) {
                const xi = rowPlots.findIndex(i => i.id === selected);
                if (xi <= 0) return null;
                const cum = rowPlots.slice(0, xi).reduce((s, p) => s + hDimVal(p), 0);
                if (!cum) return null;
                const refY = Math.min(...rowPlots.map(i => i.y));
                return (<svg key="cd" style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none', overflow: 'visible' }}>
                  <HBar x1={rowPlots[0].x} x2={sel.x} barY={Math.max(18, refY - 26)} refY={refY} color={PRI} label={fmt(cum)}/>
                </svg>);
              } else {
                const xi = colPlots.findIndex(i => i.id === selected);
                if (xi <= 0) return null;
                const cum = colPlots.slice(0, xi).reduce((s, p) => s + vDimVal(p), 0);
                if (!cum) return null;
                const refX = Math.min(...colPlots.map(i => i.x));
                return (<svg key="cd" style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none', overflow: 'visible' }}>
                  <VBar y1={colPlots[0].y} y2={sel.y} barX={Math.max(18, refX - 26)} refX={refX} color={PRI} label={fmt(cum)}/>
                </svg>);
              }
            })()}

            {drawPreview && drawPreview.w > 5 && drawPreview.h > 5 && (
              <div style={{ position: 'absolute', left: drawPreview.x, top: drawPreview.y, width: drawPreview.w, height: drawPreview.h, pointerEvents: 'none', borderRadius: 4, backgroundColor: drawPreview.tool === 'road' ? '#bae6fd60' : '#bbf7d060', border: `2px dashed ${drawPreview.tool === 'road' ? '#0369a1' : '#15803d'}` }}/>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 216, background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {selItem ? (
            <>
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
                <PLabel>{selItem.type === 'plot' ? 'Plot' : selItem.type === 'road' ? 'Road' : 'Garden'}</PLabel>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, minHeight: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[['X','x'],['Y','y'],['W','w'],['H','h']].map(([lbl, key]) => (
                    <div key={key}>
                      <PLabel>{lbl}</PLabel>
                      <input type="number" step={snapG} value={selItem[key]}
                        onChange={e => { if (!locked && canEdit) setItems(prev => prev.map(i => i.id === selected ? { ...i, [key]: Number(e.target.value) } : i)); }}
                        style={inp}/>
                    </div>
                  ))}
                </div>
                {selItem.type === 'plot' && !locked && canEdit && (
                  <>
                    <button onClick={() => rotateItem(selected)}
                      style={{ width: '100%', height: 30, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, color: '#374151', fontSize: 12, cursor: 'pointer', marginBottom: 8, fontWeight: 500 }}>
                      ↺ Rotate
                    </button>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                      <button onClick={() => setStartPin(p => p === selected ? null : selected)}
                        style={{ height: 28, background: startPin === selected ? '#dcfce7' : '#f9fafb', border: `1px solid ${startPin === selected ? '#059669' : '#e5e7eb'}`, borderRadius: 5, color: startPin === selected ? '#059669' : '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        ▶ Start
                      </button>
                      <button onClick={() => setEndPin(p => p === selected ? null : selected)}
                        style={{ height: 28, background: endPin === selected ? '#fff7ed' : '#f9fafb', border: `1px solid ${endPin === selected ? '#ea580c' : '#e5e7eb'}`, borderRadius: 5, color: endPin === selected ? '#ea580c' : '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        End ◀
                      </button>
                    </div>
                  </>
                )}
                {(selItem.type === 'road' || selItem.type === 'open') && (
                  <div style={{ marginBottom: 12 }}>
                    <PLabel>Label</PLabel>
                    <input type="text" value={selItem.label || ''}
                      onChange={e => { if (!locked && canEdit) setItems(prev => prev.map(i => i.id === selected ? { ...i, label: e.target.value } : i)); }}
                      style={inp}/>
                  </div>
                )}
                {!locked && canEdit && (
                  <button onClick={() => { setItems(p => p.filter(i => i.id !== selected)); setSelected(null); }}
                    style={{ width: '100%', height: 30, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 12, cursor: 'pointer', marginTop: 4, fontWeight: 500 }}>
                    Remove Item
                  </button>
                )}
                {(startPin || endPin) && (
                  <button onClick={() => { setStartPin(null); setEndPin(null); }}
                    style={{ width: '100%', height: 28, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 5, color: '#9ca3af', fontSize: 11, cursor: 'pointer', marginTop: 6 }}>
                    Clear Pins
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
                <PLabel>Controls</PLabel>
              </div>
              <div style={{ flex: 1, padding: 12 }}>
                <div style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 7, fontSize: 10, color: '#9ca3af', lineHeight: 2 }}>
                  <div><b style={{ color: '#6b7280' }}>Zoom</b> — Ctrl+Scroll or ± buttons</div>
                  <div><b style={{ color: '#6b7280' }}>Pan</b> — Space+Drag or Scroll</div>
                  <div><b style={{ color: '#6b7280' }}>Place</b> — Drag unit from left panel</div>
                  <div><b style={{ color: '#6b7280' }}>Select</b> — Click item to edit props</div>
                  <div><b style={{ color: '#6b7280' }}>Delete</b> — Select item, press Del</div>
                  <div><b style={{ color: '#6b7280' }}>Fit</b> — Click % button in toolbar</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{ height: 26, background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 16, fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>
        <span style={{ color: '#6b7280' }}>{items.filter(i => i.type === 'plot').length} plots</span>
        <span>{items.filter(i => i.type === 'road').length} roads</span>
        <span>{items.filter(i => i.type === 'open').length} gardens</span>
        <span>{unplaced.length} unplaced</span>
        {locked && <span style={{ color: '#b45309', fontWeight: 600 }}>● Locked</span>}
        <span style={{ marginLeft: 'auto' }}>{Math.round(zoom * 100)}% · Snap {snapG}px</span>
      </div>

      {/* Lock modal */}
      {lockConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setLockConfirm(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}/>
          <div style={{ position: 'relative', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: 24, maxWidth: 340, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>{locked ? 'Unlock Layout?' : 'Lock Layout?'}</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>{locked ? 'Allow editing and moving plots again.' : 'Freeze the layout — no further changes until unlocked.'}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setLockConfirm(false)} style={{ height: 36, padding: '0 16px', fontSize: 13, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleToggleLock} style={{ height: 36, padding: '0 20px', fontSize: 13, fontWeight: 600, background: locked ? PRI : '#d97706', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer' }}>
                {locked ? 'Unlock' : 'Lock Layout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
