'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
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

function fmtFt(val) {
  if (val == null || val === '') return null;
  const str = String(val);
  const dot = str.indexOf('.');
  if (dot === -1) return `${str}'`;
  return `${str.slice(0, dot)}'-${str.slice(dot + 1)}"`;
}

function mkPalette(hex, label) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const mix = (c, a) => Math.round(c * a + 255 * (1 - a)).toString(16).padStart(2, '0');
  const bg  = `#${mix(r, 0.15)}${mix(g, 0.15)}${mix(b, 0.15)}`;
  const bg2 = `#${mix(r, 0.28)}${mix(g, 0.28)}${mix(b, 0.28)}`;
  const tx  = `#${Math.round(r * 0.45).toString(16).padStart(2, '0')}${Math.round(g * 0.45).toString(16).padStart(2, '0')}${Math.round(b * 0.45).toString(16).padStart(2, '0')}`;
  return { bg, bg2, bd: hex, tx, lb: label };
}

const snapTo   = (v, g) => Math.round(v / g) * g;
const mkId       = () => Math.random().toString(36).slice(2, 9);
const mkLayId    = () => `lay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const DIM_INSET = 12;
// Canvas stacking: items use their list position; these offsets keep highlights, selection and guides on top
const Z_HIGHLIGHT = 200000, Z_SELECTED = 400000, Z_OVERLAY = 900000;
const PRI       = '#875A7B';
const CANVAS_W  = 3000;
const CANVAS_H  = 3600;
const clampZoom = z => Math.min(20, Math.max(0.05, z));

// ── Dimension helpers ─────────────────────────────────────────────────────────
// Measurement labels sit on the OUTER side of their line (between the line and the plot edge), centred on it.
// side: 'top' | 'bottom' for widths, 'left' | 'right' for lengths.
const DIM_FONT = 8;
function DimH({ x1, x2, y, label, side = 'top' }) {
  if (!label) return null;
  const cx = (x1 + x2) / 2;
  const ty = side === 'bottom' ? y + DIM_FONT : y - 2; // baseline below the line for the bottom edge
  return (
    <g>
      <line x1={x1 + 4} y1={y} x2={x2 - 4} y2={y} stroke="#374151" strokeWidth="0.8"/>
      <line x1={x1 + 4} y1={y - 4} x2={x1 + 4} y2={y + 4} stroke="#374151" strokeWidth="0.8"/>
      <line x1={x2 - 4} y1={y - 4} x2={x2 - 4} y2={y + 4} stroke="#374151" strokeWidth="0.8"/>
      <text x={cx} y={ty} textAnchor="middle" fontSize={DIM_FONT} fontWeight="700" fill="#1f2937" fontFamily="sans-serif">{label}</text>
    </g>
  );
}
function DimV({ x, y1, y2, label, side = 'left' }) {
  if (!label) return null;
  const cy = (y1 + y2) / 2;
  // Text is turned to read bottom-to-top, so its letters extend to the left of the baseline:
  // left edge → baseline just left of the line; right edge → baseline one text-height right of it
  const tx = side === 'right' ? x + DIM_FONT : x - 2;
  return (
    <g>
      <line x1={x} y1={y1 + 4} x2={x} y2={y2 - 4} stroke="#374151" strokeWidth="0.8"/>
      <line x1={x - 4} y1={y1 + 4} x2={x + 4} y2={y1 + 4} stroke="#374151" strokeWidth="0.8"/>
      <line x1={x - 4} y1={y2 - 4} x2={x + 4} y2={y2 - 4} stroke="#374151" strokeWidth="0.8"/>
      <text x={tx} y={cy} textAnchor="middle" fontSize={DIM_FONT} fontWeight="700" fill="#1f2937" fontFamily="sans-serif"
        transform={`rotate(-90,${tx},${cy})`}>{label}</text>
    </g>
  );
}

// ── Plot content ──────────────────────────────────────────────────────────────
function PlotContent({ item, unit, isSel, hideFlags = {}, viewMode = 'status', isHighlighted = false, palette = SC, highlightColor = '#f59e0b' }) {
  let c;
  if (viewMode === 'sold') {
    if (unit?.status === 'AVAILABLE') c = palette.AVAILABLE;
    else if (unit?.status === 'RESERVED') c = palette.RESERVED;
    else c = palette.SOLD;
  } else {
    c = palette[unit?.status] || DC;
  }
  const W   = item.w, H = item.h;
  const gid = `pg-${item.id}`;
  const no  = unit ? (unit.plot_no || unit.sl_no || `#${unit.id}`) : '?';
  let areaNum = '', areaUnit = '';
  if (unit?.area) { areaNum = Number(unit.area).toFixed(2); areaUnit = unit.area_unit || 'Sq.Yds.'; }
  const frontDim = fmtFt(unit?.front_area);
  const backDim  = fmtFt(unit?.back_area);
  const cx = W / 2;
  const inset = Math.min(DIM_INSET, Math.floor(H * 0.15));
  const inner_y1 = inset + 4, inner_y2 = Math.max(inner_y1 + 20, H - inset - 4), innerH = inner_y2 - inner_y1;
  const noStr = String(no);
  const ovalRx = Math.min(Math.max(10, noStr.length * 4 + 4), W / 2 - 6);
  const ovalRy = Math.min(10, Math.max(6, innerH * 0.22));
  const ovalCy = inner_y1 + ovalRy + 2, areaY1 = ovalCy + ovalRy + 5;
  const fontSize = Math.min(11, Math.max(6, (inner_y2 - areaY1) * 0.55)), smallFont = Math.min(8, Math.max(5, (inner_y2 - areaY1) * 0.35));
  return (
    <>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.bg2}/><stop offset="100%" stopColor={c.bg}/>
        </linearGradient>
      </defs>
      {isHighlighted && <rect x={-5} y={-5} width={W + 10} height={H + 10} fill="none" stroke={highlightColor} strokeWidth="3" strokeDasharray="6 3" rx="6"/>}
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
            <DimH x1={0} x2={W} y={DIM_INSET}     label={hDim} side="top"/>
            <DimH x1={0} x2={W} y={H - DIM_INSET} label={hDim} side="bottom"/>
            <DimV x={DIM_INSET}     y1={0} y2={H} label={vDim} side="left"/>
            <DimV x={W - DIM_INSET} y1={0} y2={H} label={vDim} side="right"/>
          </>
        );
      })()}
    </>
  );
}

// ── Custom plot (not linked to inventory) ─────────────────────────────────────
// Sides are entered like inventory measurements (feet, "42.6" = 42'-6"), at the same scale as inventory plots.
// Four lengths alone don't fix a shape, so it is drawn as the four-sided shape whose corners lie on one
// circle (the usual surveying choice): always closes, is a true rectangle when opposite sides match,
// and keeps the bottom side level. Lengths that can't close fall back to a rectangle and are flagged.
// A triangle plot (shape: 'triangle') has bottom, left and right only; three sides fix it exactly.
const CUSTOM_SIDES = ['top', 'bottom', 'left', 'right'];
const CUSTOM_DEFAULT   = { label: 'Plot', top: '30', bottom: '30', left: '50', right: '50' };
const TRIANGLE_DEFAULT = { label: 'Plot', shape: 'triangle', bottom: '40', left: '35', right: '35' };
const isTriangle = it => it.shape === 'triangle';
function customPlotGeometry(it) {
  const n = k => Math.max(0, parseFloat(it[k]) || 0);
  const b = n('right'), c = n('bottom'), d = n('left');
  let ok, ft, edges;
  if (isTriangle(it)) {
    // Corners: apex, bottom-right, bottom-left (clockwise on screen, y pointing down)
    const ax = c > 0 ? (d * d - b * b + c * c) / (2 * c) : 0;
    ok = b > 0 && c > 0 && d > 0 && b < c + d && c < b + d && d < b + c;
    ft = ok ? [[ax, -Math.sqrt(Math.max(0, d * d - ax * ax))], [c, 0], [0, 0]]
            : [[0, -Math.max(b, d, 1)], [Math.max(c, 1), 0], [0, 0]];
    edges = [['right', 0, 1], ['bottom', 1, 2], ['left', 2, 0]];
  } else {
    const a = n('top');
    const cosL = (c * c + d * d - a * a - b * b) / (2 * (c * d + a * b)); // corner between bottom and left
    const cosR = (c * c + b * b - a * a - d * d) / (2 * (c * b + a * d)); // corner between bottom and right
    ok = a > 0 && b > 0 && c > 0 && d > 0 && Math.abs(cosL) <= 1 && Math.abs(cosR) <= 1;
    // Corners: top-left, top-right, bottom-right, bottom-left (clockwise on screen, y pointing down)
    ft = ok
      ? [[d * cosL, -d * Math.sqrt(1 - cosL * cosL)], [c - b * cosR, -b * Math.sqrt(1 - cosR * cosR)], [c, 0], [0, 0]]
      : [[0, -Math.max(b, d)], [Math.max(a, c), -Math.max(b, d)], [Math.max(a, c), 0], [0, 0]];
    edges = [['top', 0, 1], ['right', 1, 2], ['bottom', 2, 3], ['left', 3, 0]];
  }
  const minX = Math.min(...ft.map(p => p[0])), minY = Math.min(...ft.map(p => p[1]));
  const pts = ft.map(([x, y]) => [(x - minX) * PX_PER_FT, (y - minY) * PX_PER_FT]);
  return { ok, pts, edges,
    w: Math.max(5, Math.round(Math.max(...pts.map(p => p[0])))),
    h: Math.max(5, Math.round(Math.max(...pts.map(p => p[1])))) };
}
const customPlotSize = (it) => { const { w, h } = customPlotGeometry(it); return { w, h }; };
// Rotate: a four-sided plot turns 90° clockwise (left becomes top, top becomes right, …);
// a triangle turns to stand on its next side (right becomes the bottom)
const rotateCustomSides = (it) => isTriangle(it)
  ? { bottom: it.right, right: it.left, left: it.bottom }
  : { top: it.left, right: it.top, bottom: it.right, left: it.bottom };

// Measurement along one side: a line parallel to it just inside the plot, label between the line and
// the side, centred and kept upright (same look as DimH / DimV on inventory plots)
// ip / iq: the matching corners of the plot shrunk inward by DIM_INSET, so lines meet cleanly in sharp corners
function DimEdge({ p, q, ip, iq, inward, label }) {
  if (!label) return null;
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (len < 12) return null;
  const tx = (q[0] - p[0]) / len, ty = (q[1] - p[1]) / len, [nx, ny] = inward;
  const at = (pt, off, along) => [pt[0] + nx * off + tx * along, pt[1] + ny * off + ty * along];
  const inner = (iq[0] - ip[0]) * tx + (iq[1] - ip[1]) * ty; // length of the shrunk side
  if (inner < 12) return null;
  const s = [ip[0] + tx * 4, ip[1] + ty * 4], e = [iq[0] - tx * 4, iq[1] - ty * 4];
  const tick = pt => <line x1={pt[0] - nx * 4} y1={pt[1] - ny * 4} x2={pt[0] + nx * 4} y2={pt[1] + ny * 4} stroke="#374151" strokeWidth="0.8"/>;
  const mid = at([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], DIM_INSET - DIM_FONT / 2 - 1.5, 0);
  let ang = Math.atan2(ty, tx) * 180 / Math.PI;
  if (ang > 90) ang -= 180; else if (ang <= -90) ang += 180;
  return (
    <g>
      <line x1={s[0]} y1={s[1]} x2={e[0]} y2={e[1]} stroke="#374151" strokeWidth="0.8"/>
      {tick(s)}{tick(e)}
      <text x={mid[0]} y={mid[1]} textAnchor="middle" dominantBaseline="central" fontSize={DIM_FONT} fontWeight="700" fill="#1f2937" fontFamily="sans-serif"
        transform={`rotate(${ang},${mid[0]},${mid[1]})`}>{label}</text>
    </g>
  );
}

function CustomPlotContent({ item, isSel, hideFlags = {} }) {
  const c = DC;
  const geo = customPlotGeometry(item), pts = geo.pts, k = pts.length;
  const cx = pts.reduce((s, p) => s + p[0], 0) / k, cy = pts.reduce((s, p) => s + p[1], 0) / k;
  const name = String(item.label || 'Plot');
  const ovalRx = Math.min(Math.max(12, name.length * 4 + 6), item.w / 2 - 6);
  const ovalRy = Math.min(10, Math.max(6, item.h * 0.12));
  // Corners moved inward along the corner's bisector so every side's line sits DIM_INSET inside it
  const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const insetPts = pts.map((v, i) => {
    const a = pts[(i + k - 1) % k], b = pts[(i + 1) % k];
    const u1 = unit(a[0] - v[0], a[1] - v[1]), u2 = unit(b[0] - v[0], b[1] - v[1]);
    const bis = unit(u1[0] + u2[0], u1[1] + u2[1]);
    const sinHalf = Math.max(0.15, Math.abs(u1[0] * bis[1] - u1[1] * bis[0]));
    return [v[0] + bis[0] * DIM_INSET / sinHalf, v[1] + bis[1] * DIM_INSET / sinHalf];
  });
  const edges = geo.edges.map(([key, i, j]) => {
    const p = pts[i], q = pts[j], len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    let n = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len];
    if (n[0] * (cx - (p[0] + q[0]) / 2) + n[1] * (cy - (p[1] + q[1]) / 2) < 0) n = [-n[0], -n[1]]; // point into the plot
    return { key, p, q, ip: insetPts[i], iq: insetPts[j], n };
  });
  return (
    <>
      <polygon points={pts.map(p => p.join(',')).join(' ')} fill={c.bg2} stroke={isSel ? PRI : c.bd} strokeWidth={isSel ? 2.5 : 1.8} strokeLinejoin="round"/>
      {!hideFlags.plotNo && (
        <>
          <ellipse cx={cx} cy={cy} rx={ovalRx} ry={ovalRy} fill="white" stroke={c.bd} strokeWidth="1.5"/>
          <text x={cx} y={cy + ovalRy * 0.38} textAnchor="middle" fontSize={Math.min(11, ovalRy * 1.6)} fontWeight="900" fill={c.tx} fontFamily="sans-serif">{name}</text>
        </>
      )}
      {!hideFlags.frontBack && edges.map(e => <DimEdge key={e.key} p={e.p} q={e.q} ip={e.ip} iq={e.iq} inward={e.n} label={fmtFt(item[e.key])}/>)}
    </>
  );
}

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const UNIT_TYPE_LABEL = { PLOT: 'Plot', SHOP: 'Shop', LAND: 'Land', FLAT: 'Flat', PLOT_WIRE: 'Plot Wire', SHOP_WIRE: 'Shop Wire' };
const unitListLabel = (unit) => {
  const no = unit.plot_no || unit.sl_no || `#${unit.id}`;
  const type = UNIT_TYPE_LABEL[unit.type] || unit.type;
  return type ? `${no} - ${type}` : no;
};

// ── 8-handle resize ───────────────────────────────────────────────────────────
// Text labels: default font size and the box size needed to show the text at a given size
const TEXT_FONT_DEFAULT = 13, TEXT_FONT_MIN = 6, TEXT_FONT_MAX = 200;
let measureCtx = null;
function textBoxFor(text, size) {
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = `700 ${size}px system-ui, -apple-system, sans-serif`;
  return { w: Math.ceil(measureCtx.measureText(text || 'Text Label').width) + 16, h: Math.ceil(size * 1.4) + 8 };
}

