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
const mkId       = () => Math.random().toString(36).slice(2, 9);
const mkLayId    = () => `lay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
function PlotContent({ item, unit, isSel, hideFlags = {}, viewMode = 'status', isHighlighted = false }) {
  let c;
  if (viewMode === 'sold') {
    if (unit?.status === 'AVAILABLE') c = SC.AVAILABLE;
    else if (unit?.status === 'RESERVED') c = SC.RESERVED;
    else c = SC.SOLD;
  } else {
    c = SC[unit?.status] || DC;
  }
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
      {isHighlighted && <rect x={-5} y={-5} width={W + 10} height={H + 10} fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 3" rx="6"/>}
      {isSel && <rect x={-3} y={-3} width={W + 6} height={H + 6} fill="none" stroke={PRI} strokeWidth="2" strokeDasharray="5 2.5" rx="5"/>}
      <rect x={0} y={0} width={W} height={H} fill={`url(#${gid})`} stroke={isSel ? PRI : c.bd} strokeWidth={isSel ? 2.5 : 1.8} rx="3"/>
      {!hideFlags.plotNo && (
        <>
          <ellipse cx={cx} cy={ovalCy} rx={ovalRx} ry={ovalRy} fill="white" stroke={c.bd} strokeWidth="1.5"/>
          <text x={cx} y={ovalCy + ovalRy * 0.38} textAnchor="middle" fontSize={Math.min(11, ovalRy * 1.6)} fontWeight="900" fill={c.tx} fontFamily="sans-serif">{no}</text>
        </>
      )}
      {!hideFlags.totalArea && areaNum && fontSize > 3 && (
        <>
          <text x={cx} y={areaY1 + fontSize} textAnchor="middle" fontSize={fontSize} fontWeight="700" fill={c.tx} fontFamily="sans-serif">{areaNum}</text>
          {areaUnit && smallFont > 2 && <text x={cx} y={areaY1 + fontSize + smallFont + 1} textAnchor="middle" fontSize={smallFont} fontWeight="600" fill={c.tx} opacity="0.8" fontFamily="sans-serif">{areaUnit}</text>}
        </>
      )}
      {!hideFlags.frontBack && (() => {
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

function RotationHandle({ id }) {
  return (
    <div style={{ position: 'absolute', top: -36, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 20 }}>
      <div data-rotate={id}
        style={{ width: 14, height: 14, borderRadius: '50%', background: '#7c3aed', border: '2px solid white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.35)', cursor: 'grab', touchAction: 'none', pointerEvents: 'all' }}
        title="Drag to rotate"/>
      <div style={{ width: 1, height: 22, background: '#7c3aed', opacity: 0.6 }}/>
    </div>
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

  // ── New toolbar state ──
  const [hideFlags,        setHideFlags]        = useState({ plotNo: false, totalArea: false, lockSymbol: false, frontBack: false });
  const [searchPlot,       setSearchPlot]       = useState('');
  const [viewMode,         setViewMode]         = useState('status');
  const [insertType,       setInsertType]       = useState('line');
  const [showConfig,          setShowConfig]          = useState(false);
  const [showFilterPopup,     setShowFilterPopup]     = useState(false);
  // Multi-layout
  const [layouts,             setLayouts]             = useState([]);   // [{ id, name }]
  const [layoutData,          setLayoutData]          = useState({});   // { [id]: { items, canvasW, canvasH } }
  const [activeLayoutId,      setActiveLayoutId]      = useState(null);
  const [savedJson,           setSavedJson]           = useState('');
  const [showNewLayoutDlg,    setShowNewLayoutDlg]    = useState(false);
  const [newLayoutNameInput,  setNewLayoutNameInput]  = useState('');
  const [unsavedAction,       setUnsavedAction]       = useState(null); // { type:'new'|'switch', id? }
  const [showUnsaved,         setShowUnsaved]         = useState(false);
  const layoutDataRef  = useRef({});
  const activeLayIdRef = useRef(null);
  const layoutsRef     = useRef([]);
  const [leftView,     setLeftView]     = useState('layouts'); // 'layouts' | { layoutId, layoutName }
  const filterPopupRef = useRef(null);
  const [rightTab,         setRightTab]         = useState('controls');

  useEffect(() => { itemsRef.current    = items;          }, [items]);
  useEffect(() => { snapRef.current     = snapG;          }, [snapG]);
  useEffect(() => { toolRef.current     = tool;           }, [tool]);
  useEffect(() => { selRef.current      = selected;       }, [selected]);
  useEffect(() => { drawPrevRef.current = drawPreview;    }, [drawPreview]);
  useEffect(() => { layoutDataRef.current  = layoutData;  }, [layoutData]);
  useEffect(() => { activeLayIdRef.current = activeLayoutId; }, [activeLayoutId]);
  useEffect(() => { layoutsRef.current     = layouts;     }, [layouts]);

  const applyZoom = useCallback((newZ, newPx, newPy) => {
    zoomRef.current = newZ; panRef.current = { x: newPx, y: newPy };
    setZoom(newZ); setPan({ x: newPx, y: newPy });
  }, []);

  const applyPan = useCallback((x, y) => {
    panRef.current = { x, y }; setPan({ x, y });
  }, []);

  // ── Multi-layout init helper ────────────────────────────────────────────────
  const initMultiLayouts = useCallback((rawItems, fallbackGrid) => {
    if (rawItems?.__multi) {
      const lays = rawItems.layouts || [];
      const activeId = rawItems.activeId || lays[0]?.id;
      const activeLay = lays.find(l => l.id === activeId) || lays[0];
      const ld = {};
      lays.forEach(l => { ld[l.id] = { items: Array.isArray(l.items) ? l.items : [], canvasW: l.canvasW || CANVAS_W, canvasH: l.canvasH || CANVAS_H }; });
      setLayouts(lays.map(l => ({ id: l.id, name: l.name })));
      setLayoutData(ld);
      setActiveLayoutId(activeLay?.id || null);
      setItems(activeLay?.items || []);
      setCanvasW(activeLay?.canvasW || CANVAS_W);
      setCanvasH(activeLay?.canvasH || CANVAS_H);
      setSavedJson(JSON.stringify({ layouts: lays.map(l => ({ id: l.id, name: l.name, items: l.items || [], canvasW: l.canvasW || CANVAS_W, canvasH: l.canvasH || CANVAS_H })), activeId }));
    } else {
      // Old single-layout or empty
      const firstId = mkLayId();
      const it  = Array.isArray(rawItems) ? rawItems : [];
      const cw  = fallbackGrid?.cols > 100 ? fallbackGrid.cols : CANVAS_W;
      const ch  = fallbackGrid?.rows > 100 ? fallbackGrid.rows : CANVAS_H;
      const lay = { id: firstId, name: 'Layout 1', items: it, canvasW: cw, canvasH: ch };
      setLayouts([{ id: firstId, name: 'Layout 1' }]);
      setLayoutData({ [firstId]: { items: it, canvasW: cw, canvasH: ch } });
      setActiveLayoutId(firstId);
      setItems(it);
      setCanvasW(cw);
      setCanvasH(ch);
      setSavedJson(JSON.stringify({ layouts: [lay], activeId: firstId }));
    }
  }, []);

  // Load layout + inventory
  useEffect(() => {
    if (!purchaseId) {
      try {
        const saved = localStorage.getItem('global-layout');
        if (saved) {
          const data = JSON.parse(saved);
          initMultiLayouts(data.items, { cols: data.grid_cols, rows: data.grid_rows });
        } else {
          initMultiLayouts(null, null);
        }
      } catch { initMultiLayouts(null, null); }
      setLoading(false);
      return;
    }
    Promise.all([
      apiGet(`/purchases/${purchaseId}/layout`),
      inventoryProp.length === 0 ? apiGet(`/purchases/${purchaseId}`) : Promise.resolve(null),
    ]).then(([layoutData, purchaseData]) => {
      if (layoutData) {
        setLayout(layoutData);
        initMultiLayouts(layoutData.items, { cols: layoutData.grid_cols, rows: layoutData.grid_rows });
      } else {
        initMultiLayouts(null, null);
      }
      if (purchaseData?.inventory) setInventory(purchaseData.inventory);
    }).catch(() => { initMultiLayouts(null, null); }).finally(() => setLoading(false));
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
    const handleClickOutside = (e) => {
      if (filterPopupRef.current && !filterPopupRef.current.contains(e.target)) setShowFilterPopup(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      document.removeEventListener('mousedown', handleClickOutside);
    };
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

    // Rotation handle
    const rotEl = e.target.closest('[data-rotate]');
    if (rotEl) {
      const id   = rotEl.dataset.rotate;
      const item = itemsRef.current.find(i => i.id === id);
      if (!item) return;
      const rect2 = el.getBoundingClientRect();
      const cx = (item.x + item.w / 2) * zoomRef.current + panRef.current.x + rect2.left;
      const cy = (item.y + item.h / 2) * zoomRef.current + panRef.current.y + rect2.top;
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      interactRef.current = { type: 'rotate', id, cx, cy, startAngle, startRotation: item.rotation || 0 };
      el.setPointerCapture(e.pointerId);
      e.preventDefault(); e.stopPropagation(); return;
    }

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
    if (intr.type === 'rotate') {
      const angle = Math.atan2(e.clientY - intr.cy, e.clientX - intr.cx) * 180 / Math.PI;
      const delta = angle - intr.startAngle;
      let newRot = (intr.startRotation + delta) % 360;
      if (newRot < 0) newRot += 360;
      setItems(prev => prev.map(i => i.id === intr.id ? { ...i, rotation: Math.round(newRot) } : i));
      return;
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

  const buildMultiPayload = (activeId, activeItems, activeCW, activeCH) => {
    const lays = layoutsRef.current;
    const ld   = layoutDataRef.current;
    const allLays = lays.map(l => l.id === activeId
      ? { id: l.id, name: l.name, items: activeItems, canvasW: activeCW, canvasH: activeCH }
      : { id: l.id, name: l.name, ...(ld[l.id] || { items: [], canvasW: CANVAS_W, canvasH: CANVAS_H }) });
    return { __multi: true, layouts: allLays, activeId };
  };

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    const activeId = activeLayIdRef.current;
    const payload  = buildMultiPayload(activeId, itemsRef.current, canvasW, canvasH);
    const newJson  = JSON.stringify({ layouts: payload.layouts, activeId });
    try {
      if (!purchaseId) {
        localStorage.setItem('global-layout', JSON.stringify({ grid_rows: canvasH, grid_cols: canvasW, items: payload }));
      } else {
        const d = await apiPut(`/purchases/${purchaseId}/layout`, { grid_rows: canvasH, grid_cols: canvasW, items: payload });
        setLayout(d);
      }
      setSavedJson(newJson);
      setLayoutData(prev => ({ ...prev, [activeId]: { items: itemsRef.current, canvasW, canvasH } }));
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch {} finally { setSaving(false); }
  };

  // ── Multi-layout helpers ───────────────────────────────────────────────────
  const isCurrentUnsaved = () => {
    const activeId = activeLayIdRef.current;
    const lays     = layoutsRef.current;
    const ld       = layoutDataRef.current;
    const payload  = buildMultiPayload(activeId, itemsRef.current, canvasW, canvasH);
    return JSON.stringify({ layouts: payload.layouts, activeId }) !== savedJson;
  };

  const doSwitchLayout = (targetId) => {
    const activeId = activeLayIdRef.current;
    // Snapshot active layout before switching
    setLayoutData(prev => ({ ...prev, [activeId]: { items: itemsRef.current, canvasW, canvasH } }));
    // Load target
    const target = layoutDataRef.current[targetId] || { items: [], canvasW: CANVAS_W, canvasH: CANVAS_H };
    setItems(target.items);
    setCanvasW(target.canvasW);
    setCanvasH(target.canvasH);
    setActiveLayoutId(targetId);
    setSelected(null); setStartPin(null); setEndPin(null);
    setTimeout(fitScreen, 60);
  };

  const openNewLayoutDialog = () => {
    const n = layoutsRef.current.length + 1;
    setNewLayoutNameInput(`Layout ${n}`);
    setShowNewLayoutDlg(true);
  };

  const handleNewLayoutClick = () => {
    if (isCurrentUnsaved()) { setUnsavedAction({ type: 'new' }); setShowUnsaved(true); }
    else openNewLayoutDialog();
  };

  const handleSwitchLayout = (targetId) => {
    if (targetId === activeLayIdRef.current) return;
    if (isCurrentUnsaved()) { setUnsavedAction({ type: 'switch', id: targetId }); setShowUnsaved(true); }
    else doSwitchLayout(targetId);
  };

  const confirmNewLayout = () => {
    const name = newLayoutNameInput.trim() || `Layout ${layoutsRef.current.length + 1}`;
    const id   = mkLayId();
    const activeId = activeLayIdRef.current;
    setLayoutData(prev => ({ ...prev, [activeId]: { items: itemsRef.current, canvasW, canvasH }, [id]: { items: [], canvasW: CANVAS_W, canvasH: CANVAS_H } }));
    setLayouts(prev => [...prev, { id, name }]);
    setActiveLayoutId(id);
    setItems([]); setCanvasW(CANVAS_W); setCanvasH(CANVAS_H);
    setSelected(null); setStartPin(null); setEndPin(null);
    setShowNewLayoutDlg(false);
    setTimeout(fitScreen, 60);
  };

  const handleUnsavedSave = async () => {
    setShowUnsaved(false);
    await handleSave();
    const action = unsavedAction;
    setUnsavedAction(null);
    if (action?.type === 'new') openNewLayoutDialog();
    else if (action?.type === 'switch') doSwitchLayout(action.id);
  };

  const handleUnsavedDiscard = () => {
    setShowUnsaved(false);
    const action = unsavedAction;
    setUnsavedAction(null);
    if (action?.type === 'new') openNewLayoutDialog();
    else if (action?.type === 'switch') doSwitchLayout(action.id);
  };

  const handleToggleLock = async () => {
    if (!purchaseId) return;
    try { const d = await apiPost(`/purchases/${purchaseId}/layout/lock`, {}); setLayout(d); setLockConfirm(false); } catch {}
  };

  const handleInsertElement = () => {
    const el = canvasRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = (rect.width  / 2 - panRef.current.x) / zoomRef.current;
    const cy = (rect.height / 2 - panRef.current.y) / zoomRef.current;
    const g  = snapRef.current;
    if (insertType === 'text')   setItems(prev => [...prev, { id: mkId(), type: 'text',   x: snapTo(cx - 60, g),  y: snapTo(cy - 15, g), w: 120, h: 30,  label: 'Text Label' }]);
    if (insertType === 'rect')   setItems(prev => [...prev, { id: mkId(), type: 'open',   x: snapTo(cx - 60, g),  y: snapTo(cy - 40, g), w: 120, h: 80,  label: 'Area' }]);
    if (insertType === 'line')   setItems(prev => [...prev, { id: mkId(), type: 'road',   x: snapTo(cx - 100, g), y: snapTo(cy - 15, g), w: 200, h: 30,  label: '7.50 MT WIDE ROAD' }]);
    if (insertType === 'dotted') setItems(prev => [...prev, { id: mkId(), type: 'dotted', x: snapTo(cx - 100, g), y: snapTo(cy - 5, g),  w: 200, h: 10,  label: '' }]);
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
      <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', flexShrink: 0, zIndex: 20, overflowX: 'auto', overflowY: 'hidden' }}>

        {/* Settings for Config */}
        <button onClick={() => setShowConfig(true)} title="Settings for Config"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '5px 12px', border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
          <svg width="18" height="18" fill="none" stroke="#6b7280" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" strokeWidth={1.8}/></svg>
          <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>Settings</span>
        </button>

        <Sep/>

        {/* New Layout */}
        <button onClick={handleNewLayoutClick} title="New Layout"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '5px 12px', border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
          <svg width="18" height="18" fill="none" stroke="#16a34a" viewBox="0 0 24 24" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="6.5" y1="17.5" x2="9.5" y2="17.5"/><line x1="8" y1="16" x2="8" y2="19"/></svg>
          <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>New Layout</span>
        </button>

        {/* Add Project */}
        <button onClick={() => alert('Select a project to load inventory — coming soon.')} title="Add Project"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '5px 12px', border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.background='#eff6ff'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
          <svg width="18" height="18" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/><rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.5}/></svg>
          <span style={{ fontSize: 9, color: '#2563eb', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>Add Project</span>
        </button>

        <Sep/>

        {/* Status Wise / Sold Status toggle */}
        <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          {[['status','Status Wise'],['sold','Sold Status']].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              style={{ height: 32, padding: '0 10px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: viewMode === mode ? PRI : '#fff', color: viewMode === mode ? '#fff' : '#6b7280', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Search Plot */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width="13" height="13" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" strokeWidth="2"/><path strokeLinecap="round" strokeWidth="2" d="m21 21-4.35-4.35"/>
          </svg>
          <input placeholder="Search Plot" value={searchPlot} onChange={e => setSearchPlot(e.target.value)}
            style={{ height: 32, width: 140, paddingLeft: 28, paddingRight: 8, border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, color: '#374151', background: '#fff', outline: 'none' }}/>
        </div>

        <Sep/>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {[['#22c55e','Available'],['#2563eb','Registered'],['#875A7B','Locked']].map(([col, lb]) => (
            <div key={lb} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: col, flexShrink: 0 }}/>
              <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{lb}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}/>

        {/* Zoom */}
        <button onClick={() => stepZoom(-1)} style={{ height: 28, width: 28, border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
        <button onClick={fitScreen} style={{ height: 28, padding: '0 8px', border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: 11, minWidth: 48, textAlign: 'center', flexShrink: 0 }}>{Math.round(zoom * 100)}%</button>
        <button onClick={() => stepZoom(1)} style={{ height: 28, width: 28, border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>

        <Sep/>

        <button onClick={handleSave} disabled={saving}
          style={{ height: 32, padding: '0 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: 'none', cursor: saving ? 'wait' : 'pointer', background: saved ? '#059669' : PRI, color: '#fff', transition: 'background 0.15s', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Layout'}
        </button>
        {canEdit && purchaseId && (
          <button onClick={() => setLockConfirm(true)}
            style={{ height: 32, padding: '0 12px', fontSize: 12, borderRadius: 7, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#f9fafb', color: locked ? '#b45309' : '#6b7280', marginLeft: 4, flexShrink: 0 }}>
            {locked ? '🔒 Unlock' : '🔓 Lock'}
          </button>
        )}
      </div>

      {/* ── Middle ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Left panel */}
        <div style={{ width: 216, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>

          {leftView === 'layouts' ? (
            <>
              {/* Layouts list header */}
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Layouts</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{layouts.length} layout{layouts.length !== 1 ? 's' : ''}</div>
              </div>
              {/* Layout items */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0 }}>
                {layouts.map((l, idx) => {
                  const isActive = l.id === activeLayoutId;
                  return (
                    <button key={l.id}
                      onClick={() => setLeftView({ layoutId: l.id, layoutName: l.name })}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8,
                        background: isActive ? `${PRI}10` : 'transparent',
                        border: `1.5px solid ${isActive ? PRI + '40' : '#f3f4f6'}`,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', width: '100%' }}>
                      {/* Layout icon */}
                      <div style={{ width: 30, height: 30, borderRadius: 6, background: isActive ? PRI : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" fill="none" stroke={isActive ? '#fff' : '#9ca3af'} viewBox="0 0 24 24" strokeWidth={2}>
                          <rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>
                          <rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? PRI : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>Layout {idx + 1}</div>
                      </div>
                      <svg width="12" height="12" fill="none" stroke="#d1d5db" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6"/></svg>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Projects header with back */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
                <button onClick={() => setLeftView('layouts')}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', color: '#6b7280', marginBottom: 6 }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6"/></svg>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>Back to Layouts</span>
                </button>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leftView?.layoutName}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Projects</div>
              </div>
              {/* Empty projects state */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" fill="none" stroke="#d1d5db" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>No projects yet</div>
                  <div style={{ fontSize: 11, color: '#d1d5db', lineHeight: 1.5 }}>Projects linked to<br/>this layout will appear here</div>
                </div>
              </div>
            </>
          )}

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
              const rot = item.rotation || 0;
              const basePos = { position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h, transform: rot ? `rotate(${rot}deg)` : undefined, transformOrigin: 'center center' };

              if (item.type === 'plot') {
                const unit = unitFor(item.inventory_id);
                if (!unit) return null;
                const srch = searchPlot.trim().toLowerCase();
                const isHighlighted = srch.length > 0 && (
                  String(unit.plot_no || '').toLowerCase().includes(srch) ||
                  String(unit.sl_no   || '').toLowerCase().includes(srch)
                );
                return (
                  <div key={item.id} data-item={item.id}
                    style={{ ...basePos, touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default' }}>
                    <svg width={item.w} height={item.h} style={{ overflow: 'visible', display: 'block' }}>
                      <PlotContent item={item} unit={unit} isSel={isSel} hideFlags={hideFlags} viewMode={viewMode} isHighlighted={isHighlighted}/>
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
                    {isSel && !locked && canEdit && <RotationHandle id={item.id}/>}
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
                    {isSel && !locked && canEdit && <RotationHandle id={item.id}/>}
                  </div>
                );
              }
              if (item.type === 'text') {
                return (
                  <div key={item.id} data-item={item.id}
                    onDoubleClick={e => { e.stopPropagation(); setEditLabel({ id: item.id, value: item.label || '' }); }}
                    style={{ ...basePos, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default', outline: isSel ? `2px solid ${PRI}` : 'none', outlineOffset: 2 }}>
                    {editLabel?.id === item.id
                      ? <input autoFocus value={editLabel.value} onChange={e => setEditLabel(p => ({ ...p, value: e.target.value }))} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditLabel(null); }} onClick={e => e.stopPropagation()} style={{ border: 'none', background: 'transparent', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#111827', width: '92%', outline: 'none' }}/>
                      : <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', textAlign: 'center', pointerEvents: 'none', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{item.label || 'Text Label'}</span>
                    }
                    {isSel && !locked && canEdit && <ResizeHandles id={item.id}/>}
                    {isSel && !locked && canEdit && <RotationHandle id={item.id}/>}
                  </div>
                );
              }

              if (item.type === 'dotted') {
                return (
                  <div key={item.id} data-item={item.id}
                    style={{ ...basePos, display: 'flex', alignItems: 'center', touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default', outline: isSel ? `2px solid ${PRI}` : 'none', outlineOffset: 2 }}>
                    <svg width={item.w} height={item.h} style={{ display: 'block', overflow: 'visible' }}>
                      <line x1={0} y1={item.h / 2} x2={item.w} y2={item.h / 2} stroke="#6b7280" strokeWidth="2" strokeDasharray="8 5"/>
                    </svg>
                    {isSel && !locked && canEdit && <ResizeHandles id={item.id}/>}
                    {isSel && !locked && canEdit && <RotationHandle id={item.id}/>}
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
        <div style={{ width: 280, background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {selItem ? (
            <>
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
                <PLabel>{{ plot: 'Plot', road: 'Road', open: 'Garden', text: 'Text', dotted: 'Dotted Line' }[selItem.type] || selItem.type}</PLabel>
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
                {selItem.type !== 'plot' && !locked && canEdit && (
                  <div style={{ marginBottom: 12 }}>
                    <PLabel>Rotation (°)</PLabel>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="range" min={0} max={359} value={selItem.rotation || 0}
                        onChange={e => setItems(prev => prev.map(i => i.id === selected ? { ...i, rotation: Number(e.target.value) } : i))}
                        style={{ flex: 1, accentColor: PRI }}/>
                      <input type="number" min={0} max={359} value={selItem.rotation || 0}
                        onChange={e => { let v = Number(e.target.value) % 360; if (v < 0) v += 360; setItems(prev => prev.map(i => i.id === selected ? { ...i, rotation: v } : i)); }}
                        style={{ ...inp, width: 56, flexShrink: 0 }}/>
                      <button onClick={() => setItems(prev => prev.map(i => i.id === selected ? { ...i, rotation: 0 } : i))}
                        title="Reset rotation"
                        style={{ height: 28, width: 28, flexShrink: 0, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', fontSize: 14, color: '#6b7280' }}>↺</button>
                    </div>
                  </div>
                )}
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
                {(selItem.type === 'road' || selItem.type === 'open' || selItem.type === 'text') && (
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
              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                {[['controls','Controls'],['filter','Filter'],['elements','Elements']].map(([tab, label]) => {
                  const isActive = rightTab === tab;
                  const badge = tab === 'filter' ? Object.values(hideFlags).filter(Boolean).length : 0;
                  return (
                    <button key={tab} onClick={() => setRightTab(tab)}
                      style={{ flex: 1, height: 34, border: 'none', borderBottom: isActive ? `2px solid ${PRI}` : '2px solid transparent', background: 'transparent', color: isActive ? PRI : '#9ca3af', fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'color 0.12s', position: 'relative' }}>
                      {label}
                      {badge > 0 && <span style={{ position: 'absolute', top: 5, right: 6, background: PRI, color: '#fff', borderRadius: 8, fontSize: 9, fontWeight: 700, padding: '1px 5px', lineHeight: 1.4 }}>{badge}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Controls tab */}
              {rightTab === 'controls' && (
                <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
                  <div style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 7, fontSize: 10, color: '#9ca3af', lineHeight: 2 }}>
                    <div><b style={{ color: '#6b7280' }}>Zoom</b> — Ctrl+Scroll or ± buttons</div>
                    <div><b style={{ color: '#6b7280' }}>Pan</b> — Space+Drag or Scroll</div>
                    <div><b style={{ color: '#6b7280' }}>Place</b> — Drag unit from left panel</div>
                    <div><b style={{ color: '#6b7280' }}>Select</b> — Click item to edit props</div>
                    <div><b style={{ color: '#6b7280' }}>Delete</b> — Select item, press Del</div>
                    <div><b style={{ color: '#6b7280' }}>Fit</b> — Click % button in toolbar</div>
                  </div>
                </div>
              )}

              {/* Filter tab */}
              {rightTab === 'filter' && (
                <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Display Options</div>
                  {[
                    ['plotNo',     'Hide Plot Number'],
                    ['totalArea',  'Hide Total Area'],
                    ['lockSymbol', 'Hide Lock Symbol'],
                    ['frontBack',  'Hide Front / Back Value'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <input type="checkbox" checked={hideFlags[key]} onChange={e => setHideFlags(p => ({ ...p, [key]: e.target.checked }))}
                        style={{ accentColor: PRI, width: 14, height: 14, cursor: 'pointer' }}/>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{label}</span>
                    </label>
                  ))}
                  <button onClick={() => setHideFlags({ plotNo: false, totalArea: false, lockSymbol: false, frontBack: false })}
                    style={{ marginTop: 14, width: '100%', height: 30, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                    Reset All
                  </button>
                </div>
              )}

              {/* Elements tab */}
              {rightTab === 'elements' && (
                <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Insert Element</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      ['text',   'Text Label',       '#6b7280', 'T'],
                      ['rect',   'Square / Rectangle','#22c55e', '▭'],
                      ['line',   'Line (Road)',        '#0369a1', '═'],
                      ['dotted', 'Dotted Line',        '#9ca3af', '┄'],
                    ].map(([type, label, color, icon]) => (
                      <button key={type} onClick={() => { setInsertType(type); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${insertType === type ? color : '#e5e7eb'}`, borderRadius: 7, background: insertType === type ? `${color}12` : '#f9fafb', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                        <span style={{ fontSize: 16, color, lineHeight: 1, width: 20, textAlign: 'center' }}>{icon}</span>
                        <span style={{ fontSize: 12, color: insertType === type ? color : '#374151', fontWeight: insertType === type ? 600 : 400 }}>{label}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={handleInsertElement}
                    style={{ marginTop: 14, width: '100%', height: 34, border: 'none', borderRadius: 7, background: PRI, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add to Canvas
                  </button>
                  <p style={{ marginTop: 8, fontSize: 10, color: '#d1d5db', textAlign: 'center', lineHeight: 1.5 }}>Selects type then places it at canvas centre</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{ height: 28, background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 14, fontSize: 10, color: '#9ca3af', flexShrink: 0, overflowX: 'auto' }}>
        <span style={{ color: '#6b7280' }}>{items.filter(i => i.type === 'plot').length} plots</span>
        <span>{items.filter(i => i.type === 'road').length} roads</span>
        <span>{items.filter(i => i.type === 'open').length} gardens</span>
        <span>{unplaced.length} unplaced</span>
        <div style={{ width: 1, height: 12, background: '#e5e7eb', flexShrink: 0 }}/>
        {Object.values(SC).map(c => (
          <div key={c.lb} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.bd, flexShrink: 0 }}/>
            <span style={{ color: '#6b7280' }}>{c.lb}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0369a1', flexShrink: 0 }}/>
          <span style={{ color: '#6b7280' }}>Road</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#22c55e', flexShrink: 0 }}/>
          <span style={{ color: '#6b7280' }}>Garden</span>
        </div>
        {locked && <span style={{ color: '#b45309', fontWeight: 600, flexShrink: 0 }}>● Locked</span>}
        <span style={{ marginLeft: 'auto', flexShrink: 0 }}>{Math.round(zoom * 100)}% · Snap {snapG}px</span>
      </div>

      {/* Unsaved Changes Warning */}
      {showUnsaved && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} onClick={() => { setShowUnsaved(false); setUnsavedAction(null); }}/>
          <div style={{ position: 'relative', background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 28, maxWidth: 380, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>Unsaved Changes</h3>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 22px', lineHeight: 1.6 }}>
              The current layout has unsaved changes. What would you like to do?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowUnsaved(false); setUnsavedAction(null); }}
                style={{ height: 36, padding: '0 16px', fontSize: 13, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleUnsavedDiscard}
                style={{ height: 36, padding: '0 16px', fontSize: 13, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>Discard</button>
              <button onClick={handleUnsavedSave}
                style={{ height: 36, padding: '0 20px', fontSize: 13, fontWeight: 700, background: PRI, border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* New Layout Dialog */}
      {showNewLayoutDlg && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} onClick={() => setShowNewLayoutDlg(false)}/>
          <div style={{ position: 'relative', background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 28, maxWidth: 380, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 18px' }}>Create New Layout</h3>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Layout Name</div>
              <input
                autoFocus
                type="text"
                value={newLayoutNameInput}
                onChange={e => setNewLayoutNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmNewLayout(); if (e.key === 'Escape') setShowNewLayoutDlg(false); }}
                placeholder="e.g. Layout 2"
                style={{ width: '100%', height: 38, padding: '0 12px', border: `1.5px solid ${PRI}`, borderRadius: 8, fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' }}/>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px', lineHeight: 1.5 }}>
              A new empty canvas will be created. You can switch between layouts using the tabs below the toolbar.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewLayoutDlg(false)}
                style={{ height: 36, padding: '0 16px', fontSize: 13, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmNewLayout}
                style={{ height: 36, padding: '0 24px', fontSize: 13, fontWeight: 700, background: PRI, border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer' }}>Create Layout</button>
            </div>
          </div>
        </div>
      )}

      {/* Config / Settings modal */}
      {showConfig && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowConfig(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}/>
          <div style={{ position: 'relative', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: 24, maxWidth: 360, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 18px' }}>Canvas Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>Snap Grid (px)</div>
                <input type="number" min={1} max={500} value={snapG} onChange={e => setSnapG(Math.max(1, Number(e.target.value) || 1))}
                  style={{ height: 34, width: '100%', padding: '0 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, color: '#111827', outline: 'none' }}/>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>Canvas Width (px)</div>
                <input type="number" min={500} max={20000} value={canvasW} onChange={e => setCanvasW(Math.max(500, Number(e.target.value) || CANVAS_W))}
                  style={{ height: 34, width: '100%', padding: '0 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, color: '#111827', outline: 'none' }}/>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>Canvas Height (px)</div>
                <input type="number" min={500} max={20000} value={canvasH} onChange={e => setCanvasH(Math.max(500, Number(e.target.value) || CANVAS_H))}
                  style={{ height: 34, width: '100%', padding: '0 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, color: '#111827', outline: 'none' }}/>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowConfig(false)} style={{ height: 36, padding: '0 20px', fontSize: 13, fontWeight: 600, background: PRI, border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer' }}>Done</button>
            </div>
          </div>
        </div>
      )}

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