// Axis-aligned bounds of an item as drawn (rotation-aware)
function itemBounds(it) {
  const r = (it.rotation || 0) * Math.PI / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  const hw = (it.w * c + it.h * s) / 2, hh = (it.w * s + it.h * c) / 2, cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  return { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
}
const itemsOverlap = (a, b) => {
  const A = itemBounds(a), B = itemBounds(b);
  return A.x1 < B.x2 && B.x1 < A.x2 && A.y1 < B.y2 && B.y1 < A.y2;
};

// Layer order = array order (last = on top). Forward/backward step past the next overlapping item, like Figma.
function reorderItems(list, selIds, mode) {
  const isS = i => selIds.has(i.id);
  if (mode === 'front') return [...list.filter(i => !isS(i)), ...list.filter(isS)];
  if (mode === 'back')  return [...list.filter(isS), ...list.filter(i => !isS(i))];
  const a = [...list];
  const ids = a.filter(isS).map(i => i.id);
  if (mode === 'forward') {
    for (const id of ids.reverse()) {
      const i = a.findIndex(x => x.id === id);
      let j = -1;
      for (let k = i + 1; k < a.length; k++) if (!isS(a[k]) && itemsOverlap(a[i], a[k])) { j = k; break; }
      if (j < 0) continue;
      const [it] = a.splice(i, 1); a.splice(j, 0, it);
    }
  } else {
    for (const id of ids) {
      const i = a.findIndex(x => x.id === id);
      let j = -1;
      for (let k = i - 1; k >= 0; k--) if (!isS(a[k]) && itemsOverlap(a[i], a[k])) { j = k; break; }
      if (j < 0) continue;
      const [it] = a.splice(i, 1); a.splice(j, 0, it);
    }
  }
  return a;
}

// Resize to w×h while keeping the edge opposite `corner` fixed on screen (items rotate about their centre)
function resizeKeepingAnchor(it, corner, w, h) {
  const r = (it.rotation || 0) * Math.PI / 180;
  const sx = corner.includes('e') ? (w - it.w) / 2 : corner.includes('w') ? -(w - it.w) / 2 : 0;
  const sy = corner.includes('s') ? (h - it.h) / 2 : corner.includes('n') ? -(h - it.h) / 2 : 0;
  const cx = it.x + it.w / 2 + sx * Math.cos(r) - sy * Math.sin(r);
  const cy = it.y + it.h / 2 + sx * Math.sin(r) + sy * Math.cos(r);
  return { ...it, x: cx - w / 2, y: cy - h / 2, w, h };
}

// [corner, x fraction, y fraction, outward direction in degrees]
const HANDLES = [['nw', 0, 0, 225], ['n', 0.5, 0, 270], ['ne', 1, 0, 315], ['w', 0, 0.5, 180],
                 ['sw', 0, 1, 135], ['s', 0.5, 1, 90], ['se', 1, 1, 45], ['e', 1, 0.5, 0]];
const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
const THIN_PX = 48, TINY_PX = 16; // on-screen pixels

// Canva-style handles: round corners, pills on the sides. They live inside the zoomed canvas,
// so sizes are divided by zoom to stay constant on screen; being children of the item, they rotate with it.
function ResizeHandles({ id, zoom = 1, rotation = 0, w = 100, h = 100 }) {
  const s = 1 / zoom;
  // Thin items (like roads) drop the corner handles so the end handles stay easy to grab;
  // very thin ones keep only the two end handles
  const sh = h * zoom, sw = w * zoom;
  const list = HANDLES.filter(([c]) => {
    if (sh < THIN_PX && sw < THIN_PX) return c === 'se';
    if (sh < THIN_PX) return c === 'e' || c === 'w' || (sh >= TINY_PX && (c === 'n' || c === 's'));
    if (sw < THIN_PX) return c === 'n' || c === 's' || (sw >= TINY_PX && (c === 'e' || c === 'w'));
    return true;
  });
  return (
    <>
      {list.map(([c, fx, fy, dir]) => {
        const side = c.length === 1, vertical = c === 'e' || c === 'w';
        // visible shape and (larger) grab area, in screen pixels
        const [vw, vh] = !side ? [12, 12] : vertical ? [7, 20] : [20, 7];
        const [hw, hh] = !side ? [22, 22] : vertical ? [16, 30] : [30, 16];
        return (
          <div key={c} data-corner={c} data-id={id}
            style={{ position: 'absolute', left: `calc(${fx * 100}% - ${hw * s / 2}px)`, top: `calc(${fy * 100}% - ${hh * s / 2}px)`,
              width: hw * s, height: hh * s, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', zIndex: 10,
              cursor: RESIZE_CURSORS[Math.round((((dir + rotation) % 360) + 360) % 360 / 45) % 4] }}>
            <div style={{ width: vw * s, height: vh * s, boxSizing: 'border-box', background: '#fff', border: `${1.5 * s}px solid ${PRI}`,
              borderRadius: 999, boxShadow: `0 ${s}px ${4 * s}px rgba(0,0,0,0.3)`, pointerEvents: 'none' }}/>
          </div>
        );
      })}
    </>
  );
}

function RotationHandle({ id, zoom = 1 }) {
  const s = 1 / zoom;
  return (
    <div style={{ position: 'absolute', top: -36 * s, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 20 }}>
      <div data-rotate={id}
        style={{ width: 14 * s, height: 14 * s, boxSizing: 'border-box', borderRadius: '50%', background: '#7c3aed', border: `${2 * s}px solid white`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.35)', cursor: 'grab', touchAction: 'none', pointerEvents: 'all' }}
        title="Drag to rotate"/>
      <div style={{ width: s, height: 22 * s, background: '#7c3aed', opacity: 0.6 }}/>
    </div>
  );
}

// ── Shared input style ────────────────────────────────────────────────────────
const inp = { width: '100%', height: 28, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 5, color: '#111827', fontSize: 12, padding: '0 7px', boxSizing: 'border-box', outline: 'none' };

// Canvas size of a plot from its inventory measurements, at one fixed scale for every plot
// (no min/max clamping, so neighbouring plots stay in true proportion).
// front_area = width, back_area = depth; depth falls back to area ÷ front.
const PX_PER_FT = 5; // canvas pixels per foot
const DEFAULT_PLOT = { w: 100, h: 70 };

function toSqFt(area, unitStr) {
  const u = (unitStr || '').toLowerCase().trim();
  if (u === 'gaj' || u.includes('yard') || u.includes('yd') || u === 'sq yd' || u === 'sq.yd' || u === 'sq.yds' || u === 'sq.yds.')
    return area * 9;            // 1 gaj / sq yd = 9 sq ft
  if (u === 'marla') return area * 272.25;   // 1 marla = 272.25 sq ft
  if (u === 'kanal') return area * 5445;     // 1 kanal = 20 marla
  if (u === 'bigha') return area * 27000;    // 1 bigha ≈ 27000 sq ft (North India)
  if (u === 'acres' || u === 'acre') return area * 43560;
  return area; // assume sq ft
}

// Returns null when the unit has no usable measurements; `rotated` swaps width and depth
function inferPlotSize(unit, rotated = false) {
  const fa = Number(unit?.front_area || 0);
  let depth = Number(unit?.back_area || 0);
  if (!depth && fa && Number(unit?.area)) depth = toSqFt(Number(unit.area), unit?.area_unit) / fa;
  if (!fa || !depth) return null;
  const w = Math.max(1, Math.round(fa * PX_PER_FT)), h = Math.max(1, Math.round(depth * PX_PER_FT));
  return rotated ? { w: h, h: w } : { w, h };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LayoutDesigner({ purchaseId, inventory: inventoryProp = [], canEdit = true, canCreateLayout = canEdit, canDeleteLayout = canEdit }) {
  const canSave = canEdit || canCreateLayout || canDeleteLayout;
  const canvasRef   = useRef(null);  // the container div (overflow:hidden)
  const innerRef    = useRef(null);  // the transformed inner div
  const interactRef = useRef(null);
  const drawPrevRef = useRef(null);
  const snapRef     = useRef(10);
  const toolRef     = useRef('select');
  const selRef      = useRef(null);
  const itemsRef    = useRef([]);
  const historyRef  = useRef([]);
  const handleSaveRef = useRef(null);
  const zoomRef     = useRef(1.0);
  const panRef      = useRef({ x: 40, y: 40 });
  const spaceRef    = useRef(false);

  const [layout,      setLayout]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [autoSave,    setAutoSave]    = useState(() => { try { return localStorage.getItem('ams-layout-autosave') === '1'; } catch { return false; } });
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [loadError,   setLoadError]   = useState('');
  const [saveError,   setSaveError]   = useState('');
  const [conflict,    setConflict]    = useState(false);
  const revRef          = useRef(undefined);
  const conflictRef     = useRef(false);
  const saveChainRef    = useRef(Promise.resolve());
  const migrateLegacyRef = useRef(false);
  const [items,       setItems]       = useState([]);
  const [inventory,   setInventory]   = useState(inventoryProp);
  const [snapG,       setSnapG]       = useState(1);
  const [canvasW,     setCanvasW]     = useState(CANVAS_W);
  const [canvasH,     setCanvasH]     = useState(CANVAS_H);
  const [tool,        setTool]        = useState('select');
  const [selected,      setSelected]      = useState(null);
  const [multiSel,      setMultiSel]      = useState(() => new Set());
  const [selectionRect, setSelectionRect] = useState(null);
  const [resizeInfo,    setResizeInfo]    = useState(null); // live size badge while dragging a resize handle
  const [drawPreview, setDrawPreview] = useState(null);
  const [lockConfirm, setLockConfirm] = useState(false);
  const [editLabel,   setEditLabel]   = useState(null);
  const [startPin,    setStartPin]    = useState(null);
  const [endPin,      setEndPin]      = useState(null);
  const [zoom,        setZoom]        = useState(1.0);
  const [zoomInput,   setZoomInput]   = useState('100');
  const [pan,         setPan]         = useState({ x: 40, y: 40 });
  const [spaceDown,   setSpaceDown]   = useState(false);

  // ── New toolbar state ──
  const [hideFlags,        setHideFlags]        = useState({ plotNo: false, totalArea: false, lockSymbol: false, frontBack: false });
  const [searchPlot,       setSearchPlot]       = useState('');
  const [viewMode,         setViewMode]         = useState('status');
  const [insertType,       setInsertType]       = useState('line');
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
  const layoutDataRef     = useRef({});
  const activeLayIdRef    = useRef(null);
  const layoutsRef        = useRef([]);
  const layoutProjectsRef = useRef({});
  const [leftView,     setLeftView]     = useState('layouts'); // 'layouts' | { layoutId, layoutName }
  // Sidebar unit-type filter (only narrows the left-panel list, not the canvas); empty = all types
  const [sidebarTypes,   setSidebarTypes]   = useState([]);
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const [typeDraft,      setTypeDraft]      = useState([]);
  const filterPopupRef = useRef(null);
  const [rightTab,            setRightTab]            = useState('controls');
  // Project picker
  const [showProjectModal,    setShowProjectModal]    = useState(false);
  // Customisable status colours & search highlight
  const [statusColors, setStatusColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ams-layout-sc') || 'null') || {}; } catch { return {}; }
  });
  const [searchColor, setSearchColor] = useState(() => {
    try { return localStorage.getItem('ams-layout-search-color') || '#f59e0b'; } catch { return '#f59e0b'; }
  });
  const [elementColors, setElementColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ams-layout-ec') || 'null') || {}; } catch { return {}; }
  });
  const colorPickerRefs = useRef({});
  // Canvas filters
  const [filterProject,   setFilterProject]   = useState('ALL');
  const [filterStatus,    setFilterStatus]    = useState('ALL');
  const [filterSubStatus, setFilterSubStatus] = useState('ALL');
  const [allProjects,         setAllProjects]         = useState([]);
  const [allProjectsLoading,  setAllProjectsLoading]  = useState(false);
  const [projectSearch,       setProjectSearch]       = useState('');
  const [layoutProjects,      setLayoutProjects]      = useState({}); // { [layoutId]: [{id,name,inventory,open}] }
  // Layers panel
  const [layerDragId,         setLayerDragId]         = useState(null);
  // Layout rename / delete
  const [renamingLayoutId,    setRenamingLayoutId]    = useState(null);
  const [renameValue,         setRenameValue]         = useState('');

  useEffect(() => { itemsRef.current    = items;          }, [items]);
  useEffect(() => { snapRef.current     = snapG;          }, [snapG]);
  const pushHistory = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-49), [...itemsRef.current]];
  }, []);
  const [ctxMenu, setCtxMenu] = useState(null); // right-click menu position { x, y } inside the canvas
  // Export PDF: menu, and "select area" mode where the user drags the region to export
  const [exportMenu,  setExportMenu]  = useState(false);
  const fitRef = useRef(null); // latest fitScreen, for the keyboard shortcut
  // Status summary under the exported PDF (counts per status); can be left out for copies shown to customers
  const [pdfSummary,  setPdfSummary]  = useState(() => { try { return localStorage.getItem('ams-layout-pdf-summary') !== '0'; } catch { return true; } });
  const [pdfAreaMode, setPdfAreaMode] = useState(false);
  const [pdfRect,     setPdfRect]     = useState(null);
  const pdfAreaRef   = useRef(false);
  const exportPdfRef = useRef(null);
  useEffect(() => { pdfAreaRef.current = pdfAreaMode; }, [pdfAreaMode]);
  const reorderSelection = useCallback((mode) => {
    const sel = multiSelRef.current;
    if (!sel.size) return;
    pushHistory();
    setItems(prev => reorderItems(prev, sel, mode));
  }, [pushHistory]);
  useEffect(() => { toolRef.current     = tool;           }, [tool]);
  useEffect(() => { selRef.current      = selected;       }, [selected]);
  const multiSelRef = useRef(new Set());
  useEffect(() => { multiSelRef.current = multiSel;       }, [multiSel]);
  useEffect(() => { drawPrevRef.current = drawPreview;    }, [drawPreview]);
  useEffect(() => { layoutDataRef.current  = layoutData;  }, [layoutData]);
  useEffect(() => { activeLayIdRef.current = activeLayoutId; }, [activeLayoutId]);
  useEffect(() => { layoutsRef.current        = layouts;        }, [layouts]);
  useEffect(() => { layoutProjectsRef.current = layoutProjects; }, [layoutProjects]);

  // Load saved colours from backend on mount
  useEffect(() => {
    apiGet('/settings').then(s => {
      if (!s?.layout_colors) return;
      try {
        const saved = JSON.parse(s.layout_colors);
        if (saved.status)   setStatusColors(saved.status);
        if (saved.search)   setSearchColor(saved.search);
        if (saved.elements) setElementColors(saved.elements);
        try {
          if (saved.status)   localStorage.setItem('ams-layout-sc', JSON.stringify(saved.status));
          if (saved.search)   localStorage.setItem('ams-layout-search-color', saved.search);
          if (saved.elements) localStorage.setItem('ams-layout-ec', JSON.stringify(saved.elements));
        } catch {}
      } catch {}
    }).catch(() => {});
  }, []);

  // Save colours to backend whenever they change (debounced 600ms)
  const colorSaveTimer = useRef(null);
  useEffect(() => {
    if (!canEdit) return;
    clearTimeout(colorSaveTimer.current);
    colorSaveTimer.current = setTimeout(() => {
      apiPut('/settings/layout-colors', { layout_colors: { status: statusColors, search: searchColor, elements: elementColors } }).catch(() => {});
    }, 600);
    return () => clearTimeout(colorSaveTimer.current);
  }, [statusColors, searchColor, elementColors]);

  // Auto-save (debounced 2s) when items/canvas size change
  const autoSaveTimer = useRef(null);
  const autoSaveRef   = useRef(autoSave);
  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);
  useEffect(() => {
    if (loading) return;
    if (!autoSaveRef.current) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (!autoSaveRef.current) return;
      if (conflictRef.current) return;
      setAutoSaveStatus('saving');
      const ok = await handleSaveRef.current?.();
      setAutoSaveStatus(ok ? 'saved' : 'idle');
      if (ok) setTimeout(() => setAutoSaveStatus('idle'), 2500);
    }, 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [items, canvasW, canvasH]);

  const applyZoom = useCallback((newZ, newPx, newPy) => {
    zoomRef.current = newZ; panRef.current = { x: newPx, y: newPy };
    setZoom(newZ); setPan({ x: newPx, y: newPy });
    setZoomInput(String(Math.round(newZ * 100)));
  }, []);

  const applyPan = useCallback((x, y) => {
    panRef.current = { x, y }; setPan({ x, y });
  }, []);

  // ── Multi-layout init helper ────────────────────────────────────────────────
  const initMultiLayouts = useCallback((rawItems, fallbackGrid) => {
    historyRef.current = [];
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
      setSavedJson(JSON.stringify({ layouts: lays.map(l => ({ id: l.id, name: l.name, items: l.items || [], canvasW: l.canvasW || CANVAS_W, canvasH: l.canvasH || CANVAS_H, projects: (l.projects || []).map(p => ({ id: p.id, name: p.name })) })), activeId }));
      // Restore project associations and re-fetch their inventory
      const restoredProjects = {};
      lays.forEach(l => {
        if (Array.isArray(l.projects) && l.projects.length > 0)
          restoredProjects[l.id] = l.projects.map(p => ({ id: p.id, name: p.name, inventory: [], open: true }));
      });
      if (Object.keys(restoredProjects).length > 0) {
        setLayoutProjects(restoredProjects);
        Object.entries(restoredProjects).forEach(([layoutId, projs]) => {
          projs.forEach(async p => {
            try {
              const data = await apiGet(`/inventory?project_id=${p.id}&limit=500`);
              const inv = Array.isArray(data) ? data : (data?.inventory || data?.data || []);
              setLayoutProjects(prev => ({
                ...prev,
                [layoutId]: (prev[layoutId] || []).map(lp => lp.id === p.id ? { ...lp, inventory: inv } : lp),
              }));
            } catch {}
          });
        });
      }
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
      apiGet('/settings/global-layout').then(data => {
        revRef.current = data?.rev;
        if (data?.items) {
          initMultiLayouts(data.items, { cols: data.grid_cols, rows: data.grid_rows });
          return;
        }
        // Layouts saved before server storage existed live only in this browser — upload them
        let legacy = null;
        try { legacy = JSON.parse(localStorage.getItem('global-layout') || 'null'); } catch {}
        if (legacy?.items && canCreateLayout) {
          initMultiLayouts(legacy.items, { cols: legacy.grid_cols, rows: legacy.grid_rows });
          migrateLegacyRef.current = true;
        } else {
          initMultiLayouts(null, null);
        }
      }).catch(e => setLoadError(e?.message || 'Could not load the layout')).finally(() => setLoading(false));
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
    }).catch(e => setLoadError(e?.message || 'Could not load the layout')).finally(() => setLoading(false));
  }, [purchaseId]);

  useEffect(() => {
    if (loading || !migrateLegacyRef.current) return;
    migrateLegacyRef.current = false;
    handleSaveRef.current?.();
  }, [loading]);

  // On first load: zoom to fit the layout (an empty one opens at 100%, centred)
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => fitRef.current?.(), 60);
    return () => clearTimeout(t);
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
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      // Shift+1: zoom to fit, as in Figma
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'Digit1') { e.preventDefault(); fitRef.current?.(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (canEdit && historyRef.current.length > 0) {
          const prev = historyRef.current.pop();
          setItems(prev);
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && multiSelRef.current.size > 0) {
        if (layout?.locked || !canEdit) return;
        pushHistory();
        const toDelete = new Set(multiSelRef.current);
        setItems(prev => prev.filter(i => !toDelete.has(i.id) || i.item_locked));
        setSelected(null); setMultiSel(new Set());
      }
      if (e.key === 'Escape') {
        if (pdfAreaRef.current) { setPdfAreaMode(false); setPdfRect(null); interactRef.current = null; return; }
        setSelected(null); setMultiSel(new Set()); setEditLabel(null); setCtxMenu(null);
      }
      // Layer order, Figma shortcuts: Ctrl+] forward, Ctrl+[ backward, add Shift for front/back
      if ((e.ctrlKey || e.metaKey) && (e.code === 'BracketRight' || e.code === 'BracketLeft') && multiSelRef.current.size > 0) {
        e.preventDefault();
        if (layout?.locked || !canEdit) return;
        reorderSelection(e.code === 'BracketRight' ? (e.shiftKey ? 'front' : 'forward') : (e.shiftKey ? 'back' : 'backward'));
        setCtxMenu(null);
        return;
      }
      // Arrow keys: move selected items 1px (Shift = 10px or the snap grid if larger)
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && multiSelRef.current.size > 0) {
        if (layout?.locked || !canEdit) return;
        e.preventDefault();
        const step = e.shiftKey ? Math.max(10, snapRef.current) : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
        const ids = multiSelRef.current;
        pushHistory();
        setItems(prev => prev.map(i => ids.has(i.id) && !i.item_locked ? { ...i, x: i.x + dx, y: i.y + dy } : i));
      }
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
  }, [layout, canEdit, pushHistory, reorderSelection]);

  const locked    = layout?.locked || false;
  const placedIds = new Set(items.filter(i => i.type === 'plot').map(i => i.inventory_id));
  const unplaced  = inventory.filter(u => !placedIds.has(u.id));
  // Build a flat lookup that also covers units fetched via the project sidebar
  const projectUnitMap = {};
  Object.values(layoutProjects).forEach(projs => projs.forEach(proj => proj.inventory.forEach(u => { projectUnitMap[u.id] = u; })));
  const unitFor   = id => inventory.find(u => u.id === id) || projectUnitMap[id];

  // Plot size always follows inventory measurements: correct any placed plot whose size differs
  useEffect(() => {
    if (loading) return;
    setItems(prev => {
      let changed = false;
      const next = prev.map(i => {
        if (i.type !== 'plot') return i;
        const s = inferPlotSize(unitFor(i.inventory_id), i.rotated);
        if (!s || (s.w === i.w && s.h === i.h)) return i;
        changed = true;
        return { ...i, w: s.w, h: s.h };
      });
      return changed ? next : prev;
    });
  }, [loading, inventory, layoutProjects, activeLayoutId]);
  const selItem   = multiSel.size === 1 ? items.find(i => i.id === [...multiSel][0]) : null;

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

    if (e.button === 2) return; // right-click is handled by the context menu
    setCtxMenu(null);
    if (pdfAreaRef.current) { // dragging out the area to export (allowed for view-only users too)
      const p = getPos(e);
      interactRef.current = { type: 'pdfarea', sx: p.x, sy: p.y };
      setPdfRect({ x: p.x, y: p.y, w: 0, h: 0 });
      el.setPointerCapture(e.pointerId);
      e.preventDefault(); return;
    }
    // View-only users (or a locked layout) can still click to select and inspect items, but not change them
    const readOnly = locked || !canEdit;
    const pos = getPos(e);

    // Rotation handle
    const rotEl = e.target.closest('[data-rotate]');
    if (rotEl && !readOnly) {
      const id   = rotEl.dataset.rotate;
      const item = itemsRef.current.find(i => i.id === id);
      if (!item || item.item_locked) return;
      const rect2 = el.getBoundingClientRect();
      const cx = (item.x + item.w / 2) * zoomRef.current + panRef.current.x + rect2.left;
      const cy = (item.y + item.h / 2) * zoomRef.current + panRef.current.y + rect2.top;
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      pushHistory();
      interactRef.current = { type: 'rotate', id, cx, cy, startAngle, startRotation: item.rotation || 0 };
      el.setPointerCapture(e.pointerId);
      e.preventDefault(); e.stopPropagation(); return;
    }

    // 8-handle resize
    const cornerEl = e.target.closest('[data-corner]');
    if (cornerEl && !readOnly) {
      const corner = cornerEl.dataset.corner, id = cornerEl.dataset.id;
      const item = itemsRef.current.find(i => i.id === id);
      if (!item || item.item_locked || item.type === 'plot' || item.type === 'custom') return;
      pushHistory();
      interactRef.current = { type: 'resize', id, corner, lx: pos.x, ly: pos.y, ax: 0, ay: 0, ox: item.x, oy: item.y, ow: item.w, oh: item.h, rot: item.rotation || 0 };
      const cr = el.getBoundingClientRect();
      setResizeInfo({ w: item.w, h: item.h, cx: e.clientX - cr.left, cy: e.clientY - cr.top });
      el.setPointerCapture(e.pointerId);
      e.preventDefault(); e.stopPropagation(); return;
    }

    const itemEl = e.target.closest('[data-item]');
    if (itemEl) {
      const id = itemEl.dataset.item, item = itemsRef.current.find(i => i.id === id);
      if (!item || toolRef.current !== 'select') return;
      setEditLabel(null);

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        // Ctrl+click: toggle item in selection
        const next = new Set(multiSelRef.current);
        if (next.has(id)) { next.delete(id); setSelected(next.size === 1 ? [...next][0] : null); }
        else               { next.add(id);   setSelected(id); }
        setMultiSel(next);
        el.setPointerCapture(e.pointerId); return;
      }

      // Regular click: if item already in multi-selection, keep the group and start multi-drag
      if (multiSelRef.current.size > 1 && multiSelRef.current.has(id)) {
        if (!item.item_locked && !readOnly) {
          const initPositions = [...multiSelRef.current].map(iid => {
            const it = itemsRef.current.find(i => i.id === iid);
            return { id: iid, ox: it ? it.x : 0, oy: it ? it.y : 0 };
          });
          pushHistory();
          interactRef.current = { type: 'multidrag', sx: pos.x, sy: pos.y, initPositions };
        }
        el.setPointerCapture(e.pointerId); return;
      }

      // Single select
      setSelected(id); setMultiSel(new Set([id]));
      if (item.item_locked || readOnly) { el.setPointerCapture(e.pointerId); return; }
      pushHistory();
      interactRef.current = { type: 'drag', id, ox: pos.x - item.x, oy: pos.y - item.y };
      el.setPointerCapture(e.pointerId); return;
    }

    setSelected(null); setMultiSel(new Set()); setEditLabel(null);
    const t = toolRef.current;
    if ((t === 'road' || t === 'open') && !readOnly) {
      interactRef.current = { type: 'draw', tool: t, sx: pos.x, sy: pos.y };
      setDrawPreview({ tool: t, x: pos.x, y: pos.y, w: 0, h: 0 });
      el.setPointerCapture(e.pointerId);
    } else if (t === 'select') {
      // Start rubber-band marquee selection
      interactRef.current = { type: 'marquee', sx: pos.x, sy: pos.y };
      setSelectionRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
      el.setPointerCapture(e.pointerId);
    }
  }, [locked, canEdit, getPos, pushHistory]);

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
      // Rotate screen-space delta into item-local space so handles work after rotation
      const rad = (intr.rot || 0) * Math.PI / 180;
      // Accumulate movement step by step; with Shift held, 1 screen pixel = 1 canvas pixel at any zoom
      const f = e.shiftKey ? Math.min(1, zoomRef.current) : 1;
      intr.ax += (pos.x - intr.lx) * f; intr.ay += (pos.y - intr.ly) * f;
      intr.lx = pos.x; intr.ly = pos.y;
      const sdx = intr.ax, sdy = intr.ay;
      const dx = sdx * Math.cos(rad) + sdy * Math.sin(rad);
      const dy = -sdx * Math.sin(rad) + sdy * Math.cos(rad);
      const c = intr.corner;
      const minW = Math.max(10, Math.min(60, intr.ow)), minH = Math.max(10, Math.min(40, intr.oh));
      let w = intr.ow, h = intr.oh;
      if (c.includes('e')) w = Math.max(minW, snapTo(intr.ow + dx, g));
      if (c.includes('w')) w = Math.max(minW, snapTo(intr.ow - dx, g));
      if (c.includes('s')) h = Math.max(minH, snapTo(intr.oh + dy, g));
      if (c.includes('n')) h = Math.max(minH, snapTo(intr.oh - dy, g));
      const { x, y } = resizeKeepingAnchor({ x: intr.ox, y: intr.oy, w: intr.ow, h: intr.oh, rotation: intr.rot }, c, w, h);
      setItems(prev => prev.map(i => i.id === intr.id ? { ...i, x, y, w, h } : i));
      const cr = canvasRef.current.getBoundingClientRect();
      setResizeInfo({ w, h, fine: e.shiftKey, cx: e.clientX - cr.left, cy: e.clientY - cr.top });
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
    if (intr.type === 'pdfarea') {
      setPdfRect({ x: Math.min(intr.sx, pos.x), y: Math.min(intr.sy, pos.y), w: Math.abs(pos.x - intr.sx), h: Math.abs(pos.y - intr.sy) });
      return;
    }
    if (intr.type === 'marquee') {
      setSelectionRect({ x: Math.min(intr.sx, pos.x), y: Math.min(intr.sy, pos.y), w: Math.abs(pos.x - intr.sx), h: Math.abs(pos.y - intr.sy) });
    }
    if (intr.type === 'multidrag') {
      const dx = pos.x - intr.sx, dy = pos.y - intr.sy;
      setItems(prev => prev.map(i => {
        const ini = intr.initPositions.find(p => p.id === i.id);
        if (!ini || i.item_locked) return i;
        return { ...i, x: snapTo(ini.ox + dx, g), y: snapTo(ini.oy + dy, g) };
      }));
    }
  }, [getPos, applyPan]);

  const onPointerUp = useCallback((e) => {
    const intr = interactRef.current;
    if (!intr) return;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch {}
    if (intr.type === 'resize') setResizeInfo(null);
    if (intr.type === 'pdfarea') {
      const pos = getPos(e);
      const r = { x: Math.min(intr.sx, pos.x), y: Math.min(intr.sy, pos.y), w: Math.abs(pos.x - intr.sx), h: Math.abs(pos.y - intr.sy) };
      setPdfRect(null);
      interactRef.current = null;
      // Ignore a click without a drag; otherwise export (pointerup still counts as a user action for the pop-up)
      if (r.w * zoomRef.current > 8 && r.h * zoomRef.current > 8) { setPdfAreaMode(false); exportPdfRef.current?.(r); }
      return;
    }
    if (intr.type === 'draw') {
      const dp = drawPrevRef.current;
      if (dp && dp.w > 15 && dp.h > 10) {
        const g = snapRef.current;
        pushHistory();
        setItems(prev => [...prev, { id: mkId(), type: intr.tool, x: snapTo(dp.x, g), y: snapTo(dp.y, g), w: snapTo(dp.w, g), h: snapTo(dp.h, g), label: intr.tool === 'road' ? '7.50 MT WIDE ROAD' : 'C.O.P. (Garden)' }]);
      }
      setDrawPreview(null);
    }
    if (intr.type === 'marquee') {
      const rect = selectionRect || { x: intr.sx, y: intr.sy, w: 0, h: 0 };
      setSelectionRect(null);
      if (rect.w > 8 && rect.h > 8) {
        const rx1 = rect.x, ry1 = rect.y, rx2 = rect.x + rect.w, ry2 = rect.y + rect.h;
        const caught = itemsRef.current
          .filter(i => !i.item_hidden && i.x < rx2 && i.x + i.w > rx1 && i.y < ry2 && i.y + i.h > ry1)
          .map(i => i.id);
        if (caught.length > 0) {
          setMultiSel(new Set(caught));
          setSelected(caught.length === 1 ? caught[0] : null);
        }
      }
    }
    interactRef.current = null;
  }, [pushHistory, selectionRect, getPos]);

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
    const { w, h } = inferPlotSize(unitFor(inventoryId)) || DEFAULT_PLOT;
    pushHistory();
    setItems(prev => [
      ...prev.filter(i => !(i.type === 'plot' && i.inventory_id === inventoryId)),
      { id: mkId(), type: 'plot', inventory_id: inventoryId, x: snapTo(pos.x - w / 2, g), y: snapTo(pos.y - h / 2, g), w, h },
    ]);
  };

  const commitEdit = () => {
    if (!editLabel) return;
    pushHistory();
    setItems(prev => prev.map(i => i.id === editLabel.id ? { ...i, label: editLabel.value } : i));
    setEditLabel(null);
  };

  // Turn plots 90° (swap width/depth) around their own centre so they stay in place.
  // Custom plots turn their side measurements with them.
  const rotatePlots = useCallback((ids) => {
    pushHistory();
    setItems(prev => prev.map(i => {
      if (!ids.has(i.id) || i.item_locked || (i.type !== 'plot' && i.type !== 'custom')) return i;
      if (i.type === 'plot') return { ...i, x: i.x + (i.w - i.h) / 2, y: i.y + (i.h - i.w) / 2, w: i.h, h: i.w, rotated: !i.rotated };
      // Custom plots are redrawn from their turned sides; keep the centre where it was
      const turned = { ...i, ...rotateCustomSides(i) }, { w, h } = customPlotSize(turned);
      return { ...turned, x: i.x + (i.w - w) / 2, y: i.y + (i.h - h) / 2, w, h };
    }));
  }, [pushHistory]);

  // Change a custom plot's name or a side measurement; the size follows the measurements, kept about its centre
  const setCustomField = useCallback((id, key, value) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const next = { ...i, [key]: value };
      if (!CUSTOM_SIDES.includes(key)) return next;
      const { w, h } = customPlotSize(next);
      return { ...next, x: i.x - (w - i.w) / 2, y: i.y - (h - i.h) / 2, w, h };
    }));
  }, []);
  const rotateItem = useCallback((id) => rotatePlots(new Set([id])), [rotatePlots]);

  // Change a text label's font size; the box grows (about its centre) if the text no longer fits
  const setTextFont = useCallback((id, raw) => {
    const size = Math.min(TEXT_FONT_MAX, Math.max(TEXT_FONT_MIN, Math.round(Number(raw) || TEXT_FONT_DEFAULT)));
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const need = textBoxFor(i.label, size);
      const w = Math.max(i.w, need.w), h = Math.max(i.h, need.h);
      return { ...i, font_size: size, x: i.x - (w - i.w) / 2, y: i.y - (h - i.h) / 2, w, h };
    }));
  }, []);

  const buildMultiPayload = (activeId, activeItems, activeCW, activeCH) => {
    const lays = layoutsRef.current;
    const ld   = layoutDataRef.current;
    const lp   = layoutProjectsRef.current;
    const allLays = lays.map(l => {
      const projects = (lp[l.id] || []).map(({ id, name }) => ({ id, name }));
      return l.id === activeId
        ? { id: l.id, name: l.name, items: activeItems, canvasW: activeCW, canvasH: activeCH, projects }
        : { id: l.id, name: l.name, ...(ld[l.id] || { items: [], canvasW: CANVAS_W, canvasH: CANVAS_H }), projects };
    });
    return { __multi: true, layouts: allLays, activeId };
  };

  const doSave = async () => {
    if (conflictRef.current || !canSave) return false;
    setSaving(true); setSaved(false); setSaveError('');
    const activeId    = activeLayIdRef.current;
    const activeItems = itemsRef.current;
    const payload  = buildMultiPayload(activeId, activeItems, canvasW, canvasH);
    const newJson  = JSON.stringify({ layouts: payload.layouts, activeId });
    try {
      if (!purchaseId) {
        const r = await apiPut('/settings/global-layout', { global_layout: { grid_rows: canvasH, grid_cols: canvasW, items: payload }, base_rev: revRef.current });
        revRef.current = r?.rev;
      } else {
        const d = await apiPut(`/purchases/${purchaseId}/layout`, { grid_rows: canvasH, grid_cols: canvasW, items: payload });
        setLayout(d);
      }
      setSavedJson(newJson);
      setLayoutData(prev => ({ ...prev, [activeId]: { items: activeItems, canvasW, canvasH } }));
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (e) {
      if (e?.status === 409) { conflictRef.current = true; setConflict(true); }
      else setSaveError(`Layout not saved: ${e?.message || 'network error'}. Your changes are still on screen — try saving again.`);
      return false;
    } finally { setSaving(false); }
  };
  // Saves run one at a time so each sends the revision returned by the previous one
  const handleSave = () => {
    const run = saveChainRef.current.then(doSave);
    saveChainRef.current = run.catch(() => {});
    return run;
  };
  handleSaveRef.current = handleSave;

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
    historyRef.current = [];
    setItems(target.items);
    setCanvasW(target.canvasW);
    setCanvasH(target.canvasH);
    setActiveLayoutId(targetId);
    setSelected(null); setMultiSel(new Set()); setStartPin(null); setEndPin(null);
    setTimeout(fitScreen, 60);
  };

  const openNewLayoutDialog = () => {
    const n = layoutsRef.current.length + 1;
    setNewLayoutNameInput(`Layout ${n}`);
    setShowNewLayoutDlg(true);
  };

  const handleNewLayoutClick = () => {
    if (!canCreateLayout) return;
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
    historyRef.current = [];
    setItems([]); setCanvasW(CANVAS_W); setCanvasH(CANVAS_H);
    setSelected(null); setMultiSel(new Set()); setStartPin(null); setEndPin(null);
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
    if (!canEdit || locked) return;
    const el = canvasRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = (rect.width  / 2 - panRef.current.x) / zoomRef.current;
    const cy = (rect.height / 2 - panRef.current.y) / zoomRef.current;
    const g  = snapRef.current;
    if (insertType === 'text')   setItems(prev => [...prev, { id: mkId(), type: 'text',   x: snapTo(cx - 60, g),  y: snapTo(cy - 15, g), w: 120, h: 30,  label: 'Text Label' }]);
    if (insertType === 'rect')   setItems(prev => [...prev, { id: mkId(), type: 'open',   x: snapTo(cx - 60, g),  y: snapTo(cy - 40, g), w: 120, h: 80,  label: 'Area' }]);
    if (insertType === 'line')   setItems(prev => [...prev, { id: mkId(), type: 'road',   x: snapTo(cx - 100, g), y: snapTo(cy - 15, g), w: 200, h: 30,  label: '7.50 MT WIDE ROAD' }]);
    if (insertType === 'dotted') setItems(prev => [...prev, { id: mkId(), type: 'dotted', x: snapTo(cx - 100, g), y: snapTo(cy - 5, g),  w: 200, h: 10,  label: '' }]);
    if (insertType === 'custom' || insertType === 'triangle') {
      const base = insertType === 'triangle' ? TRIANGLE_DEFAULT : CUSTOM_DEFAULT;
      const { w, h } = customPlotSize(base), id = mkId();
      pushHistory();
      setItems(prev => [...prev, { id, type: 'custom', ...base, x: snapTo(cx - w / 2, g), y: snapTo(cy - h / 2, g), w, h }]);
      // Select it straight away so the measurements can be entered in the side panel
      setSelected(id); setMultiSel(new Set([id]));
    }
  };

  // Zoom to fit: frame the items that are on the canvas (like Figma's "Zoom to fit");
  // an empty layout is shown at 100%, centred
  const fitScreen = useCallback(() => {
    const el = canvasRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const shown = itemsRef.current.filter(i => !i.item_hidden);
    if (!shown.length) { applyZoom(1, (rect.width - canvasW) / 2, (rect.height - canvasH) / 2); return; }
    const b = shown.map(itemBounds);
    const x1 = Math.min(...b.map(r => r.x1)), y1 = Math.min(...b.map(r => r.y1));
    const x2 = Math.max(...b.map(r => r.x2)), y2 = Math.max(...b.map(r => r.y2));
    const z = clampZoom(Math.min(2, Math.min(rect.width / (x2 - x1 || 1), rect.height / (y2 - y1 || 1)) * 0.9));
    applyZoom(z, rect.width / 2 - (x1 + x2) / 2 * z, rect.height / 2 - (y1 + y2) / 2 * z);
  }, [canvasW, canvasH, applyZoom]);
  fitRef.current = fitScreen;

  const stepZoom = useCallback((dir) => {
    const el = canvasRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const newZ = clampZoom(zoomRef.current * (dir > 0 ? 1.2 : 1 / 1.2));
    const ratio = newZ / zoomRef.current;
    applyZoom(newZ, cx - ratio * (cx - panRef.current.x), cy - ratio * (cy - panRef.current.y));
  }, [applyZoom]);

  // ── Layout selection state ───────────────────────────────────────────────────
  const isLayoutSelected = typeof leftView === 'object' && leftView !== null;
  const currentLayoutId  = isLayoutSelected ? leftView.layoutId : null;

  // ── Project modal handlers ───────────────────────────────────────────────────
  const handleAddProject = async () => {
    if (!isLayoutSelected || !canEdit) return;
    setProjectSearch('');
    setShowProjectModal(true);
    if (allProjects.length === 0 && !allProjectsLoading) {
      setAllProjectsLoading(true);
      try {
        const d = await apiGet('/lookup/projects?limit=500');
        setAllProjects(Array.isArray(d) ? d : (d?.data || []));
      } catch {} finally { setAllProjectsLoading(false); }
    }
  };

  const handleSelectProject = async (project) => {
    if (!currentLayoutId) return;
    const existing = layoutProjects[currentLayoutId] || [];
    if (existing.find(p => p.id === project.id)) { setShowProjectModal(false); return; }
    setShowProjectModal(false);
    try {
      const data = await apiGet(`/inventory?project_id=${project.id}&limit=500`);
      const inv = Array.isArray(data) ? data : (data?.inventory || data?.data || []);
      const newLp = {
        ...layoutProjectsRef.current,
        [currentLayoutId]: [...(layoutProjectsRef.current[currentLayoutId] || []), { id: project.id, name: project.name, inventory: inv, open: true }],
      };
      layoutProjectsRef.current = newLp;
      setLayoutProjects(newLp);
      handleSave();
    } catch {}
  };

  const toggleProjectOpen = (projectId) => {
    if (!currentLayoutId) return;
    setLayoutProjects(prev => ({
      ...prev,
      [currentLayoutId]: (prev[currentLayoutId] || []).map(p =>
        p.id === projectId ? { ...p, open: !p.open } : p
      ),
    }));
  };

  const handleRemoveProject = (projectId) => {
    if (!currentLayoutId || !canEdit) return;
    const newLp = {
      ...layoutProjectsRef.current,
      [currentLayoutId]: (layoutProjectsRef.current[currentLayoutId] || []).filter(p => p.id !== projectId),
    };
    layoutProjectsRef.current = newLp;
    setLayoutProjects(newLp);
    handleSave();
  };

  const toggleItemVisibility = (id) => {
    if (!canEdit) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, item_hidden: !i.item_hidden } : i));
  };

  const handleLayerReorder = (targetId) => {
    if (!canEdit || !layerDragId || layerDragId === targetId) { setLayerDragId(null); return; }
    setItems(prev => {
      const from = prev.findIndex(i => i.id === layerDragId);
      const to   = prev.findIndex(i => i.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setLayerDragId(null);
  };

  const handleStartRename = (layoutId, currentName) => {
    if (!canEdit) return;
    setRenamingLayoutId(layoutId);
    setRenameValue(currentName);
  };

  const handleConfirmRename = () => {
    if (!renamingLayoutId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      setLayouts(prev => prev.map(l => l.id === renamingLayoutId ? { ...l, name: trimmed } : l));
      if (typeof leftView === 'object' && leftView?.layoutId === renamingLayoutId) {
        setLeftView(prev => ({ ...prev, layoutName: trimmed }));
      }
    }
    setRenamingLayoutId(null);
  };

  const handleDeleteLayout = (layoutId) => {
    if (!canDeleteLayout || layouts.length <= 1) return;
    const remaining = layouts.filter(l => l.id !== layoutId);
    setLayouts(remaining);
    setLayoutData(prev => {
      const next = { ...prev };
      delete next[layoutId];
      return next;
    });
    setLayoutProjects(prev => {
      const next = { ...prev };
      delete next[layoutId];
      return next;
    });
    if (activeLayoutId === layoutId) {
      const next = remaining[0];
      const nextData = layoutDataRef.current[next.id] || { items: [], canvasW: CANVAS_W, canvasH: CANVAS_H };
      setActiveLayoutId(next.id);
      historyRef.current = [];
      setItems(nextData.items);
      setCanvasW(nextData.canvasW);
      setCanvasH(nextData.canvasH);
      setSelected(null); setMultiSel(new Set()); setStartPin(null); setEndPin(null);
      setTimeout(fitScreen, 60);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f4f5f7', color: '#9ca3af', fontSize: 13 }}>
      Loading layout…
    </div>
  );

  if (loadError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', background: '#f4f5f7', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#b91c1c' }}>The layout could not be loaded</div>
      <div style={{ fontSize: 12, color: '#6b7280', maxWidth: 420 }}>{loadError}. Editing is disabled so the saved layout is not overwritten.</div>
      <button onClick={() => window.location.reload()}
        style={{ height: 32, padding: '0 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: 'none', cursor: 'pointer', background: PRI, color: '#fff' }}>
        Retry
      </button>
    </div>
  );

  // Grid step: always ≥ 20px visually on screen, a multiple of the snap grid (min 10 so lines stay tidy)
  const gridBase = Math.max(snapG, 10);
  const gridStep = Math.max(gridBase, Math.ceil(20 / Math.max(zoom, 0.01) / gridBase) * gridBase);
  // Background grid tile size and position (moves with pan/zoom so dots align to canvas coords)
  const gSize   = gridStep * zoom;
  const bgPosX  = ((pan.x % gSize) + gSize) % gSize;
  const bgPosY  = ((pan.y % gSize) + gSize) % gSize;

  const isPanning  = spaceDown;
  const canvasCursor = interactRef.current?.type === 'pan' ? 'grabbing' : isPanning ? 'grab' : pdfAreaMode ? 'crosshair' : { select: 'default', road: 'crosshair', open: 'crosshair' }[tool] || 'default';

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

  const effectiveSC = {};
  for (const [key, def] of Object.entries(SC)) {
    const hex = statusColors[key];
    effectiveSC[key] = hex ? mkPalette(hex, def.lb) : def;
  }

  const EC_DEFAULTS = { road: '#38bdf8', garden: '#4ade80', dotted: '#6b7280', text: '#111827' };
  const ec = {
    road:   mkPalette(elementColors.road   || EC_DEFAULTS.road,   'Road'),
    garden: mkPalette(elementColors.garden || EC_DEFAULTS.garden, 'Garden'),
    dotted: elementColors.dotted || EC_DEFAULTS.dotted,
    text:   elementColors.text   || EC_DEFAULTS.text,
  };

  const unitProjectMap = {};
  (currentLayoutId ? (layoutProjects[currentLayoutId] || []) : []).forEach(proj => {
    proj.inventory.forEach(u => { unitProjectMap[u.id] = proj.id; });
  });
  const SOLD_STATUSES = ['SOLD', 'REGISTERED', 'ATTORNEY', 'FULL_FINAL'];
  const filterActive = filterProject !== 'ALL' || filterStatus !== 'ALL';

  // Opens a print-ready copy of the open layout; the browser's "Save as PDF" produces the file
  // region (canvas coords) = export only that area; omitted = whole layout cropped to its items
  const handleExportPdf = (region) => {
    const visible = items.filter(i => !i.item_hidden && (i.type !== 'plot' || unitFor(i.inventory_id))
      && (!region || itemsOverlap(i, { x: region.x, y: region.y, w: region.w, h: region.h })));
    if (visible.length === 0) {
      setSaveError(region ? 'Nothing to export: the selected area has no items.' : 'Nothing to export: this layout has no items yet.');
      return;
    }
    const w = window.open('', '_blank'); // opened before any other work so pop-up blockers allow it
    if (!w) { setSaveError('The PDF window was blocked. Allow pop-ups for this site and try again.'); return; }

    // Render once without selection handles/outlines, copy the canvas, then restore. Start/End pins and the
    // selected plot are kept, so Start-to-End measurements shown on screen are printed too.
    const prevMulti = multiSel;
    flushSync(() => { setMultiSel(new Set()); setSelectionRect(null); setDrawPreview(null); setCtxMenu(null); });
    const measureEl = innerRef.current.querySelector('svg[data-measure]');
    const mb = measureEl ? measureEl.getBBox() : null; // canvas coordinates of the measurement bars
    const clone = innerRef.current.cloneNode(true);
    setMultiSel(prevMulti);
    const measure = mb && mb.width > 0 ? { x1: mb.x - 6, y1: mb.y - 6, x2: mb.x + mb.width + 6, y2: mb.y + mb.height + 6 } : null;
    // An area that touches the measurement is widened to include it, so the bars aren't cut off
    if (region && measure && measure.x1 < region.x + region.w && measure.x2 > region.x && measure.y1 < region.y + region.h && measure.y2 > region.y) {
      const x1 = Math.min(region.x, measure.x1), y1 = Math.min(region.y, measure.y1);
      region = { x: x1, y: y1, w: Math.max(region.x + region.w, measure.x2) - x1, h: Math.max(region.y + region.h, measure.y2) - y1 };
    }

    // Crop to the placed items (rotation-aware)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const it of visible) {
      const r = (it.rotation || 0) * Math.PI / 180, cx = it.x + it.w / 2, cy = it.y + it.h / 2;
      for (const [px, py] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const lx = px * it.w / 2, ly = py * it.h / 2;
        const X = cx + lx * Math.cos(r) - ly * Math.sin(r), Y = cy + lx * Math.sin(r) + ly * Math.cos(r);
        minX = Math.min(minX, X); minY = Math.min(minY, Y); maxX = Math.max(maxX, X); maxY = Math.max(maxY, Y);
      }
    }
    if (measure) { minX = Math.min(minX, measure.x1); minY = Math.min(minY, measure.y1); maxX = Math.max(maxX, measure.x2); maxY = Math.max(maxY, measure.y2); }
    const pad = 24;
    minX -= pad; minY -= pad;
    let bw = maxX + pad - minX, bh = maxY + pad - minY;
    if (region) { minX = region.x; minY = region.y; bw = region.w; bh = region.h; }
    clone.style.transform = 'none';
    clone.style.left = `${-minX}px`;
    clone.style.top  = `${-minY}px`;

    // A4, orientation follows the layout's shape; area left after margins, header and legend
    const landscape = bw >= bh;
    const MM = 96 / 25.4;
    const pageW = (landscape ? 297 : 210) - 20, pageH = (landscape ? 210 : 297) - 20;
    const availW = pageW * MM, availH = (pageH - 34) * MM;
    const scale = Math.min(availW / bw, availH / bh, region ? 6 : 2);

    // Legend: plot statuses actually placed, coloured as on screen. For an area, count plots whose
    // centre is inside it (neighbours only clipped at the edge are not counted)
    const inArea = it => !region || (it.x + it.w / 2 >= region.x && it.x + it.w / 2 <= region.x + region.w && it.y + it.h / 2 >= region.y && it.y + it.h / 2 <= region.y + region.h);
    const counts = {};
    for (const it of visible) {
      if (it.type !== 'plot' || !inArea(it)) continue;
      const st = unitFor(it.inventory_id)?.status;
      const key = viewMode === 'sold' ? (st === 'AVAILABLE' || st === 'RESERVED' ? st : 'SOLD') : st;
      counts[key] = (counts[key] || 0) + 1;
    }
    const swatch = (bg, bd, label, n) =>
      `<span class="lg"><i style="background:${bg};border-color:${bd}"></i>${escHtml(label)}${n != null ? ` <b>${n}</b>` : ''}</span>`;
    const legend = [
      ...Object.keys(SC).filter(k => counts[k]).map(k => swatch(effectiveSC[k].bg, effectiveSC[k].bd, viewMode === 'sold' && k === 'SOLD' ? 'Sold (all)' : effectiveSC[k].lb, counts[k])),
      ...(counts.undefined ? [swatch(DC.bg, DC.bd, 'Other', counts.undefined)] : []),
      ...(visible.some(i => i.type === 'road') ? [swatch(ec.road.bg, ec.road.bd, 'Road')] : []),
      ...(visible.some(i => i.type === 'open') ? [swatch(ec.garden.bg, ec.garden.bd, 'Garden')] : []),
      ...(visible.some(i => i.type === 'custom') ? [swatch(DC.bg2, DC.bd, 'Custom plot')] : []),
    ].join('');
    const plotCount = Object.values(counts).reduce((a, b) => a + b, 0);

    const layoutName = layouts.find(l => l.id === activeLayoutId)?.name || 'Layout';
    const projectNames = (layoutProjects[activeLayoutId] || []).map(p => p.name).filter(Boolean).join(', ');
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const font = getComputedStyle(innerRef.current).fontFamily;

    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(layoutName)} - Layout</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; background: #fff; color: #111827; font-family: ${font}; }
  .page { width: ${pageW}mm; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 2px solid ${PRI}; padding-bottom: 6px; margin-bottom: 8px; }
  h1 { font-size: 18px; margin: 0; color: ${PRI}; }
  .sub { font-size: 11px; color: #4b5563; margin-top: 2px; }
  .meta { font-size: 10px; color: #6b7280; text-align: right; white-space: nowrap; }
  .fit { width: ${bw * scale}px; height: ${bh * scale}px; margin: 0 auto; border: 1px solid #d1d5db; overflow: hidden; }
  .board { position: relative; width: ${bw}px; height: ${bh}px; transform: scale(${scale}); transform-origin: 0 0; background: #fff; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: 10px; color: #374151; }
  .lg { display: inline-flex; align-items: center; gap: 5px; }
  .lg i { width: 12px; height: 12px; border: 1.5px solid; border-radius: 2px; display: inline-block; }
  .tip { font: 13px/1.5 system-ui, sans-serif; background: #f5f3ff; border: 1px solid #ddd6fe; color: #4c1d95; padding: 10px 14px; border-radius: 8px; margin: 12px auto; width: ${pageW}mm; }
  @media print { .tip { display: none; } }
</style></head><body>
<div class="tip">In the print window, choose <b>Save as PDF</b> as the destination to download this layout.</div>
<div class="page">
  <header>
    <div>
      <h1>${escHtml(layoutName)}</h1>
      ${projectNames ? `<div class="sub">Projects: ${escHtml(projectNames)}</div>` : ''}
    </div>
    <div class="meta">${region ? 'Selected area &middot; ' : ''}${plotCount} plot${plotCount === 1 ? '' : 's'}${filterActive || searchPlot.trim() ? ' &middot; filtered view' : ''}<br>Exported ${escHtml(dateStr)}</div>
  </header>
  <div class="fit"><div class="board">${clone.outerHTML}</div></div>
  ${legend && pdfSummary ? `<div class="legend">${legend}</div>` : ''}
</div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 150); };</script>
</body></html>`);
    w.document.close();
  };
  exportPdfRef.current = handleExportPdf;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f4f5f7', color: '#111827', fontFamily: 'system-ui,-apple-system,sans-serif', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', flexShrink: 0, zIndex: 20, overflowX: 'auto', overflowY: 'hidden' }}>

        {/* New Layout */}
        {canCreateLayout && <button onClick={handleNewLayoutClick} title="New Layout"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '5px 12px', border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
          <svg width="18" height="18" fill="none" stroke="#16a34a" viewBox="0 0 24 24" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="6.5" y1="17.5" x2="9.5" y2="17.5"/><line x1="8" y1="16" x2="8" y2="19"/></svg>
          <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>New Layout</span>
        </button>}

        {/* Add Project */}
        {canEdit && <button onClick={handleAddProject} title={isLayoutSelected ? 'Add Project' : 'Select a layout first'}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '5px 12px', border: 'none', borderRadius: 7, background: 'transparent', cursor: isLayoutSelected ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'background 0.12s', opacity: isLayoutSelected ? 1 : 0.35, pointerEvents: isLayoutSelected ? 'auto' : 'none' }}
          onMouseEnter={e => { if (isLayoutSelected) e.currentTarget.style.background='#eff6ff'; }} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
          <svg width="18" height="18" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/><rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.5}/></svg>
          <span style={{ fontSize: 9, color: '#2563eb', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>Add Project</span>
        </button>}

        {(canEdit || canCreateLayout) && <Sep/>}

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
        <button onClick={() => stepZoom(-1)} style={{ height: 28, width: 28, border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', color: '#374151', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
        <div style={{ display: 'flex', alignItems: 'center', height: 28, border: '1px solid #e5e7eb', borderRadius: 5, background: '#fff', overflow: 'hidden', flexShrink: 0 }}>
          <input
            type="number"
            value={zoomInput}
            onChange={e => setZoomInput(e.target.value)}
            onBlur={() => {
              const v = parseInt(zoomInput, 10);
              if (!isNaN(v) && v >= 5 && v <= 2000) {
                const el = canvasRef.current; if (!el) return;
                const rect = el.getBoundingClientRect();
                const cx = rect.width / 2, cy = rect.height / 2;
                const newZ = clampZoom(v / 100);
                const ratio = newZ / zoomRef.current;
                applyZoom(newZ, cx - ratio * (cx - panRef.current.x), cy - ratio * (cy - panRef.current.y));
              } else {
                setZoomInput(String(Math.round(zoomRef.current * 100)));
              }
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            style={{ width: 44, height: '100%', border: 'none', outline: 'none', fontSize: 11, textAlign: 'center', color: '#374151', background: 'transparent', fontWeight: 600, MozAppearance: 'textfield' }}
          />
          <span style={{ fontSize: 11, color: '#9ca3af', paddingRight: 6, lineHeight: 1 }}>%</span>
        </div>
        <button onClick={() => stepZoom(1)} style={{ height: 28, width: 28, border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', color: '#374151', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
        <button onClick={fitScreen} title="Zoom to fit the whole layout (Shift+1)"
          style={{ height: 28, padding: '0 9px', border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', color: '#374151', cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Fit</button>

        <Sep/>

        {canSave && <>
        <button onClick={handleSave} disabled={saving}
          style={{ height: 32, padding: '0 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: 'none', cursor: saving ? 'wait' : 'pointer', background: saved ? '#059669' : PRI, color: '#fff', transition: 'background 0.15s', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Layout'}
        </button>
        <button onClick={() => setAutoSave(v => { const n = !v; try { localStorage.setItem('ams-layout-autosave', n ? '1' : '0'); } catch {} return n; })}
          title={autoSave ? 'Auto Save is ON — click to disable' : 'Auto Save is OFF — click to enable'}
          style={{ height: 32, padding: '0 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${autoSave ? '#059669' : '#e5e7eb'}`, cursor: 'pointer', background: autoSave ? '#dcfce7' : '#f9fafb', color: autoSave ? '#059669' : '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 4 }}>
          {autoSave ? '⟳ Auto' : '⟳ Auto'}
        </button>
        </>}
        <div style={{ position: 'relative', flexShrink: 0, marginLeft: 4 }}>
          <button onClick={e => {
              // The toolbar clips overflow, so the menu is positioned on screen next to the button
              const r = e.currentTarget.getBoundingClientRect();
              setExportMenu(m => m ? false : { top: r.bottom + 4, right: window.innerWidth - r.right });
            }} title="Export this layout as a PDF"
            style={{ height: 32, padding: '0 10px 0 12px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: `1px solid ${pdfAreaMode ? '#2563eb' : '#e5e7eb'}`, cursor: 'pointer', background: pdfAreaMode ? '#eff6ff' : '#f9fafb', color: '#374151', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⤓ Export PDF
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
          </button>
          {exportMenu && (
            <>
              <div onClick={() => setExportMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}/>
              <div style={{ position: 'fixed', top: exportMenu.top, right: exportMenu.right, zIndex: 1001, width: 220, padding: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.16)' }}>
                {[
                  ['Whole layout', 'Every item, fitted to the page', () => { setExportMenu(false); handleExportPdf(); }],
                  ['Select area…', 'Drag a box on the canvas', () => { setExportMenu(false); setCtxMenu(null); setPdfAreaMode(true); }],
                ].map(([label, hint, onClick]) => (
                  <button key={label} onClick={onClick}
                    style={{ display: 'block', width: '100%', padding: '7px 10px', border: 'none', borderRadius: 5, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{label}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{hint}</div>
                  </button>
                ))}
                <div style={{ height: 1, background: '#f3f4f6', margin: '4px 2px' }}/>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', borderRadius: 5, cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <input type="checkbox" checked={pdfSummary} style={{ marginTop: 2, accentColor: PRI }}
                    onChange={e => { const v = e.target.checked; setPdfSummary(v); try { localStorage.setItem('ams-layout-pdf-summary', v ? '1' : '0'); } catch {} }}/>
                  <span>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#111827' }}>Show status summary</span>
                    <span style={{ display: 'block', fontSize: 10, color: '#9ca3af', marginTop: 1 }}>Counts of Available, Sold, Registered… under the layout. Untick for customer copies.</span>
                  </span>
                </label>
              </div>
            </>
          )}
        </div>
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
                  const isRenaming = renamingLayoutId === l.id;
                  // Check if this layout has any placed inventory units
                  const layoutItems = l.id === activeLayoutId
                    ? items
                    : (layoutData[l.id]?.items || []);
                  const hasPlacedUnits = layoutItems.some(i => i.type === 'plot');
                  const canDelete = layouts.length > 1 && !hasPlacedUnits;
                  return (
                    <div key={l.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8,
                        background: isActive ? `${PRI}10` : 'transparent',
                        border: `1.5px solid ${isActive ? PRI + '40' : '#f3f4f6'}`,
                        transition: 'all 0.12s', width: '100%', boxSizing: 'border-box' }}>
                      {/* Layout icon — click to drill into layout */}
                      <div onClick={() => { if (!isRenaming) { handleSwitchLayout(l.id); setLeftView({ layoutId: l.id, layoutName: l.name }); } }}
                        style={{ width: 30, height: 30, borderRadius: 6, background: isActive ? PRI : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                        <svg width="14" height="14" fill="none" stroke={isActive ? '#fff' : '#9ca3af'} viewBox="0 0 24 24" strokeWidth={2}>
                          <rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>
                          <rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>
                        </svg>
                      </div>
                      {/* Name / rename input */}
                      <div onClick={() => { if (!isRenaming) { handleSwitchLayout(l.id); setLeftView({ layoutId: l.id, layoutName: l.name }); } }}
                        style={{ flex: 1, minWidth: 0, cursor: isRenaming ? 'default' : 'pointer' }}>
                        {isRenaming ? (
                          <input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setRenamingLayoutId(null); }}
                            onBlur={handleConfirmRename}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                            style={{ width: '100%', fontSize: 12, fontWeight: 700, color: PRI, border: `1px solid ${PRI}50`, borderRadius: 4, padding: '2px 5px', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                          />
                        ) : (
                          <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? PRI : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                        )}
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>Layout {idx + 1}</div>
                      </div>
                      {/* Rename button */}
                      {canEdit && <button
                        onClick={e => { e.stopPropagation(); isRenaming ? handleConfirmRename() : handleStartRename(l.id, l.name); }}
                        title={isRenaming ? 'Save name' : 'Rename layout'}
                        style={{ flexShrink: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, background: isRenaming ? `${PRI}15` : 'transparent', cursor: 'pointer', padding: 0, transition: 'background 0.12s' }}
                        onMouseEnter={e => { if (!isRenaming) e.currentTarget.style.background = '#f3f4f6'; }}
                        onMouseLeave={e => { if (!isRenaming) e.currentTarget.style.background = 'transparent'; }}>
                        {isRenaming ? (
                          <svg width="11" height="11" fill="none" stroke={PRI} viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        ) : (
                          <svg width="11" height="11" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        )}
                      </button>}
                      {/* Delete button */}
                      {canDeleteLayout && <button
                        onClick={e => { e.stopPropagation(); if (canDelete) handleDeleteLayout(l.id); }}
                        title={layouts.length <= 1 ? 'Cannot delete the only layout' : hasPlacedUnits ? 'Remove all placed units from canvas first' : 'Delete layout'}
                        style={{ flexShrink: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, background: 'transparent', cursor: canDelete ? 'pointer' : 'not-allowed', padding: 0, opacity: canDelete ? 1 : 0.3, transition: 'all 0.12s' }}
                        onMouseEnter={e => { if (canDelete) e.currentTarget.style.background = '#fee2e2'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <svg width="11" height="11" fill="none" stroke={canDelete ? '#ef4444' : '#9ca3af'} viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Projects header with back */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0, position: 'relative' }}>
                <button onClick={() => { setLeftView('layouts'); setTypeFilterOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', color: '#6b7280', marginBottom: 6 }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6"/></svg>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>Back to Layouts</span>
                </button>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leftView?.layoutName}</div>
                {(() => {
                  const typeCounts = {};
                  (layoutProjects[currentLayoutId] || []).forEach(p => p.inventory.forEach(u => {
                    const t = u.type || 'PLOT'; typeCounts[t] = (typeCounts[t] || 0) + 1;
                  }));
                  const types = Object.keys(UNIT_TYPE_LABEL).filter(t => typeCounts[t]).concat(Object.keys(typeCounts).filter(t => !UNIT_TYPE_LABEL[t]));
                  const active = sidebarTypes.length > 0;
                  const toggleDraft = t => setTypeDraft(d => d.includes(t) ? d.filter(x => x !== t) : [...d, t]);
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>
                          Projects{active && <span style={{ color: PRI, fontWeight: 600 }}> · {sidebarTypes.map(t => UNIT_TYPE_LABEL[t] || t).join(', ')}</span>}
                        </span>
                        <button
                          onClick={() => { setTypeDraft(sidebarTypes); setTypeFilterOpen(o => !o); }}
                          disabled={types.length === 0}
                          title={types.length === 0 ? 'Add a project to filter its units' : 'Filter units by type'}
                          style={{ position: 'relative', flexShrink: 0, width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${active ? PRI : '#e5e7eb'}`, borderRadius: 5, background: active ? `${PRI}12` : '#fff', cursor: types.length ? 'pointer' : 'not-allowed', opacity: types.length ? 1 : 0.4, padding: 0 }}>
                          <svg width="12" height="12" fill="none" stroke={active ? PRI : '#6b7280'} viewBox="0 0 24 24" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5z"/>
                          </svg>
                          {active && <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 7, background: PRI, color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: '14px', textAlign: 'center' }}>{sidebarTypes.length}</span>}
                        </button>
                      </div>

                      {typeFilterOpen && (
                        <>
                          <div onClick={() => setTypeFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }}/>
                          <div style={{ position: 'absolute', top: 'calc(100% - 4px)', left: 8, right: 8, zIndex: 40, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Unit type</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
                              {types.map(t => (
                                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
                                  <input type="checkbox" checked={typeDraft.includes(t)} onChange={() => toggleDraft(t)} style={{ accentColor: PRI, margin: 0 }}/>
                                  <span style={{ flex: 1 }}>{UNIT_TYPE_LABEL[t] || t}</span>
                                  <span style={{ fontSize: 10, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{typeCounts[t]}</span>
                                </label>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => { setSidebarTypes([]); setTypeDraft([]); setTypeFilterOpen(false); }}
                                style={{ flex: 1, height: 28, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                Clear
                              </button>
                              <button onClick={() => { setSidebarTypes(typeDraft); setTypeFilterOpen(false); }}
                                style={{ flex: 1, height: 28, border: 'none', borderRadius: 6, background: PRI, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                Apply
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
              {/* Projects list */}
              {(() => {
                const currProjects = currentLayoutId ? (layoutProjects[currentLayoutId] || []) : [];
                if (currProjects.length === 0) {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="22" height="22" fill="none" stroke="#d1d5db" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/>
                        </svg>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>No projects yet</div>
                        <div style={{ fontSize: 11, color: '#d1d5db', lineHeight: 1.5 }}>Click <b style={{ color: '#9ca3af' }}>Add Project</b> in the<br/>toolbar to link a project</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    {currProjects.map(proj => {
                      const units = sidebarTypes.length ? proj.inventory.filter(u => sidebarTypes.includes(u.type || 'PLOT')) : proj.inventory;
                      return (
                      <div key={proj.id}>
                        {/* Project header */}
                        {(() => {
                          const hasPlaced = proj.inventory.some(u => placedIds.has(u.id));
                          return (
                            <div onClick={() => toggleProjectOpen(proj.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', userSelect: 'none' }}>
                              <svg width="12" height="12" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" strokeWidth={2.5}
                                style={{ transition: 'transform 0.15s', transform: proj.open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6"/>
                              </svg>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                              <span title={sidebarTypes.length ? `${units.length} of ${proj.inventory.length} units match the filter` : undefined}
                                style={{ fontSize: 10, color: sidebarTypes.length ? PRI : '#9ca3af', flexShrink: 0, background: sidebarTypes.length ? `${PRI}15` : '#e5e7eb', borderRadius: 8, padding: '1px 5px', marginRight: 2, fontVariantNumeric: 'tabular-nums' }}>
                                {sidebarTypes.length ? `${units.length}/${proj.inventory.length}` : proj.inventory.length}
                              </span>
                              {canEdit && <button
                                onClick={e => { e.stopPropagation(); if (!hasPlaced) handleRemoveProject(proj.id); }}
                                title={hasPlaced ? 'Remove placed units from canvas first' : 'Remove project from layout'}
                                style={{ flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, background: 'transparent', cursor: hasPlaced ? 'not-allowed' : 'pointer', opacity: hasPlaced ? 0.3 : 1, padding: 0, transition: 'all 0.12s' }}
                                onMouseEnter={e => { if (!hasPlaced) e.currentTarget.style.background = '#fee2e2'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                <svg width="11" height="11" fill="none" stroke={hasPlaced ? '#9ca3af' : '#ef4444'} viewBox="0 0 24 24" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                              </button>}
                            </div>
                          );
                        })()}
                        {/* Inventory items */}
                        {proj.open && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '5px 6px', background: '#fff' }}>
                            {proj.inventory.length === 0 && (
                              <div style={{ padding: '10px 8px', fontSize: 10, color: '#d1d5db', textAlign: 'center' }}>No inventory in this project</div>
                            )}
                            {proj.inventory.length > 0 && units.length === 0 && (
                              <div style={{ padding: '10px 8px', fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>No units of the selected type</div>
                            )}
                            {units.map(unit => {
                              const isPlaced = placedIds.has(unit.id);
                              const sc = effectiveSC[unit.status] || DC;
                              return (
                                <div key={unit.id}
                                  draggable={!isPlaced && canEdit && !locked}
                                  onDragStart={e => onSidebarDragStart(e, unit.id)}
                                  title={isPlaced ? `${unitListLabel(unit)} — already placed on canvas` : `${unitListLabel(unit)} — drag to canvas`}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 5, background: isPlaced ? '#f9fafb' : sc.bg, border: `1px solid ${isPlaced ? '#f3f4f6' : sc.bd + '60'}`, cursor: isPlaced ? 'default' : canEdit && !locked ? 'grab' : 'default', opacity: isPlaced ? 0.45 : 1, transition: 'opacity 0.12s' }}>
                                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc.bd, flexShrink: 0 }}/>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: isPlaced ? '#9ca3af' : sc.tx, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {unitListLabel(unit)}
                                  </span>
                                  {isPlaced && (
                                    <svg width="10" height="10" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                    </svg>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}

        </div>

        {/* ── Canvas viewport — overflow hidden, pan+zoom via transform ── */}
        <div
          ref={canvasRef}
          style={{ flex: 1, overflow: 'hidden', cursor: canvasCursor, userSelect: 'none', position: 'relative', isolation: 'isolate', backgroundColor: '#c8cdd8', backgroundImage: 'radial-gradient(circle, #a0a5b0 1px, transparent 1px)', backgroundSize: `${gSize}px ${gSize}px`, backgroundPosition: `${bgPosX}px ${bgPosY}px` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}
          onContextMenu={e => {
            e.preventDefault();
            const itemEl = e.target.closest('[data-item]');
            if (!itemEl || locked || !canEdit) { setCtxMenu(null); return; }
            const id = itemEl.dataset.item;
            if (!multiSelRef.current.has(id)) {
              const only = new Set([id]);
              multiSelRef.current = only; setMultiSel(only); setSelected(id);
            }
            const r = canvasRef.current.getBoundingClientRect();
            setCtxMenu({ x: Math.min(e.clientX - r.left, r.width - 230), y: Math.min(e.clientY - r.top, r.height - 250) });
          }}
          onWheel={() => { if (ctxMenu) setCtxMenu(null); }}
          // The canvas captures the pointer during clicks, so double-clicks land here rather than on the item:
          // find the item under the cursor. Plots rotate (all selected plots if it is in a group); roads/gardens/text get renamed.
          onDoubleClick={e => {
            const itemEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-item]');
            if (!itemEl || locked || !canEdit || pdfAreaMode) return;
            const it = itemsRef.current.find(i => i.id === itemEl.dataset.item);
            if (!it || it.item_locked) return;
            if (it.type === 'plot' || it.type === 'custom') {
              const sel = multiSelRef.current;
              rotatePlots(sel.size > 1 && sel.has(it.id) ? new Set(sel) : new Set([it.id]));
            } else if (it.type === 'road' || it.type === 'open' || it.type === 'text') {
              setEditLabel({ id: it.id, value: it.label || '' });
            }
          }}>

          {/* Auto-save status badge */}
          {autoSave && autoSaveStatus !== 'idle' && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 30, pointerEvents: 'none',
              background: autoSaveStatus === 'saved' ? '#dcfce7' : '#eff6ff',
              border: `1px solid ${autoSaveStatus === 'saved' ? '#86efac' : '#bfdbfe'}`,
              color: autoSaveStatus === 'saved' ? '#15803d' : '#2563eb',
              borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
              {autoSaveStatus === 'saving' ? <>⟳ Auto saving…</> : <>✓ Auto saved</>}
            </div>
          )}

          {pdfAreaMode && (
            <div onPointerDown={e => e.stopPropagation()}
              style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 32, display: 'flex', alignItems: 'center', gap: 10,
                background: '#1e3a8a', color: '#fff', borderRadius: 8, padding: '7px 8px 7px 14px', fontSize: 12, fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
              <span>Drag a box over the area to export as PDF</span>
              <button onClick={() => { setPdfAreaMode(false); setPdfRect(null); }}
                style={{ height: 24, padding: '0 10px', borderRadius: 5, border: '1px solid #93c5fd', background: 'transparent', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Cancel (Esc)
              </button>
            </div>
          )}

          {/* Right-click menu: layer order (like Figma / Canva), lock and delete */}
          {ctxMenu && (() => {
            const selItems = items.filter(i => multiSel.has(i.id));
            const allLocked = selItems.length > 0 && selItems.every(i => i.item_locked);
            const deletable = selItems.some(i => !i.item_locked);
            const run = fn => () => { fn(); setCtxMenu(null); };
            const Row = ({ label, keys, onClick, danger, disabled }) => (
              <button onClick={disabled ? undefined : onClick} disabled={disabled}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, width: '100%', padding: '6px 10px', border: 'none', borderRadius: 5, background: 'transparent', cursor: disabled ? 'default' : 'pointer', fontSize: 12, color: disabled ? '#d1d5db' : danger ? '#dc2626' : '#111827', textAlign: 'left' }}
                onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = danger ? '#fef2f2' : '#f3f4f6'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <span>{label}</span>
                {keys && <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'ui-monospace, monospace' }}>{keys}</span>}
              </button>
            );
            const Hr = () => <div style={{ height: 1, background: '#f3f4f6', margin: '4px 2px' }}/>;
            return (
              <>
                <div onPointerDown={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null); }}
                  style={{ position: 'absolute', inset: 0, zIndex: 999 }}/>
                <div onPointerDown={e => e.stopPropagation()}
                  style={{ position: 'absolute', left: ctxMenu.x, top: ctxMenu.y, zIndex: 1000, width: 220, padding: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.16)' }}>
                  <div style={{ padding: '4px 10px 6px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {selItems.length > 1 ? `${selItems.length} items` : 'Arrange'}
                  </div>
                  <Row label="Bring to Front" keys="Ctrl+Shift+]" onClick={run(() => reorderSelection('front'))}/>
                  <Row label="Bring Forward"  keys="Ctrl+]"       onClick={run(() => reorderSelection('forward'))}/>
                  <Row label="Send Backward"  keys="Ctrl+["       onClick={run(() => reorderSelection('backward'))}/>
                  <Row label="Send to Back"   keys="Ctrl+Shift+[" onClick={run(() => reorderSelection('back'))}/>
                  <Hr/>
                  <Row label={allLocked ? 'Unlock' : 'Lock position'} onClick={run(() => {
                    const ids = new Set(selItems.map(i => i.id));
                    setItems(prev => prev.map(i => ids.has(i.id) ? { ...i, item_locked: !allLocked } : i));
                  })}/>
                  <Row label="Delete" keys="Del" danger disabled={!deletable} onClick={run(() => {
                    pushHistory();
                    const ids = new Set(selItems.map(i => i.id));
                    setItems(prev => prev.filter(i => !ids.has(i.id) || i.item_locked));
                    setSelected(null); setMultiSel(new Set());
                  })}/>
                </div>
              </>
            );
          })()}

          {/* Live size next to the cursor while dragging a resize handle */}
          {resizeInfo && (
            <div style={{ position: 'absolute', left: resizeInfo.cx + 18, top: resizeInfo.cy + 18, zIndex: 30, pointerEvents: 'none',
              background: '#111827e6', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600, lineHeight: 1.35,
              whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
              <div>W {Math.round(resizeInfo.w)} &nbsp;H {Math.round(resizeInfo.h)}</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: resizeInfo.fine ? '#86efac' : '#9ca3af' }}>
                {resizeInfo.fine ? '1px precision' : 'Shift for 1px'}
              </div>
            </div>
          )}

          {(conflict || saveError) && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 31, maxWidth: 'calc(100% - 40px)',
              background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
              onPointerDown={e => e.stopPropagation()}>
              <span>{conflict ? 'This layout was changed in another tab or browser. Saving is paused so those changes are not overwritten.' : saveError}</span>
              {conflict ? (
                <button onClick={() => window.location.reload()}
                  style={{ height: 26, padding: '0 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#b91c1c', color: '#fff', whiteSpace: 'nowrap' }}>
                  Reload latest
                </button>
              ) : (
                <button onClick={() => setSaveError('')}
                  style={{ height: 26, padding: '0 8px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: '1px solid #fecaca', cursor: 'pointer', background: '#fff', color: '#b91c1c' }}>
                  Dismiss
                </button>
              )}
            </div>
          )}

          {/* Transformed canvas */}
          <div ref={innerRef} style={{
            position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}>

            {items.map((item, idx) => {
              if (item.item_hidden) return null;
              const isSel   = multiSel.has(item.id);
              const rot = item.rotation || 0;
              // Stacking follows the items order (Layers panel / Bring to Front etc.); selected items float above so their handles stay reachable
              const z = idx + 1 + (isSel ? Z_SELECTED : 0);
              const basePos = { position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h, transform: rot ? `rotate(${rot}deg)` : undefined, transformOrigin: 'center center', zIndex: z };

              if (item.type === 'plot') {
                const unit = unitFor(item.inventory_id);
                if (!unit) return null;
                const srch = searchPlot.trim().toLowerCase();
                const isHighlighted = srch.length > 0 && (
                  String(unit.plot_no || '').toLowerCase().includes(srch) ||
                  String(unit.sl_no   || '').toLowerCase().includes(srch)
                );
                const projMatch = filterProject === 'ALL' || unitProjectMap[unit.id] == filterProject;
                let statusMatch = true;
                if (filterStatus === 'AVAILABLE') statusMatch = unit.status === 'AVAILABLE';
                else if (filterStatus === 'RESERVED') statusMatch = unit.status === 'RESERVED';
                else if (filterStatus === 'SOLD') statusMatch = filterSubStatus === 'ALL' ? SOLD_STATUSES.includes(unit.status) : unit.status === filterSubStatus;
                const filterMatch = !filterActive || (projMatch && statusMatch);
                const dimmed = (srch.length > 0 && !isHighlighted) || !filterMatch;
                return (
                  <div key={item.id} data-item={item.id}
                    title={!locked && canEdit && !item.item_locked ? 'Double-click to rotate' : undefined}
                    style={{ ...basePos, touchAction: 'none', cursor: !locked && canEdit && !item.item_locked ? 'move' : 'default', zIndex: isHighlighted && !isSel ? z + Z_HIGHLIGHT : z, opacity: dimmed ? 0.2 : 1, filter: dimmed ? 'grayscale(1)' : 'none', transition: 'opacity 0.2s, filter 0.2s' }}>
                    <svg width={item.w} height={item.h} style={{ overflow: 'visible', display: 'block' }}>
                      <PlotContent item={item} unit={unit} isSel={isSel} hideFlags={hideFlags} viewMode={viewMode} isHighlighted={isHighlighted} palette={effectiveSC} highlightColor={searchColor}/>
                    </svg>
                    {item.id === startPin && <div style={{ position: 'absolute', top: 2, left: 2, background: '#059669', color: 'white', fontSize: 7, fontWeight: 900, padding: '1px 4px', borderRadius: 3, pointerEvents: 'none', lineHeight: 1.4 }}>START</div>}
                    {item.id === endPin   && <div style={{ position: 'absolute', bottom: 2, left: 2, background: '#ea580c', color: 'white', fontSize: 7, fontWeight: 900, padding: '1px 4px', borderRadius: 3, pointerEvents: 'none', lineHeight: 1.4 }}>END</div>}
                    {item.item_locked && !hideFlags.lockSymbol && <div style={{ position: 'absolute', bottom: 3, right: 4, fontSize: 9, lineHeight: 1, pointerEvents: 'none', opacity: 0.75 }}>🔒</div>}
                  </div>
                );
              }

              if (item.type === 'custom') {
                const srch = searchPlot.trim().toLowerCase();
                const isHighlighted = srch.length > 0 && String(item.label || '').toLowerCase().includes(srch);
                const dimmed = srch.length > 0 && !isHighlighted;
                return (
                  <div key={item.id} data-item={item.id}
                    title={!locked && canEdit && !item.item_locked ? 'Double-click to rotate' : undefined}
                    style={{ ...basePos, touchAction: 'none', cursor: !locked && canEdit && !item.item_locked ? 'move' : 'default', zIndex: isHighlighted && !isSel ? z + Z_HIGHLIGHT : z, opacity: dimmed ? 0.2 : 1, transition: 'opacity 0.2s' }}>
                    <svg width={item.w} height={item.h} style={{ overflow: 'visible', display: 'block' }}>
                      {isHighlighted && <rect x={-5} y={-5} width={item.w + 10} height={item.h + 10} fill="none" stroke={searchColor} strokeWidth="3" strokeDasharray="6 3" rx="6"/>}
                      <CustomPlotContent item={item} isSel={isSel} hideFlags={hideFlags}/>
                    </svg>
                    {item.id === startPin && <div style={{ position: 'absolute', top: 2, left: 2, background: '#059669', color: 'white', fontSize: 7, fontWeight: 900, padding: '1px 4px', borderRadius: 3, pointerEvents: 'none', lineHeight: 1.4 }}>START</div>}
                    {item.id === endPin   && <div style={{ position: 'absolute', bottom: 2, left: 2, background: '#ea580c', color: 'white', fontSize: 7, fontWeight: 900, padding: '1px 4px', borderRadius: 3, pointerEvents: 'none', lineHeight: 1.4 }}>END</div>}
                    {item.item_locked && !hideFlags.lockSymbol && <div style={{ position: 'absolute', bottom: 3, right: 4, fontSize: 9, lineHeight: 1, pointerEvents: 'none', opacity: 0.75 }}>🔒</div>}
                  </div>
                );
              }

              if (item.type === 'road') {
                return (
                  <div key={item.id} data-item={item.id}
                    onDoubleClick={e => { e.stopPropagation(); if (locked || !canEdit) return; setEditLabel({ id: item.id, value: item.label || '' }); }}
                    style={{ ...basePos, backgroundColor: ec.road.bg, border: `2px solid ${isSel ? PRI : ec.road.bd}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default', outline: isSel ? `2px solid ${PRI}` : 'none', outlineOffset: 2 }}>
                    {editLabel?.id === item.id
                      ? <input autoFocus value={editLabel.value} onChange={e => setEditLabel(p => ({ ...p, value: e.target.value }))} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditLabel(null); }} onClick={e => e.stopPropagation()} style={{ border: 'none', background: 'transparent', textAlign: 'center', fontSize: 11, fontWeight: 900, color: ec.road.tx, textTransform: 'uppercase', letterSpacing: '0.08em', width: '92%', outline: 'none' }}/>
                      : <span style={{ fontSize: 11, fontWeight: 900, color: ec.road.tx, textTransform: 'uppercase', letterSpacing: '0.08em', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 8px' }}>{item.label || '7.50 MT WIDE ROAD'}</span>
                    }
                    {isSel && !locked && canEdit && <ResizeHandles id={item.id} zoom={zoom} rotation={rot} w={item.w} h={item.h}/>}
                    {isSel && !locked && canEdit && <RotationHandle id={item.id} zoom={zoom}/>}
                  </div>
                );
              }

              if (item.type === 'open') {
                return (
                  <div key={item.id} data-item={item.id}
                    onDoubleClick={e => { e.stopPropagation(); if (locked || !canEdit) return; setEditLabel({ id: item.id, value: item.label || '' }); }}
                    style={{ ...basePos, backgroundColor: ec.garden.bg, border: `2px solid ${isSel ? PRI : ec.garden.bd}`, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default', outline: isSel ? `2px solid ${PRI}` : 'none', outlineOffset: 2 }}>
                    <span style={{ fontSize: Math.min(item.h / 3, 22), lineHeight: 1, pointerEvents: 'none' }}>🌿</span>
                    {editLabel?.id === item.id
                      ? <input autoFocus value={editLabel.value} onChange={e => setEditLabel(p => ({ ...p, value: e.target.value }))} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditLabel(null); }} onClick={e => e.stopPropagation()} style={{ border: 'none', background: 'transparent', textAlign: 'center', fontSize: 9, fontWeight: 700, color: ec.garden.tx, width: '90%', outline: 'none' }}/>
                      : <span style={{ fontSize: 9, fontWeight: 700, color: ec.garden.tx, textAlign: 'center', pointerEvents: 'none', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{item.label || 'Garden'}</span>
                    }
                    {isSel && !locked && canEdit && <ResizeHandles id={item.id} zoom={zoom} rotation={rot} w={item.w} h={item.h}/>}
                    {isSel && !locked && canEdit && <RotationHandle id={item.id} zoom={zoom}/>}
                  </div>
                );
              }
              if (item.type === 'text') {
                return (
                  <div key={item.id} data-item={item.id}
                    onDoubleClick={e => { e.stopPropagation(); if (locked || !canEdit) return; setEditLabel({ id: item.id, value: item.label || '' }); }}
                    style={{ ...basePos, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default', outline: isSel ? `2px solid ${PRI}` : 'none', outlineOffset: 2 }}>
                    {editLabel?.id === item.id
                      ? <input autoFocus value={editLabel.value} onChange={e => setEditLabel(p => ({ ...p, value: e.target.value }))} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditLabel(null); }} onClick={e => e.stopPropagation()} style={{ border: 'none', background: 'transparent', textAlign: 'center', fontSize: item.font_size || TEXT_FONT_DEFAULT, fontWeight: 700, color: ec.text, width: '92%', outline: 'none' }}/>
                      : <span style={{ fontSize: item.font_size || TEXT_FONT_DEFAULT, fontWeight: 700, color: ec.text, lineHeight: 1.2, textAlign: 'center', pointerEvents: 'none', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{item.label || 'Text Label'}</span>
                    }
                    {isSel && !locked && canEdit && <ResizeHandles id={item.id} zoom={zoom} rotation={rot} w={item.w} h={item.h}/>}
                    {isSel && !locked && canEdit && <RotationHandle id={item.id} zoom={zoom}/>}
                  </div>
                );
              }

              if (item.type === 'dotted') {
                return (
                  <div key={item.id} data-item={item.id}
                    style={{ ...basePos, display: 'flex', alignItems: 'center', touchAction: 'none', cursor: !locked && canEdit ? 'move' : 'default', outline: isSel ? `2px solid ${PRI}` : 'none', outlineOffset: 2 }}>
                    <svg width={item.w} height={item.h} style={{ display: 'block', overflow: 'visible' }}>
                      <line x1={0} y1={item.h / 2} x2={item.w} y2={item.h / 2} stroke={ec.dotted} strokeWidth="2" strokeDasharray="8 5"/>
                    </svg>
                    {isSel && !locked && canEdit && <ResizeHandles id={item.id} zoom={zoom} rotation={rot} w={item.w} h={item.h}/>}
                    {isSel && !locked && canEdit && <RotationHandle id={item.id} zoom={zoom}/>}
                  </div>
                );
              }

              return null;
            })}

            {/* Cumulative dimension indicator */}
            {selected && (() => {
              const sel = items.find(i => i.id === selected);
              const isPlotLike = i => i.type === 'plot' || i.type === 'custom';
              if (!sel || !isPlotLike(sel)) return null;
              const dimUnit = "'"; // front/back measurements are in feet (front_area_details often holds the area unit)
              // Custom plots: the width along a row is the top side, the length down a column is the left side
              const hDimVal = p => { if (p.type === 'custom') return parseFloat(isTriangle(p) ? p.bottom : p.top) || 0; const u = unitFor(p.inventory_id); const v = p.rotated ? parseFloat(u?.back_area) : parseFloat(u?.front_area); return isNaN(v) ? 0 : v; };
              const vDimVal = p => { if (p.type === 'custom') return parseFloat(p.left) || 0; const u = unitFor(p.inventory_id); const v = p.rotated ? parseFloat(u?.front_area) : parseFloat(u?.back_area); return isNaN(v) ? 0 : v; };
              const fmt = v => `${Number.isInteger(v) ? v : v.toFixed(2)}${dimUnit}`;

              const HBar = ({ x1, x2, barY, refY, color, label }) => {
                const mx = (x1 + x2) / 2, tw = label.length * 5.5 + 14;
                const below = barY > refY;
                return (<g>
                  <line x1={x1} y1={below ? refY : barY+7} x2={x1} y2={below ? barY-7 : refY} stroke={color} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                  <line x1={x2} y1={below ? refY : barY+7} x2={x2} y2={below ? barY-7 : refY} stroke={color} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                  <line x1={x1} y1={barY} x2={x2} y2={barY} stroke={color} strokeWidth="1.4"/>
                  <line x1={x1} y1={barY-6} x2={x1} y2={barY+6} stroke={color} strokeWidth="1.4"/>
                  <line x1={x2} y1={barY-6} x2={x2} y2={barY+6} stroke={color} strokeWidth="1.4"/>
                  <rect x={mx-tw/2} y={below ? barY+1 : barY-15} width={tw} height={14} rx="3" fill={color}/>
                  <text x={mx} y={below ? barY+11 : barY-5} textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="sans-serif">{label}</text>
                </g>);
              };
              const VBar = ({ y1, y2, barX, refX, color, label }) => {
                const my = (y1 + y2) / 2, tw = label.length * 5.5 + 14;
                const onLeft = barX < refX;
                const d1x = onLeft ? barX + 7 : refX, d2x = onLeft ? refX : barX - 7;
                const rot = onLeft ? -90 : 90;
                const lblY = my - 5;
                return (<g>
                  <line x1={d1x} y1={y1} x2={d2x} y2={y1} stroke={color} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                  <line x1={d1x} y1={y2} x2={d2x} y2={y2} stroke={color} strokeWidth="0.7" strokeDasharray="3 2" opacity="0.45"/>
                  <line x1={barX} y1={y1} x2={barX} y2={y2} stroke={color} strokeWidth="1.4"/>
                  <line x1={barX-6} y1={y1} x2={barX+6} y2={y1} stroke={color} strokeWidth="1.4"/>
                  <line x1={barX-6} y1={y2} x2={barX+6} y2={y2} stroke={color} strokeWidth="1.4"/>
                  <g transform={`rotate(${rot},${barX},${my})`}>
                    <rect x={barX-tw/2} y={my-15} width={tw} height={14} rx="3" fill={color}/>
                    <text x={barX} y={lblY} textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="sans-serif">{label}</text>
                  </g>
                </g>);
              };

              // Same row/column = overlaps the selected plot by at least half of the narrower plot,
              // so wider plots that sit across several neighbours still count
              const overlap = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
              const rowPlots = items.filter(i => isPlotLike(i) && !i.item_hidden && overlap(i.y, i.y + i.h, sel.y, sel.y + sel.h) >= 0.5 * Math.min(i.h, sel.h)).sort((a, b) => a.x - b.x);
              const colPlots = items.filter(i => isPlotLike(i) && !i.item_hidden && overlap(i.x, i.x + i.w, sel.x, sel.x + sel.w) >= 0.5 * Math.min(i.w, sel.w)).sort((a, b) => a.y - b.y);
              // Free space beside a chain of plots: distance to the nearest item directly next to it on that side
              const clearance = (side, chain) => {
                const minX = Math.min(...chain.map(p => p.x)), maxX = Math.max(...chain.map(p => p.x + p.w));
                const minY = Math.min(...chain.map(p => p.y)), maxY = Math.max(...chain.map(p => p.y + p.h));
                let best = Infinity;
                for (const o of items) {
                  if (o.item_hidden || chain.includes(o)) continue;
                  const d = side === 'below' ? (overlap(o.x, o.x + o.w, minX, maxX) > 0 ? o.y - maxY : -Infinity)
                          : side === 'above' ? (overlap(o.x, o.x + o.w, minX, maxX) > 0 ? minY - (o.y + o.h) : -Infinity)
                          : side === 'right' ? (overlap(o.y, o.y + o.h, minY, maxY) > 0 ? o.x - maxX : -Infinity)
                          :                    (overlap(o.y, o.y + o.h, minY, maxY) > 0 ? minX - (o.x + o.w) : -Infinity);
                  if (d > -2) best = Math.min(best, Math.max(0, d));
                }
                return best;
              };
              const sp = startPin ? items.find(i => i.id === startPin) : null;
              const ep = endPin   ? items.find(i => i.id === endPin)   : null;

              if (sp && ep && startPin !== selected && endPin !== selected) {
                // Measure along whichever line holds both pins; if both do, follow how the pins are laid out
                const inRow = rowPlots.includes(sp) && rowPlots.includes(ep);
                const inCol = colPlots.includes(sp) && colPlots.includes(ep);
                if (!inRow && !inCol) return null;
                const pinsVertical = Math.abs((sp.y + sp.h / 2) - (ep.y + ep.h / 2)) >= Math.abs((sp.x + sp.w / 2) - (ep.x + ep.w / 2));
                const isVert = inCol && (!inRow || pinsVertical);
                if (!isVert) {
                  const si = rowPlots.findIndex(i => i.id === startPin), ei = rowPlots.findIndex(i => i.id === endPin), xi = rowPlots.findIndex(i => i.id === selected);
                  if (si < 0 || ei < 0 || xi < 0) return null;
                  const [l, r] = si < ei ? [si, ei] : [ei, si];
                  if (xi <= l || xi >= r) return null;
                  // Bar sits outside the tallest plot in the chain so it never runs across a plot
                  const chainH = rowPlots.slice(l, r + 1);
                  const barBelow = clearance('below', chainH) >= clearance('above', chainH);
                  const refY = barBelow ? Math.max(...chainH.map(p => p.y + p.h)) : Math.min(...chainH.map(p => p.y));
                  const barY = barBelow ? refY + 26 : refY - 26;
                  const dL = rowPlots.slice(l, xi).reduce((s, p) => s + hDimVal(p), 0);
                  const dR = rowPlots.slice(xi + 1, r + 1).reduce((s, p) => s + hDimVal(p), 0);
                  if (!dL && !dR) return null;
                  const x1 = rowPlots[l].x, x2 = sel.x, x3 = sel.x + sel.w, x4 = rowPlots[r].x + rowPlots[r].w, sd = hDimVal(sel);
                  return (<svg key="cd" data-measure="1" style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none', overflow: 'visible', zIndex: Z_OVERLAY }}>
                    {dL > 0 && <HBar x1={x1} x2={x2} barY={barY} refY={refY} color="#059669" label={fmt(dL)}/>}
                    {sd > 0 && <HBar x1={x2} x2={x3} barY={barY} refY={refY} color={PRI}     label={fmt(sd)}/>}
                    {dR > 0 && <HBar x1={x3} x2={x4} barY={barY} refY={refY} color="#ea580c" label={fmt(dR)}/>}
                  </svg>);
                } else {
                  const si = colPlots.findIndex(i => i.id === startPin), ei = colPlots.findIndex(i => i.id === endPin), xi = colPlots.findIndex(i => i.id === selected);
                  if (si < 0 || ei < 0 || xi < 0) return null;
                  const [t, b] = si < ei ? [si, ei] : [ei, si];
                  if (xi <= t || xi >= b) return null;
                  // Bar sits outside the widest plot in the chain so it never runs across a plot
                  const chainV = colPlots.slice(t, b + 1);
                  const barLeft = clearance('left', chainV) > clearance('right', chainV);
                  const refX = barLeft ? Math.min(...chainV.map(p => p.x)) : Math.max(...chainV.map(p => p.x + p.w));
                  const barX = barLeft ? refX - 26 : refX + 26;
                  const dA = colPlots.slice(t, xi).reduce((s, p) => s + vDimVal(p), 0);
                  const dB = colPlots.slice(xi + 1, b + 1).reduce((s, p) => s + vDimVal(p), 0);
                  if (!dA && !dB) return null;
                  const y1 = colPlots[t].y, y2 = sel.y, y3 = sel.y + sel.h, y4 = colPlots[b].y + colPlots[b].h, sv = vDimVal(sel);
                  return (<svg key="cd" data-measure="1" style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none', overflow: 'visible', zIndex: Z_OVERLAY }}>
                    {dA > 0 && <VBar y1={y1} y2={y2} barX={barX} refX={refX} color="#059669" label={fmt(dA)}/>}
                    {sv > 0 && <VBar y1={y2} y2={y3} barX={barX} refX={refX} color={PRI}     label={fmt(sv)}/>}
                    {dB > 0 && <VBar y1={y3} y2={y4} barX={barX} refX={refX} color="#ea580c" label={fmt(dB)}/>}
                  </svg>);
                }
              }

              return null;
            })()}

            {drawPreview && drawPreview.w > 5 && drawPreview.h > 5 && (
              <div style={{ position: 'absolute', left: drawPreview.x, top: drawPreview.y, width: drawPreview.w, height: drawPreview.h, pointerEvents: 'none', zIndex: Z_OVERLAY, borderRadius: 4, backgroundColor: drawPreview.tool === 'road' ? '#bae6fd60' : '#bbf7d060', border: `2px dashed ${drawPreview.tool === 'road' ? '#0369a1' : '#15803d'}` }}/>
            )}
            {/* Area being selected for PDF export */}
            {pdfRect && pdfRect.w > 0 && pdfRect.h > 0 && (
              <div style={{ position: 'absolute', left: pdfRect.x, top: pdfRect.y, width: pdfRect.w, height: pdfRect.h, pointerEvents: 'none', zIndex: Z_OVERLAY,
                border: `${2 / zoom}px dashed #2563eb`, background: '#2563eb14', boxShadow: '0 0 0 100000px rgba(17,24,39,0.18)' }}/>
            )}
            {/* Rubber-band marquee selection rect */}
            {selectionRect && selectionRect.w > 4 && selectionRect.h > 4 && (
              <div style={{ position: 'absolute', left: selectionRect.x, top: selectionRect.y, width: selectionRect.w, height: selectionRect.h, pointerEvents: 'none', zIndex: Z_OVERLAY, border: `1.5px solid ${PRI}`, backgroundColor: `${PRI}18`, borderRadius: 3 }}/>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 280, background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {multiSel.size > 1 ? (
            /* ── Multi-select panel ── */
            <>
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Multi-Select</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: PRI, marginTop: 2 }}>{multiSel.size} items selected</div>
              </div>
              <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14, lineHeight: 1.6 }}>
                  Drag any selected item to move the group. Use arrow keys to nudge.
                </div>
                {canEdit && !locked && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Bulk Actions</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      <button
                        onClick={() => setItems(prev => prev.map(i => multiSel.has(i.id) ? { ...i, item_locked: true } : i))}
                        style={{ height: 30, border: '1px solid #f59e0b', borderRadius: 6, background: '#fef3c7', color: '#b45309', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        🔒 Lock All
                      </button>
                      <button
                        onClick={() => setItems(prev => prev.map(i => multiSel.has(i.id) ? { ...i, item_locked: false } : i))}
                        style={{ height: 30, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        🔓 Unlock All
                      </button>
                    </div>
                    <button
                      onClick={() => { pushHistory(); const ids = new Set(multiSel); setItems(prev => prev.filter(i => !ids.has(i.id) || i.item_locked)); setSelected(null); setMultiSel(new Set()); }}
                      style={{ width: '100%', height: 30, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                      Remove Selected ({multiSel.size})
                    </button>
                  </>
                )}
                <button onClick={() => { setSelected(null); setMultiSel(new Set()); }}
                  style={{ width: '100%', height: 28, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 5, color: '#9ca3af', fontSize: 11, cursor: 'pointer', marginTop: 10 }}>
                  Clear Selection
                </button>
              </div>
            </>
          ) : selItem ? (
            <>
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
                <PLabel>{selItem.type === 'custom' && isTriangle(selItem) ? 'Triangle Plot' : { plot: 'Plot', custom: 'Custom Plot', road: 'Road', open: 'Garden', text: 'Text', dotted: 'Dotted Line' }[selItem.type] || selItem.type}</PLabel>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, minHeight: 0 }}>
                {/* Individual item lock toggle */}
                {(selItem.type === 'plot' || selItem.type === 'custom') && canEdit && !locked && (
                  <button
                    onClick={() => setItems(prev => prev.map(i => i.id === selItem.id ? { ...i, item_locked: !i.item_locked } : i))}
                    style={{ width: '100%', height: 30, marginBottom: 10, border: `1px solid ${selItem.item_locked ? '#f59e0b' : '#e5e7eb'}`, borderRadius: 6, background: selItem.item_locked ? '#fef3c7' : '#f9fafb', color: selItem.item_locked ? '#b45309' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span>{selItem.item_locked ? '🔒' : '🔓'}</span>
                    <span>{selItem.item_locked ? 'Locked — click to unlock' : 'Lock Position'}</span>
                  </button>
                )}
                {/* Plot details from inventory (shown to everyone, including view-only users) */}
                {selItem.type === 'plot' && (() => {
                  const u = unitFor(selItem.inventory_id);
                  if (!u) return null;
                  const st = effectiveSC[u.status] || DC;
                  const rows = [
                    ['Front', fmtFt(u.front_area) || '—'],
                    ['Back',  fmtFt(u.back_area)  || '—'],
                    ['Area',  u.area ? `${Number(u.area).toFixed(2)} ${u.area_unit || ''}`.trim() : '—'],
                  ];
                  return (
                    <div style={{ marginBottom: 12, border: '1px solid #f3f4f6', borderRadius: 7, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', background: '#f9fafb' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{unitListLabel(u)}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: st.bg, color: st.tx, border: `1px solid ${st.bd}60`, whiteSpace: 'nowrap' }}>{st.lb || u.status}</span>
                      </div>
                      {rows.map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
                          <span style={{ color: '#9ca3af' }}>{k}</span>
                          <span style={{ color: '#111827', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {/* Custom plot: name and the four side measurements set its size */}
                {selItem.type === 'custom' && (() => {
                  const editable = !locked && canEdit && !selItem.item_locked;
                  const ro = editable ? {} : { background: '#f9fafb', color: '#6b7280' };
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <PLabel>Name</PLabel>
                      <input type="text" value={selItem.label || ''} readOnly={!editable} placeholder="Plot"
                        onFocus={() => { if (editable) pushHistory(); }}
                        onChange={e => { if (editable) setCustomField(selItem.id, 'label', e.target.value); }}
                        style={{ ...inp, marginBottom: 8, ...ro }}/>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {(isTriangle(selItem) ? [['Bottom', 'bottom'], ['Left', 'left'], ['Right', 'right']]
                          : [['Top', 'top'], ['Bottom', 'bottom'], ['Left', 'left'], ['Right', 'right']]).map(([lbl, key]) => (
                          <div key={key}>
                            <PLabel>{lbl} (ft)</PLabel>
                            <input type="number" min={0} step="any" value={selItem[key] ?? ''} readOnly={!editable}
                              onFocus={() => { if (editable) pushHistory(); }}
                              onChange={e => { if (editable) setCustomField(selItem.id, key, e.target.value); }}
                              style={{ ...inp, ...ro }}/>
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, minHeight: 13 }}>{fmtFt(selItem[key]) || '—'}</div>
                          </div>
                        ))}
                      </div>
                      {!customPlotGeometry(selItem).ok && (
                        <p role="alert" style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 5, padding: '5px 7px', margin: '6px 0 0', lineHeight: 1.45 }}>
                          {isTriangle(selItem)
                            ? <>These sides can&apos;t form a triangle: each side must be shorter than the other two added together. Shown as a right-angled triangle until corrected.</>
                            : <>These sides can&apos;t form a closed shape: each side must be shorter than the other three added together. Shown as a rectangle until corrected.</>}
                        </p>
                      )}
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '6px 0 0', lineHeight: 1.5 }}>
                        Enter feet like inventory: 42.6 = 42&apos;-6&quot;. The shape and size follow these measurements; the bottom side stays level.
                      </p>
                    </div>
                  );
                })()}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12, opacity: selItem.item_locked ? 0.45 : 1 }}>
                  {[['X','x'],['Y','y'],['W','w'],['H','h']].map(([lbl, key]) => {
                    // Plot size comes from its measurements (inventory, or the custom plot's sides) and must not be edited
                    const sized = (selItem.type === 'plot' || selItem.type === 'custom') && (key === 'w' || key === 'h');
                    const fixed = !!selItem.item_locked || locked || !canEdit || sized;
                    return (
                      <div key={key}>
                        <PLabel>{lbl}</PLabel>
                        <input type="number" step={snapG} value={selItem[key]} readOnly={fixed}
                          title={sized ? (selItem.type === 'plot' ? 'Plot size is set from the inventory measurements' : 'Size is set from the Top / Bottom / Left / Right measurements') : undefined}
                          onChange={e => { if (!locked && canEdit && !fixed) setItems(prev => prev.map(i => i.id === selItem.id ? { ...i, [key]: Number(e.target.value) } : i)); }}
                          style={{ ...inp, cursor: fixed ? 'not-allowed' : undefined, ...(fixed && !selItem.item_locked ? { background: '#f3f4f6', color: '#9ca3af' } : {}) }}/>
                      </div>
                    );
                  })}
                </div>
                {selItem.type !== 'plot' && selItem.type !== 'custom' && !locked && canEdit && !selItem.item_locked && (
                  <div style={{ marginBottom: 12 }}>
                    <PLabel>Rotation (°)</PLabel>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="range" min={0} max={359} value={selItem.rotation || 0}
                        onChange={e => setItems(prev => prev.map(i => i.id === selItem.id ? { ...i, rotation: Number(e.target.value) } : i))}
                        style={{ flex: 1, accentColor: PRI }}/>
                      <input type="number" min={0} max={359} value={selItem.rotation || 0}
                        onChange={e => { let v = Number(e.target.value) % 360; if (v < 0) v += 360; setItems(prev => prev.map(i => i.id === selItem.id ? { ...i, rotation: v } : i)); }}
                        style={{ ...inp, width: 56, flexShrink: 0 }}/>
                      <button onClick={() => setItems(prev => prev.map(i => i.id === selItem.id ? { ...i, rotation: 0 } : i))}
                        title="Reset rotation"
                        style={{ height: 28, width: 28, flexShrink: 0, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', fontSize: 14, color: '#6b7280' }}>↺</button>
                    </div>
                  </div>
                )}
                {(selItem.type === 'plot' || selItem.type === 'custom') && !locked && canEdit && !selItem.item_locked && (
                  <button onClick={() => rotateItem(selItem.id)}
                    style={{ width: '100%', height: 30, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, color: '#374151', fontSize: 12, cursor: 'pointer', marginBottom: 8, fontWeight: 500 }}>
                    ↺ Rotate
                  </button>
                )}
                {/* Start/End pins only mark plots for measuring (nothing is saved), so everyone can use them, on locked plots too */}
                {(selItem.type === 'plot' || selItem.type === 'custom') && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                      <button onClick={() => { if (startPin === selItem.id) { setStartPin(null); setEndPin(null); } else { setStartPin(selItem.id); setEndPin(null); } }}
                        style={{ height: 28, background: startPin === selItem.id ? '#dcfce7' : '#f9fafb', border: `1px solid ${startPin === selItem.id ? '#059669' : '#e5e7eb'}`, borderRadius: 5, color: startPin === selItem.id ? '#059669' : '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        ▶ Start
                      </button>
                      <button onClick={() => { if (endPin === selItem.id) { setEndPin(null); setStartPin(null); } else { setEndPin(selItem.id); } }}
                        style={{ height: 28, background: endPin === selItem.id ? '#fff7ed' : '#f9fafb', border: `1px solid ${endPin === selItem.id ? '#ea580c' : '#e5e7eb'}`, borderRadius: 5, color: endPin === selItem.id ? '#ea580c' : '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        End ◀
                      </button>
                    </div>
                  </>
                )}
                {(selItem.type === 'road' || selItem.type === 'open' || selItem.type === 'text') && (
                  <div style={{ marginBottom: 12 }}>
                    <PLabel>Label</PLabel>
                    <input type="text" value={selItem.label || ''} readOnly={locked || !canEdit}
                      onChange={e => { if (!locked && canEdit) setItems(prev => prev.map(i => i.id === selItem.id ? { ...i, label: e.target.value } : i)); }}
                      style={{ ...inp, ...(locked || !canEdit ? { background: '#f9fafb', color: '#6b7280' } : {}) }}/>
                  </div>
                )}
                {selItem.type === 'text' && (() => {
                  const size = selItem.font_size || TEXT_FONT_DEFAULT;
                  const editable = !locked && canEdit && !selItem.item_locked;
                  const stepBtn = { height: 28, width: 28, flexShrink: 0, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 5, cursor: editable ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, color: '#6b7280' };
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <PLabel>Font Size (px)</PLabel>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                        <button title="Smaller" disabled={!editable} style={stepBtn}
                          onClick={() => { pushHistory(); setTextFont(selItem.id, size - 1); }}>A−</button>
                        <input type="number" min={TEXT_FONT_MIN} max={TEXT_FONT_MAX} value={size} readOnly={!editable}
                          onFocus={() => { if (editable) pushHistory(); }}
                          onChange={e => { if (editable && e.target.value !== '') setTextFont(selItem.id, e.target.value); }}
                          style={{ ...inp, textAlign: 'center', ...(editable ? {} : { background: '#f9fafb', color: '#6b7280' }) }}/>
                        <button title="Larger" disabled={!editable} style={stepBtn}
                          onClick={() => { pushHistory(); setTextFont(selItem.id, size + 1); }}>A+</button>
                      </div>
                      {editable && (
                        <input type="range" min={8} max={96} value={Math.min(96, Math.max(8, size))}
                          onPointerDown={pushHistory}
                          onChange={e => setTextFont(selItem.id, e.target.value)}
                          style={{ width: '100%', accentColor: PRI }}/>
                      )}
                    </div>
                  );
                })()}
                {!locked && canEdit && !selItem.item_locked && (
                  <button onClick={() => { const sid = selItem.id; setItems(p => p.filter(i => i.id !== sid)); setSelected(null); setMultiSel(new Set()); }}
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
                {[['controls','Controls'],['filter','Filter'],['elements','Elements'],['layers','Layers']].map(([tab, label]) => {
                  const isActive = rightTab === tab;
                  const hiddenCount = items.filter(i => i.item_hidden).length;
                  const badge = tab === 'filter' ? Object.values(hideFlags).filter(Boolean).length
                    : tab === 'layers' ? hiddenCount
                    : 0;
                  const needsLayout = tab === 'filter' || tab === 'elements' || tab === 'layers';
                  const tabDisabled = needsLayout && !isLayoutSelected;
                  return (
                    <button key={tab} onClick={() => { if (!tabDisabled) setRightTab(tab); }}
                      title={tabDisabled ? 'Select a layout first' : ''}
                      style={{ flex: 1, height: 34, border: 'none', borderBottom: isActive ? `2px solid ${PRI}` : '2px solid transparent', background: 'transparent', color: isActive ? PRI : '#9ca3af', fontSize: 10, fontWeight: 700, cursor: tabDisabled ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'color 0.12s', position: 'relative', opacity: tabDisabled ? 0.35 : 1 }}>
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
                    <div><b style={{ color: '#6b7280' }}>Multi-Select</b> — Drag on empty canvas or Ctrl+Click</div>
                    <div><b style={{ color: '#6b7280' }}>Rotate Plot</b> — Double-click (rotates all selected)</div>
                    <div><b style={{ color: '#6b7280' }}>Move Group</b> — Drag any selected item</div>
                    <div><b style={{ color: '#6b7280' }}>Nudge</b> — Arrows 1px · Shift+Arrows 10px</div>
                    <div><b style={{ color: '#6b7280' }}>Resize</b> — Drag a handle · hold Shift for 1px</div>
                    <div><b style={{ color: '#6b7280' }}>Delete</b> — Select item(s), press Del</div>
                    <div><b style={{ color: '#6b7280' }}>Undo</b> — Ctrl+Z (up to 50 steps)</div>
                    <div><b style={{ color: '#6b7280' }}>Fit</b> — Fit button in toolbar or Shift+1</div>
                    <div><b style={{ color: '#6b7280' }}>Snap</b> — Step size, bottom-right of the status bar</div>
                  </div>
                </div>
              )}

              {/* Filter tab */}
              {rightTab === 'filter' && (
                <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>

                  {/* Status Filters */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Status Filters</div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Project</div>
                    <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                      style={{ width: '100%', height: 32, border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, color: '#374151', background: '#fff', padding: '0 8px', cursor: 'pointer', outline: 'none' }}>
                      <option value="ALL">All Projects</option>
                      {(currentLayoutId ? (layoutProjects[currentLayoutId] || []) : []).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Status</div>
                    <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setFilterSubStatus('ALL'); }}
                      style={{ width: '100%', height: 32, border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, color: '#374151', background: '#fff', padding: '0 8px', cursor: 'pointer', outline: 'none' }}>
                      <option value="ALL">All Status</option>
                      <option value="AVAILABLE">Available</option>
                      <option value="RESERVED">Reserved</option>
                      <option value="SOLD">Sold</option>
                    </select>
                  </div>

                  {filterStatus === 'SOLD' && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>Sold Type</div>
                      <select value={filterSubStatus} onChange={e => setFilterSubStatus(e.target.value)}
                        style={{ width: '100%', height: 32, border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, color: '#374151', background: '#fff', padding: '0 8px', cursor: 'pointer', outline: 'none' }}>
                        <option value="ALL">All Sold</option>
                        <option value="REGISTERED">Registered</option>
                        <option value="ATTORNEY">Attorney</option>
                        <option value="FULL_FINAL">Full &amp; Final</option>
                      </select>
                    </div>
                  )}

                  {filterActive && (
                    <button onClick={() => { setFilterProject('ALL'); setFilterStatus('ALL'); setFilterSubStatus('ALL'); }}
                      style={{ width: '100%', height: 28, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: 500, marginBottom: 14 }}>
                      Clear Filters
                    </button>
                  )}

                  <div style={{ height: 1, background: '#f3f4f6', margin: '14px 0' }}/>

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
                  {/* Individual plot locks */}
                  {canEdit && !locked && (() => {
                    const plotItems   = items.filter(i => (i.type === 'plot' || i.type === 'custom'));
                    const lockedCount = plotItems.filter(i => i.item_locked).length;
                    return (
                      <div style={{ marginTop: 18 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Individual Locks</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                          <span style={{ fontWeight: 700, color: lockedCount > 0 ? '#b45309' : '#9ca3af' }}>{lockedCount}</span> of {plotItems.length} plots locked
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <button onClick={() => setItems(prev => prev.map(i => (i.type === 'plot' || i.type === 'custom') ? { ...i, item_locked: true } : i))}
                            style={{ height: 30, border: '1px solid #f59e0b', borderRadius: 6, background: '#fef3c7', color: '#b45309', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                            🔒 Lock All
                          </button>
                          <button onClick={() => setItems(prev => prev.map(i => (i.type === 'plot' || i.type === 'custom') ? { ...i, item_locked: false } : i))}
                            style={{ height: 30, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                            🔓 Unlock All
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Elements tab */}
              {rightTab === 'elements' && !(canEdit && !locked) && (
                <div style={{ flex: 1, padding: 24, fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
                  {canEdit ? 'This layout is locked.' : 'You have view-only access to the Layout Builder.'}
                </div>
              )}
              {rightTab === 'elements' && canEdit && !locked && (
                <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Insert Element</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      ['text',   'Text Label',       '#6b7280', 'T'],
                      ['rect',   'Square / Rectangle','#22c55e', '▭'],
                      ['line',   'Line (Road)',        '#0369a1', '═'],
                      ['dotted', 'Dotted Line',        '#9ca3af', '┄'],
                      ['custom', 'Custom Plot',        '#6b7280', '▢'],
                      ['triangle', 'Triangle Plot',    '#6b7280', '△'],
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

              {/* Layers tab */}
              {rightTab === 'layers' && (
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {/* Header */}
                  <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {items.length} element{items.length !== 1 ? 's' : ''} — drag to reorder
                    </div>
                  </div>
                  {items.length === 0 && (
                    <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12, color: '#d1d5db' }}>No elements on canvas</div>
                  )}
                  {/* Layers list — reversed so topmost is at top */}
                  {[...items].reverse().map((item) => {
                    const isSel = selected === item.id;
                    const unit  = item.type === 'plot' ? unitFor(item.inventory_id) : null;
                    const sc    = unit ? (effectiveSC[unit.status] || DC) : DC;
                    const name  = item.type === 'plot'   ? (unit ? (unit.plot_no || unit.sl_no || `#${unit.id}`) : `Plot`)
                                : item.type === 'road'   ? (item.label || 'Road')
                                : item.type === 'open'   ? (item.label || 'Garden')
                                : item.type === 'text'   ? (item.label || 'Text')
                                : item.type === 'dotted' ? 'Dotted Line'
                                : item.type === 'custom' ? `${item.label || 'Plot'} (${isTriangle(item) ? 'triangle' : 'custom'})`
                                : item.type;
                    const isDragging = layerDragId === item.id;
                    return (
                      <div key={item.id}
                        draggable={canEdit}
                        onDragStart={e => { e.stopPropagation(); setLayerDragId(item.id); }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.stopPropagation(); handleLayerReorder(item.id); }}
                        onDragEnd={() => setLayerDragId(null)}
                        onClick={() => {
                          if (item.id === selected) { setSelected(null); setMultiSel(new Set()); }
                          else { setSelected(item.id); setMultiSel(new Set([item.id])); }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: '1px solid #f3f4f6', background: isSel ? `${PRI}0d` : isDragging ? '#f3f4f6' : 'transparent', cursor: 'pointer', opacity: item.item_hidden ? 0.4 : 1, transition: 'background 0.1s', userSelect: 'none' }}>
                        {/* Drag grip */}
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="#d1d5db" style={{ flexShrink: 0, cursor: 'grab' }}>
                          <circle cx="3" cy="3"  r="1.3"/><circle cx="7" cy="3"  r="1.3"/>
                          <circle cx="3" cy="7"  r="1.3"/><circle cx="7" cy="7"  r="1.3"/>
                          <circle cx="3" cy="11" r="1.3"/><circle cx="7" cy="11" r="1.3"/>
                        </svg>
                        {/* Type dot / icon */}
                        {item.type === 'plot' || item.type === 'custom' ? (
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: sc.bd, flexShrink: 0, border: `1px solid ${sc.bd}` }}/>
                        ) : item.type === 'road' ? (
                          <div style={{ width: 10, height: 5, borderRadius: 1, background: '#7dd3fc', flexShrink: 0 }}/>
                        ) : item.type === 'open' ? (
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#4ade80', flexShrink: 0 }}/>
                        ) : item.type === 'dotted' ? (
                          <div style={{ width: 10, height: 2, background: 'repeating-linear-gradient(90deg,#9ca3af 0,#9ca3af 3px,transparent 3px,transparent 6px)', flexShrink: 0 }}/>
                        ) : (
                          <span style={{ fontSize: 9, fontWeight: 900, color: '#9ca3af', flexShrink: 0, width: 10, textAlign: 'center' }}>T</span>
                        )}
                        {/* Name */}
                        <span style={{ flex: 1, fontSize: 11, fontWeight: isSel ? 700 : 400, color: isSel ? PRI : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        {/* Lock toggle */}
                        <button
                          onClick={e => { e.stopPropagation(); if (canEdit) setItems(prev => prev.map(i => i.id === item.id ? { ...i, item_locked: !i.item_locked } : i)); }}
                          disabled={!canEdit}
                          title={item.item_locked ? 'Unlock' : 'Lock position'}
                          style={{ flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, borderRadius: 3, opacity: item.item_locked ? 1 : 0.3 }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#f3f4f6'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = item.item_locked ? '1' : '0.3'; e.currentTarget.style.background = 'transparent'; }}>
                          <svg width="10" height="10" fill="none" stroke={item.item_locked ? '#b45309' : '#9ca3af'} viewBox="0 0 24 24" strokeWidth={2}>
                            <rect x="5" y="11" width="14" height="10" rx="2"/><path strokeLinecap="round" d="M8 11V7a4 4 0 018 0v4"/>
                          </svg>
                        </button>
                        {/* Visibility toggle */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleItemVisibility(item.id); }}
                          disabled={!canEdit}
                          title={item.item_hidden ? 'Show' : 'Hide'}
                          style={{ flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, borderRadius: 3, opacity: item.item_hidden ? 0.35 : 0.6 }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#f3f4f6'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = item.item_hidden ? '0.35' : '0.6'; e.currentTarget.style.background = 'transparent'; }}>
                          {item.item_hidden ? (
                            <svg width="11" height="11" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23" strokeWidth={2}/>
                            </svg>
                          ) : (
                            <svg width="11" height="11" fill="none" stroke="#6b7280" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
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
        {items.some(i => i.type === 'plot' && i.item_locked) && (
          <span style={{ color: '#b45309' }}>🔒 {items.filter(i => i.type === 'plot' && i.item_locked).length} locked</span>
        )}
        <div style={{ width: 1, height: 12, background: '#e5e7eb', flexShrink: 0 }}/>
        {Object.entries(effectiveSC).map(([key, c]) => (
          <label key={key} title={`Click to change ${c.lb} color`}
            style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.bd, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }}/>
            <span style={{ color: '#6b7280' }}>{c.lb}</span>
            <input type="color" value={statusColors[key] || SC[key].bd}
              onChange={e => {
                const nc = { ...statusColors, [key]: e.target.value };
                setStatusColors(nc);
                try { localStorage.setItem('ams-layout-sc', JSON.stringify(nc)); } catch {}
              }}
              style={{ width: 0, height: 0, opacity: 0, border: 0, padding: 0, overflow: 'hidden', display: 'block' }}/>
          </label>
        ))}
        <label title="Click to change search highlight color"
          style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, border: `2px dashed ${searchColor}`, background: 'transparent', flexShrink: 0 }}/>
          <span style={{ color: '#6b7280' }}>Search</span>
          <input type="color" value={searchColor}
            onChange={e => {
              setSearchColor(e.target.value);
              try { localStorage.setItem('ams-layout-search-color', e.target.value); } catch {}
            }}
            style={{ width: 0, height: 0, opacity: 0, border: 0, padding: 0, overflow: 'hidden', display: 'block' }}/>
        </label>
        {[['road','Road',ec.road.bd],['garden','Garden',ec.garden.bd],['dotted','Dotted',ec.dotted],['text','Text Label',ec.text]].map(([key, lb, cur]) => (
          <label key={key} title={`Click to change ${lb} color`}
            style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ width: 8, height: 8, borderRadius: key === 'dotted' ? 0 : 2, background: key === 'dotted' ? 'transparent' : cur, border: key === 'dotted' ? `2px dashed ${cur}` : key === 'text' ? `2px solid ${cur}` : '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }}/>
            <span style={{ color: '#6b7280' }}>{lb}</span>
            <input type="color" value={cur}
              onChange={e => {
                const nc = { ...elementColors, [key]: e.target.value };
                setElementColors(nc);
                try { localStorage.setItem('ams-layout-ec', JSON.stringify(nc)); } catch {}
              }}
              style={{ width: 0, height: 0, opacity: 0, border: 0, padding: 0, overflow: 'hidden', display: 'block' }}/>
          </label>
        ))}
        {locked && <span style={{ color: '#b45309', fontWeight: 600, flexShrink: 0 }}>● Locked</span>}
        <span style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {Math.round(zoom * 100)}% ·
          {/* Step for dragging and X/Y edits; 1px for fine moves, larger to line items up */}
          <label title="Snap: how far items move per step when dragging" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            Snap
            <select value={snapG} onChange={e => setSnapG(Number(e.target.value))}
              style={{ height: 18, fontSize: 10, color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', padding: '0 2px', cursor: 'pointer' }}>
              {[...new Set([1, 5, 10, 20, 50, snapG])].sort((a, b) => a - b).map(v => <option key={v} value={v}>{v}px</option>)}
            </select>
          </label>
        </span>
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

      {/* Add Project modal */}
      {showProjectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowProjectModal(false)}/>
          <div style={{ position: 'relative', background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 24, width: '100%', maxWidth: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>Add Project</h3>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>Select a project to link its inventory to this layout</p>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <svg width="14" height="14" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" strokeWidth="2"/><path strokeLinecap="round" strokeWidth="2" d="m21 21-4.35-4.35"/>
              </svg>
              <input placeholder="Search projects…" value={projectSearch} onChange={e => setProjectSearch(e.target.value)}
                style={{ width: '100%', height: 36, padding: '0 12px 0 32px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                autoFocus/>
            </div>
            {/* Project list */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
              {allProjectsLoading ? (
                <div style={{ padding: '28px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading projects…</div>
              ) : (() => {
                const search = projectSearch.trim().toLowerCase();
                const filtered = allProjects.filter(p => !search || (p.name || '').toLowerCase().includes(search));
                if (filtered.length === 0) return (
                  <div style={{ padding: '28px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No projects found</div>
                );
                return filtered.map(p => {
                  const inCurrent = (layoutProjects[currentLayoutId] || []).some(lp => lp.id === p.id);
                  const inOther   = !inCurrent ? (() => {
                    for (const [lid, projs] of Object.entries(layoutProjects)) {
                      if (lid !== currentLayoutId && projs.some(lp => lp.id === p.id)) {
                        return layouts.find(l => l.id === lid) || { name: 'another layout' };
                      }
                    }
                    return null;
                  })() : null;
                  const blocked = inCurrent || !!inOther;
                  return (
                    <button key={p.id} onClick={() => !blocked && handleSelectProject(p)} disabled={blocked}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${blocked ? '#f3f4f6' : '#e5e7eb'}`, borderRadius: 9, background: blocked ? '#fafafa' : '#fff', cursor: blocked ? 'default' : 'pointer', textAlign: 'left', transition: 'all 0.1s', opacity: blocked ? 0.55 : 1 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: blocked ? '#e5e7eb' : PRI, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                        {(p.name || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: blocked ? '#9ca3af' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        {inOther
                          ? <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 1 }}>Already in: {inOther.name}</div>
                          : p.location && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.location}</div>
                        }
                      </div>
                      {inCurrent && <span style={{ fontSize: 10, color: '#059669', fontWeight: 700, background: '#d1fae5', borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>Added</span>}
                      {inOther   && <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700, background: '#fef3c7', borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>In Use</span>}
                    </button>
                  );
                });
              })()}
            </div>
            <button onClick={() => setShowProjectModal(false)}
              style={{ marginTop: 16, height: 36, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              Cancel
            </button>
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
