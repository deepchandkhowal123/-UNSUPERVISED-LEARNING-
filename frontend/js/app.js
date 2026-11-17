/* NetworkTrace frontend core v2 — API client, auth, router, UI helpers,
   SVG icon system, chart helpers, upgraded graph canvas, notifications,
   saved searches, theme, watchlist, command palette, shortcuts. */
const NT = window.NT = {
  token: localStorage.getItem('nt_token'),
  user: JSON.parse(localStorage.getItem('nt_user') || 'null'),
  views: {},
  graphs: new Set(),
  ui: { sidebarCollapsed: localStorage.getItem('nt_sb') === '1' },
};

const API_BASE = ''; // same origin

// ---------- API client ----------
async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (NT.token) headers['Authorization'] = `Bearer ${NT.token}`;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  let res;
  try {
    res = await fetch(API_BASE + path, { ...opts, headers });
  } catch (e) {
    throw new Error('Network error — backend unreachable');
  }
  if (res.status === 401) { NT.logout(true); throw new Error('Session expired'); }
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
  if (!res.ok) throw new Error((data && data.detail) || `HTTP ${res.status}`);
  return data;
}
NT.api = api;

// ---------- SVG icon system (Lucide-style, stroke=currentColor) ----------
const _ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  net: '<circle cx="12" cy="12" r="2.4"/><circle cx="12" cy="4" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="19" r="2"/><line x1="12" y1="6" x2="12" y2="9.6"/><line x1="10.2" y1="13.6" x2="5.6" y2="17.4"/><line x1="13.8" y1="13.6" x2="18.4" y2="17.4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  intel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  chart: '<line x1="6" y1="20" x2="6" y2="16"/><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="3" y1="20" x2="21" y2="20"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  case: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
  report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 17l3-3 2 2 3-4"/>',
  audit: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12l2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  compare: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
  'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
  'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  'zoom-in': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
  'zoom-out': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  tag: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  gauge: '<path d="M12 21a9 9 0 1 1 9-9"/><polyline points="12 12 16 8"/>',
};
NT.svg = (name, size = 18) => {
  const inner = _ICONS[name] || _ICONS.grid;
  return `<svg class="ic-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
};
// Backward-compat: NT.icon returns SVG markup for known names.
NT.icon = (name) => NT.svg(name);

// ---------- UI helpers ----------
NT.toast = (msg, kind = 'info') => {
  const el = document.getElementById('toast');
  el.innerHTML = (kind === 'error' ? NT.svg('alert', 16) : kind === 'success' ? NT.svg('star', 16) : NT.svg('bell', 16)) + `<span>${NT.esc(msg)}</span>`;
  el.className = `toast ${kind}`;
  clearTimeout(NT._toastT);
  NT._toastT = setTimeout(() => el.classList.add('hidden'), 3200);
};
NT.esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
NT.riskPill = (score) => {
  const s = Math.round(score || 0);
  let k = 'low';
  if (s >= 75) k = 'critical';
  else if (s >= 55) k = 'high';
  else if (s >= 30) k = 'medium';
  return `<span class="pill ${k}">${s}</span>`;
};
NT.typeTag = (t) => `<span class="type-tag ${NT.esc(t)}">${NT.esc(t)}</span>`;
NT.money = (amt, cur) => {
  if (!amt) return '—';
  const v = Number(amt);
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M ${cur || ''}`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K ${cur || ''}`;
  return `${v.toFixed(0)} ${cur || ''}`.trim();
};
NT.loading = () => `<div class="loading"><div class="spinner"></div><p>Loading…</p></div>`;
NT.empty = (msg = 'No data', icon = 'database') =>
  `<div class="empty">${NT.svg(icon, 30)}<p>${NT.esc(msg)}</p></div>`;
NT.skeleton = (kind = 'rows', n = 6) => {
  if (kind === 'cards') {
    return `<div class="grid grid-4">${Array(n).fill('<div class="card skel skel-card"></div>').join('')}</div>`;
  }
  return `<div class="card">${Array(n).fill('<div class="skel skel-row"></div>').join('')}</div>`;
};
NT.sparkline = (values, opts = {}) => {
  const w = opts.w || 70, h = opts.h || 24, color = opts.color || 'var(--accent)';
  if (!values || values.length < 2) return '';
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
};

// ---------- Chart helpers (SVG, no deps) ----------
NT.donut = (data, opts = {}) => {
  const size = opts.size || 160, r = size / 2 - (opts.thick || 16), cx = size / 2, cy = size / 2;
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1;
  const C = 2 * Math.PI * r;
  let offset = 0;
  const segs = data.map(d => {
    const frac = (d.value || 0) / total;
    const len = frac * C;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${opts.thick || 16}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
    offset += len;
    return el;
  }).join('');
  const center = opts.centerValue || opts.centerLabel
    ? `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="donut-val">${opts.centerValue || ''}</text>
       <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="donut-lbl">${opts.centerLabel || ''}</text>` : '';
  const legend = opts.legend ? `<div class="chart-legend">${
    data.map(d => `<span class="lg"><i class="dot" style="background:${d.color}"></i>${NT.esc(d.label)} <em>${d.value}</em></span>`).join('')}</div>` : '';
  return `<div class="chart donut-chart"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${segs}${center}</svg>${legend}</div>`;
};

NT.barChart = (data, opts = {}) => {
  const w = opts.w || 460, h = opts.h || 180, pad = 28, gap = 6;
  const max = opts.max || Math.max(1, ...data.map(d => d.value || 0));
  const bw = (w - pad * 2 - gap * (data.length - 1)) / Math.max(1, data.length);
  const bars = data.map((d, i) => {
    const bh = ((d.value || 0) / max) * (h - pad * 2);
    const x = pad + i * (bw + gap), y = h - pad - bh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${d.color || 'var(--accent)'}"><title>${NT.esc(d.label)}: ${d.value}</title></rect>
      <text x="${(x + bw / 2).toFixed(1)}" y="${h - pad + 14}" text-anchor="middle" class="bar-lbl">${NT.esc((d.label || '').slice(0, 6))}</text>`;
  }).join('');
  return `<div class="chart"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--border)"/>${bars}</svg></div>`;
};

NT.lineChart = (series, opts = {}) => {
  const w = opts.w || 460, h = opts.h || 180, pad = 24;
  const all = series.flatMap(s => s.values || []);
  const min = opts.min != null ? opts.min : (Math.min(...all, 0));
  const max = opts.max != null ? opts.max : (Math.max(...all, 1));
  const span = (max - min) || 1;
  const n = Math.max(...series.map(s => (s.values || []).length), 2);
  const xAt = i => pad + (i / (n - 1)) * (w - pad * 2);
  const yAt = v => h - pad - ((v - min) / span) * (h - pad * 2);
  const paths = series.map(s => {
    const vals = s.values || [];
    const pts = vals.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
    const area = opts.fill !== false ? `<polygon points="${pad},${h - pad} ${pts} ${xAt(vals.length - 1).toFixed(1)},${h - pad}" fill="${s.color}" opacity="0.12"/>` : '';
    return `${area}<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
  }).join('');
  return `<div class="chart"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--border)"/>${paths}</svg></div>`;
};

NT.gauge = (value, opts = {}) => {
  const size = opts.size || 130, r = size / 2 - 10, cx = size / 2, cy = size / 2;
  const v = Math.max(0, Math.min(100, value || 0));
  const start = Math.PI, end = Math.PI + (v / 100) * Math.PI;
  const arc = (a0, a1) => {
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  let col = 'var(--green)';
  if (v >= 75) col = 'var(--red)';
  else if (v >= 55) col = 'var(--orange)';
  else if (v >= 30) col = 'var(--yellow)';
  return `<div class="chart gauge-chart"><svg width="${size}" height="${size / 2 + 24}" viewBox="0 0 ${size} ${size / 2 + 24}">
    <path d="${arc(start, end + 0.001)}" fill="none" stroke="var(--border-2)" stroke-width="10" stroke-linecap="round"/>
    <path d="${arc(start, end)}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round"/>
    <text x="${cx}" y="${cy + 8}" text-anchor="middle" class="gauge-val">${Math.round(v)}</text>
  </svg>${opts.label ? `<div class="gauge-lbl">${NT.esc(opts.label)}</div>` : ''}</div>`;
};

NT.table = (cols, rows, opts = {}) => {
  if (!rows || !rows.length) return NT.empty('No records');
  const head = cols.map(c => `<th${c.sortable ? ` data-sort="${c.key}" class="sortable"` : ''}>${NT.esc(c.label)}${c.sortable ? ' <span class="sort-hint">↕</span>' : ''}</th>`).join('');
  const body = rows.map(r => `<tr>${
    cols.map(c => {
      let v = typeof c.render === 'function' ? c.render(r) : r[c.key];
      return `<td class="${c.num ? 't-num' : ''}">${v == null ? '—' : v}</td>`;
    }).join('')
  }</tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
};

NT.card = (title, inner, extra = '') =>
  `<div class="card ${extra}">${title ? `<div class="card-title">${title}</div>` : ''}${inner}</div>`;

NT.statCard = (icon, label, value, delta = '', spark = '') => {
  const ic = icon && icon.indexOf('<svg') >= 0 ? icon : NT.svg(icon || 'chart', 20);
  return `<div class="card stat-card"><div class="ic">${ic}</div>
   <div class="stat-val">${value}</div><div class="stat-label">${NT.esc(label)}</div>
   ${delta ? `<div class="stat-delta">${delta}</div>` : ''}${spark || ''}</div>`;
};

// ---------- Router ----------
NT.NAV = [
  { id: 'overview', label: 'Overview', icon: 'grid', group: 'Intelligence' },
  { id: 'explorer', label: 'Network Explorer', icon: 'net', group: 'Intelligence' },
  { id: 'entities', label: 'Entity Intelligence', icon: 'users', group: 'Intelligence' },
  { id: 'intelligence', label: 'Entity Detail', icon: 'intel', group: 'Intelligence', hidden: true },
  { id: 'communities', label: 'Community Detection', icon: 'layers', group: 'Analysis' },
  { id: 'analytics', label: 'AI Analytics', icon: 'chart', group: 'Analysis' },
  { id: 'anomalies', label: 'Anomaly Detection', icon: 'alert', group: 'Analysis' },
  { id: 'temporal', label: 'Temporal Analysis', icon: 'clock', group: 'Analysis' },
  { id: 'geoint', label: 'GeoINT', icon: 'map', group: 'Analysis' },
  { id: 'compare', label: 'Compare Entities', icon: 'compare', group: 'Analysis' },
  { id: 'investigations', label: 'Investigations', icon: 'case', group: 'Case Files' },
  { id: 'evidence', label: 'Evidence', icon: 'doc', group: 'Case Files' },
  { id: 'watchlist', label: 'Watchlist', icon: 'star', group: 'Case Files' },
  { id: 'reports', label: 'Reports', icon: 'report', group: 'Case Files' },
  { id: 'audit', label: 'Audit Logs', icon: 'audit', group: 'System' },
  { id: 'settings', label: 'Settings', icon: 'settings', group: 'System' },
];

NT.go = (id, params = {}) => {
  const q = new URLSearchParams(params).toString();
  location.hash = `/${id}${q ? '?' + q : ''}`;
  // close mobile sidebar on navigation
  document.getElementById('app') && document.getElementById('app').classList.remove('mobile-open');
};

NT.currentRoute = () => {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const id = path || 'overview';
  const params = {};
  if (query) new URLSearchParams(query).forEach((v, k) => params[k] = v);
  return { id, params };
};

NT._renderGen = 0;
NT.render = async () => {
  const gen = ++NT._renderGen;
  NT.graphs.forEach(graph => graph.destroy());
  const { id, params } = NT.currentRoute();
  document.querySelectorAll('.nav-item').forEach(n => {
    const active = n.dataset.id === id;
    n.classList.toggle('active', active);
    if (active) n.setAttribute('aria-current', 'page');
    else n.removeAttribute('aria-current');
  });
  const navItem = NT.NAV.find(n => n.id === id);
  const crumbs = [{ label: 'NetworkTrace', id: 'overview' }];
  if (id !== 'overview') crumbs.push({ label: navItem ? navItem.label : id, id, params, current: true });
  NT.breadcrumb(crumbs);
  const view = NT.views[id];
  const root = document.getElementById('view');
  if (!view) { if (gen === NT._renderGen) root.innerHTML = NT.empty('Unknown view: ' + id, 'alert'); return; }
  if (gen === NT._renderGen) root.innerHTML = NT.loading();
  try {
    await view(root, params);
    if (gen !== NT._renderGen) return; // a newer render superseded this one
    NT.bindStars(root);
  } catch (e) {
    if (gen !== NT._renderGen) return; // stale render — don't overwrite the newer one
    root.innerHTML = `<div class="empty">${NT.svg('alert', 30)}<p>Error: ${NT.esc(e.message)}</p></div>`;
  }
  if (gen === NT._renderGen) root.scrollTop = 0;
};

// ---------- Shell rendering ----------
NT.renderShell = async () => {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  if (!NT.token) {
    app.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    NT.loadDemoAccounts();
    return;
  }
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  NT.theme.apply();
  NT.applySidebarState();
  // user box
  const ub = document.getElementById('user-box');
  const permLabel = NT.user.permissions.includes('admin') ? 'admin'
    : NT.user.permissions.includes('manage') ? 'manager'
    : NT.user.role;
  const initials = (NT.user.display_name || NT.user.username || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  ub.innerHTML = `<div class="avatar">${NT.esc(initials)}</div>
                  <div class="uinfo">
                    <div class="uname">${NT.esc(NT.user.display_name)}</div>
                    <div class="urole">${NT.esc(NT.user.role)} <span class="role-pill">${NT.esc(permLabel)}</span></div>
                  </div>`;
  // nav — grouped
  const nav = document.getElementById('nav');
  const visible = NT.NAV.filter(n => !n.hidden);
  const groups = [];
  visible.forEach(n => { if (!groups.includes(n.group)) groups.push(n.group); });
  nav.innerHTML = groups.map(g => {
    const items = visible.filter(n => n.group === g);
    return `<div class="nav-section">${NT.esc(g)}</div>` +
      items.map(n => `<button type="button" class="nav-item" data-id="${n.id}" title="${NT.esc(n.label)}"><span class="ic">${NT.svg(n.icon, 18)}</span><span class="nl">${NT.esc(n.label)}</span>${n.id === 'watchlist' ? '<span class="nav-badge">0</span>' : ''}</button>`).join('');
  }).join('');
  nav.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => NT.go(item.dataset.id));
  });
  NT.refreshWatchBadge();
  NT.refreshStatus();
  NT.notifications && NT.notifications.refresh();
  NT.render();
};

NT.applySidebarState = () => {
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.toggle('collapsed', NT.ui.sidebarCollapsed);
};
NT.toggleSidebar = () => {
  NT.ui.sidebarCollapsed = !NT.ui.sidebarCollapsed;
  localStorage.setItem('nt_sb', NT.ui.sidebarCollapsed ? '1' : '0');
  NT.applySidebarState();
};
NT.toggleMobileSidebar = () => {
  document.getElementById('app').classList.toggle('mobile-open');
};

NT.refreshStatus = async () => {
  const el = document.getElementById('data-status');
  if (!el) return;
  try {
    const s = await api('/api/system/status');
    el.innerHTML = `<span class="live-dot"></span>${s.entities} entities · ${s.relationships} rels`;
    el.classList.add('ok', 'live');
  } catch (e) {
    el.textContent = 'offline';
    el.classList.remove('ok', 'live');
  }
};

NT.loadDemoAccounts = async () => {
  try {
    const accs = await api('/api/auth/accounts');
    const grid = document.getElementById('demo-accounts');
    grid.innerHTML = accs.map(a =>
      `<div class="demo-chip" data-user="${a.username}"><strong>${NT.esc(a.role)}</strong><span>${NT.esc(a.display_name)}</span></div>`
    ).join('');
    grid.querySelectorAll('.demo-chip').forEach(c => {
      c.addEventListener('click', () => NT.login(c.dataset.user, c.dataset.user));
    });
  } catch (e) {
    document.getElementById('demo-accounts').innerHTML =
      `<div class="mute2" style="grid-column:1/-1">Backend not reachable. Start it with: uvicorn backend.main:app --port 8000</div>`;
  }
};

// ---------- Canvas graph renderer (force-directed + zoom/pan/drag/glow) ----------
NT.GraphCanvas = class {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this._events = new AbortController();
    this._destroyed = false;
    this.nodes = []; this.edges = [];
    this.pos = new Map();
    this.hover = null; this.selected = null; this.onSelect = null;
    this.scale = 1; this.ox = 0; this.oy = 0;
    this.labels = false;
    this._dragNode = null; this._panning = false; this._last = null;
    this.colors = { person: '#06b6d4', organization: '#a855f7', company: '#a855f7',
                    account: '#3b82f6', phone: '#22c55e', email: '#22c55e',
                    address: '#eab308', vehicle: '#f97316', asset: '#f97316', default: '#8b97b3' };
    NT.graphs.add(this);
    this._bind();
  }
  setData(nodes, edges) {
    this.nodes = nodes; this.edges = edges;
    const W = this.cv.width, H = this.cv.height;
    this.pos = new Map();
    nodes.forEach((n, i) => {
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      const r = Math.min(W, H) * 0.32;
      this.pos.set(n.id, { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r,
                           vx: 0, vy: 0, node: n });
    });
    this._tick = 0; this.scale = 1; this.ox = 0; this.oy = 0;
    if (!this._raf) this._loop();
  }
  _loop() {
    if (this._destroyed) return;
    this._step(); this._draw(); this._raf = requestAnimationFrame(() => this._loop());
  }
  _step() {
    this._tick++;
    const W = this.cv.width, H = this.cv.height;
    const k = 0.016, rep = 1400;
    const arr = [...this.pos.values()];
    if (this._dragNode) { /* skip moving the dragged node */ }
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].node.id === this._dragNode) continue;
      for (let j = i + 1; j < arr.length; j++) {
        let dx = arr[i].x - arr[j].x, dy = arr[i].y - arr[j].y;
        let d2 = dx * dx + dy * dy + 0.01;
        let f = rep / d2, d = Math.sqrt(d2);
        arr[i].vx += (dx / d) * f; arr[i].vy += (dy / d) * f;
        arr[j].vx -= (dx / d) * f; arr[j].vy -= (dy / d) * f;
      }
    }
    for (const e of this.edges) {
      const a = this.pos.get(e.source), b = this.pos.get(e.target);
      if (!a || !b) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      let f = (d - 80) * 0.02;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const p of arr) {
      p.vx += (W / 2 - p.x) * 0.002; p.vy += (H / 2 - p.y) * 0.002;
    }
    const damp = Math.max(0.6, 0.92 - this._tick * 0.0008);
    for (const p of arr) {
      if (p.node.id === this._dragNode) { p.vx = 0; p.vy = 0; continue; }
      p.vx *= damp; p.vy *= damp;
      p.x += p.vx * k * 10; p.y += p.vy * k * 10;
      p.x = Math.max(20, Math.min(W - 20, p.x));
      p.y = Math.max(20, Math.min(H - 20, p.y));
    }
  }
  _world(x, y) { return { x: (x - this.ox) / this.scale, y: (y - this.oy) / this.scale }; }
  _draw() {
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    const css = getComputedStyle(document.documentElement);
    const bg = css.getPropertyValue('--canvas-bg').trim() || '#0f1421';
    const edge = css.getPropertyValue('--canvas-edge').trim() || 'rgba(90,110,160,0.35)';
    const txt = css.getPropertyValue('--text').trim() || '#e6ecf5';
    const panel = css.getPropertyValue('--panel').trim() || '#141a28';
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(this.ox, this.oy); ctx.scale(this.scale, this.scale);
    // edges
    ctx.strokeStyle = edge; ctx.lineWidth = 1 / this.scale;
    for (const e of this.edges) {
      const a = this.pos.get(e.source), b = this.pos.get(e.target);
      if (!a || !b) continue;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // nodes
    for (const p of this.pos.values()) {
      const n = p.node;
      const risk = n.risk_score || 0;
      const r = 4 + Math.min(8, (n.degree || risk / 12));
      const col = this.colors[n.type] || this.colors.default;
      // glow on high-risk
      if (risk >= 70) { ctx.shadowColor = col; ctx.shadowBlur = 12; }
      else { ctx.shadowBlur = 0; }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (this.hover === n.id || this.selected === n.id) {
        ctx.strokeStyle = txt; ctx.lineWidth = 2 / this.scale;
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2); ctx.stroke();
      }
      if (this.labels) {
        ctx.font = `${11 / this.scale}px Inter, sans-serif`;
        ctx.fillStyle = txt;
        ctx.fillText(n.name, p.x + r + 3, p.y + 4);
      }
    }
    ctx.restore();
    // hover label (screen space)
    if (this.hover) {
      const p = this.pos.get(this.hover);
      const n = p && p.node;
      if (n) {
        const sx = p.x * this.scale + this.ox, sy = p.y * this.scale + this.oy;
        ctx.font = '11px Inter, sans-serif';
        const tw = ctx.measureText(n.name).width + 16;
        ctx.fillStyle = panel; ctx.fillRect(sx + 8, sy - 22, tw, 20);
        ctx.fillStyle = txt; ctx.fillText(n.name, sx + 16, sy - 8);
      }
    }
  }
  _hit(x, y) {
    const w = this._world(x, y);
    for (const p of this.pos.values()) {
      const dx = p.x - w.x, dy = p.y - w.y;
      const r = 4 + Math.min(8, (p.node.degree || (p.node.risk_score || 0) / 12)) + 3;
      if (dx * dx + dy * dy < r * r) return p.node.id;
    }
    return null;
  }
  _bind() {
    const cv = this.cv;
    const options = { signal: this._events.signal };
    const toLocal = (e) => {
      const rect = cv.getBoundingClientRect();
      return { x: (e.clientX - rect.left) * (cv.width / rect.width),
               y: (e.clientY - rect.top) * (cv.height / rect.height) };
    };
    cv.addEventListener('mousemove', (e) => {
      const { x, y } = toLocal(e);
      if (this._dragNode) {
        const w = this._world(x, y);
        const p = this.pos.get(this._dragNode);
        if (p) { p.x = w.x; p.y = w.y; }
        return;
      }
      if (this._panning && this._last) {
        this.ox += (x - this._last.x); this.oy += (y - this._last.y);
        this._last = { x, y }; return;
      }
      const found = this._hit(x, y);
      this.hover = found;
      cv.style.cursor = found ? 'pointer' : 'grab';
    }, options);
    cv.addEventListener('mousedown', (e) => {
      const { x, y } = toLocal(e);
      const found = this._hit(x, y);
      if (found) { this._dragNode = found; cv.style.cursor = 'grabbing'; }
      else { this._panning = true; this._last = { x, y }; cv.style.cursor = 'grabbing'; }
    }, options);
    window.addEventListener('mouseup', () => {
      if (this._dragNode && this.hover === this._dragNode && this.onSelect) {
        // treat as click if not moved much — handled in click
      }
      this._dragNode = null; this._panning = false; this._last = null;
    }, options);
    cv.addEventListener('click', (e) => {
      const { x, y } = toLocal(e);
      const found = this._hit(x, y);
      if (found && this.onSelect) this.onSelect(found);
    }, options);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const { x, y } = toLocal(e);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale = Math.max(0.3, Math.min(3, this.scale * factor));
      // zoom around cursor
      this.ox = x - (x - this.ox) * (newScale / this.scale);
      this.oy = y - (y - this.oy) * (newScale / this.scale);
      this.scale = newScale;
    }, { passive: false, signal: this._events.signal });
    window.addEventListener('resize', () => this.resize(), options);
  }
  zoomBy(f) { this.scale = Math.max(0.3, Math.min(3, this.scale * f)); }
  resetView() { this.scale = 1; this.ox = 0; this.oy = 0; }
  toggleLabels() { this.labels = !this.labels; }
  resize() {
    const rect = this.cv.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const xRatio = width / this.cv.width;
    const yRatio = height / this.cv.height;
    if (width === this.cv.width && height === this.cv.height) return;
    this.cv.width = width;
    this.cv.height = height;
    this.pos.forEach(point => {
      point.x *= xRatio; point.y *= yRatio;
      point.vx *= xRatio; point.vy *= yRatio;
    });
    this._draw();
  }
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    this._events.abort();
    NT.graphs.delete(this);
  }
};

// ---------- Theme manager (dark / light / auto) ----------
NT.theme = {
  order: ['dark', 'light', 'auto'],
  current() { return localStorage.getItem('nt_theme') || 'auto'; },
  resolved() {
    const t = this.current();
    if (t === 'auto') {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    return t;
  },
  apply() {
    document.documentElement.setAttribute('data-theme', this.resolved());
    const btn = document.getElementById('theme-btn');
    const map = { dark: 'moon', light: 'sun', auto: 'monitor' };
    if (btn) btn.innerHTML = NT.svg(map[this.current()], 18);
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', this.resolved() === 'light' ? '#fafbfc' : '#0a0b0e');
  },
  cycle() {
    const cur = this.current();
    const nxt = this.order[(this.order.indexOf(cur) + 1) % this.order.length];
    localStorage.setItem('nt_theme', nxt);
    this.apply();
    NT.toast('Theme: ' + nxt, 'info');
  },
  set(t) { localStorage.setItem('nt_theme', t); this.apply(); }
};
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (NT.theme.current() === 'auto') NT.theme.apply();
  });
}

// ---------- Watchlist (localStorage bookmarks) ----------
NT.watchlist = {
  key: 'nt_watchlist',
  all() { try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch (e) { return []; } },
  save(list) { localStorage.setItem(this.key, JSON.stringify(list)); },
  has(id) { return this.all().some(e => e.id === id); },
  toggle(entity) {
    const list = this.all();
    const i = list.findIndex(e => e.id === entity.id);
    if (i >= 0) { list.splice(i, 1); this.save(list); return false; }
    list.unshift({ id: entity.id, name: entity.name, type: entity.type,
                   risk_score: entity.risk_score, country: entity.country,
                   added_at: new Date().toISOString() });
    this.save(list); return true;
  },
  remove(id) { this.save(this.all().filter(e => e.id !== id)); },
  count() { return this.all().length; },
};
NT.starHTML = (entity) => {
  const on = NT.watchlist.has(entity.id);
  return `<span class="star ${on ? 'on' : ''}" data-star="${NT.esc(entity.id)}" title="Watchlist">${NT.svg('star', 15)}</span>`;
};
NT.bindStars = (root) => {
  root.querySelectorAll('.star[data-star]').forEach(s => {
    s.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = s.getAttribute('data-star');
      try {
        const ent = await NT.api('/api/entities/' + id);
        const added = NT.watchlist.toggle(ent);
        s.classList.toggle('on', added);
        NT.toast(added ? 'Added to watchlist' : 'Removed from watchlist', added ? 'success' : 'info');
        NT.refreshWatchBadge();
      } catch (err) { NT.toast(err.message, 'error'); }
    });
  });
};
NT.refreshWatchBadge = () => {
  const n = NT.watchlist.count();
  const item = document.querySelector('.nav-item[data-id="watchlist"] .nav-badge');
  if (item) item.textContent = n;
};

// ---------- Breadcrumb ----------
NT.breadcrumb = (parts) => {
  const el = document.getElementById('breadcrumb');
  if (!el) return;
  el.innerHTML = parts.map((p, i) => {
    const last = i === parts.length - 1;
    if (last) return `<span class="crumb current">${NT.esc(p.label)}</span>`;
    return `<span class="crumb" onclick="NT.go('${p.id}', ${JSON.stringify(p.params || {}).replace(/"/g, '&quot;')})">${NT.esc(p.label)}</span><span class="sep">/</span>`;
  }).join('');
};

// ---------- Notifications panel (high-risk entities + recent audit) ----------
NT.notifications = {
  state: { items: [], open: false, criticalTotal: 0 },
  async refresh() {
    const bell = document.getElementById('notif-btn');
    if (!bell) return;
    try {
      const [hr, audit] = await Promise.all([
        NT.api('/api/entities?min_risk=75&size=8&sort=risk_score&order=desc'),
        NT.api('/api/system/audit?limit=5'),
      ]);
      this.state.high = (hr.items || []);
      this.state.criticalTotal = Number(hr.total) || this.state.high.length;
      this.state.audit = (audit.items || []);
      const badge = document.getElementById('notif-badge');
      if (badge) {
        badge.textContent = this.state.criticalTotal > 99 ? '99+' : String(this.state.criticalTotal);
        badge.dataset.zero = this.state.criticalTotal ? '0' : '1';
      }
      bell.setAttribute('aria-label', `Notifications, ${this.state.criticalTotal} critical-risk entities scoring 75 or higher`);
      this.render();
    } catch (e) { /* ignore */ }
  },
  render() {
    const box = document.getElementById('notif-panel');
    if (!box) return;
    const hr = (this.state.high || []).map(e =>
      `<div class="notif-item" onclick="NT.go('intelligence',{id:'${e.id}'})">
         <span class="feed-dot" style="background:var(--red)"></span>
         <div class="feed-body"><strong>${NT.esc(e.name)}</strong> ${NT.typeTag(e.type)} ${NT.riskPill(e.risk_score)}</div></div>`).join('');
    const au = (this.state.audit || []).map(a =>
      `<div class="notif-item minor"><span class="feed-dot" style="background:var(--accent)"></span>
         <div class="feed-body">${NT.esc(a.action)} <span class="feed-time">${NT.esc((a.ts || '').slice(0, 19).replace('T', ' '))}</span></div></div>`).join('');
    box.innerHTML = `<div class="notif-head">Critical-risk entities (75+) · ${this.state.criticalTotal}</div>
      ${hr || '<div class="notif-empty">No critical-risk entities</div>'}
      <div class="notif-head" style="margin-top:8px">Recent activity</div>
      ${au || '<div class="notif-empty">No recent activity</div>'}`;
  },
  toggle() {
    const box = document.getElementById('notif-panel');
    this.state.open = !this.state.open;
    box.classList.toggle('open', this.state.open);
  },
};

// ---------- Saved searches (server-backed) ----------
NT.savedSearches = {
  async list() { return (await NT.api('/api/system/saved-searches')).items || []; },
  async save(name, query, filters) {
    return NT.api('/api/system/saved-searches', { method: 'POST', body: { name, query, filters } });
  },
  async remove(id) { return NT.api('/api/system/saved-searches/' + id, { method: 'DELETE' }); },
};

// ---------- Command palette (Ctrl+K) ----------
NT.palette = {
  state: { items: [], active: 0, query: '' },
  open() {
    document.getElementById('palette').classList.remove('hidden');
    const inp = document.getElementById('palette-input');
    inp.value = ''; inp.focus();
    this.state.query = '';
    this.build();
  },
  close() { document.getElementById('palette').classList.add('hidden'); },
  async build() {
    const q = this.state.query.toLowerCase().trim();
    let items = NT.NAV.filter(n => !n.hidden).map(n => ({
      kind: 'view', label: n.label, ic: NT.svg(n.icon, 16), hint: n.group, action: () => NT.go(n.id)
    }));
    items.push({ kind: 'action', label: 'Toggle theme (dark/light/auto)', ic: NT.svg('moon', 16), hint: 'theme', action: () => NT.theme.cycle() });
    items.push({ kind: 'action', label: 'Collapse / expand sidebar', ic: NT.svg('menu', 16), hint: 'layout', action: () => NT.toggleSidebar() });
    items.push({ kind: 'action', label: 'Keyboard shortcuts', ic: NT.svg('grid', 16), hint: 'help', action: () => NT.openShortcuts() });
    items.push({ kind: 'action', label: 'Sign out', ic: NT.svg('logout', 16), hint: 'auth', action: () => NT.logout() });
    if (q) {
      const viewMatch = items.filter(i => i.label.toLowerCase().includes(q));
      let entityItems = [];
      try {
        const res = await NT.api('/api/search?q=' + encodeURIComponent(q) + '&size=8');
        entityItems = (res.entities || []).map(e => ({
          kind: 'entity', label: e.name, ic: NT.svg('intel', 16), hint: `${e.id} · ${e.type}`,
          action: () => NT.go('intelligence', { id: e.id })
        }));
      } catch (e) {}
      items = [...viewMatch, ...entityItems];
      if (!items.length) items = [{ kind: 'none', label: 'No matches', ic: NT.svg('x', 16), hint: '', action: () => {} }];
    }
    this.state.items = items;
    this.state.active = Math.min(this.state.active, items.length - 1);
    this.render();
  },
  render() {
    const box = document.getElementById('palette-results');
    box.innerHTML = this.state.items.map((it, i) =>
      `<div class="pal-item ${i === this.state.active ? 'active' : ''}" data-idx="${i}">
        <span class="pal-ic">${it.ic}</span>
        <span class="pal-label">${NT.esc(it.label)}</span>
        <span class="pal-hint">${NT.esc(it.hint)}</span></div>`).join('');
    box.querySelectorAll('.pal-item').forEach(el => {
      el.addEventListener('click', () => this.activate(+el.getAttribute('data-idx')));
      el.addEventListener('mouseenter', () => { this.state.active = +el.getAttribute('data-idx'); this.render(); });
    });
  },
  move(dir) {
    const n = this.state.items.length;
    if (!n) return;
    this.state.active = (this.state.active + dir + n) % n;
    this.render();
    const el = document.querySelector(`.pal-item[data-idx="${this.state.active}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  },
  activate(i) {
    const it = this.state.items[i ?? this.state.active];
    if (!it) return;
    this.close();
    it.action();
  },
};
NT.openShortcuts = () => document.getElementById('shortcuts-modal').classList.remove('hidden');

// ---------- Keyboard shortcuts ----------
NT.shortcuts = {
  _g: false,
  handle(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (e.key === 'Escape') {
      document.getElementById('palette').classList.add('hidden');
      document.getElementById('shortcuts-modal').classList.add('hidden');
      const np = document.getElementById('notif-panel'); if (np) np.classList.remove('open');
      NT.notifications.state.open = false;
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); NT.palette.open(); return;
    }
    if (typing) return;
    if (e.key === '?') { NT.openShortcuts(); return; }
    if (e.key === '/') { e.preventDefault(); document.getElementById('global-search').focus(); return; }
    if (e.key.toLowerCase() === 't') { NT.theme.cycle(); return; }
    if (e.key.toLowerCase() === 'b') {
      const r = NT.currentRoute();
      if (r.id === 'intelligence' && r.params.id) {
        NT.api('/api/entities/' + r.params.id).then(ent => {
          const added = NT.watchlist.toggle(ent);
          NT.toast(added ? 'Bookmarked' : 'Removed', added ? 'success' : 'info');
          NT.refreshWatchBadge();
        });
      }
      return;
    }
    if (e.key.toLowerCase() === 's') { NT.toggleSidebar(); return; }
    if (e.key.toLowerCase() === 'g') { this._g = true; setTimeout(() => this._g = false, 800); return; }
    if (this._g) {
      const map = { o: 'overview', e: 'entities', x: 'explorer', a: 'analytics', n: 'anomalies', i: 'investigations', w: 'watchlist', c: 'communities', r: 'reports', t: 'temporal', g: 'geoint', d: 'audit' };
      const dest = map[e.key.toLowerCase()];
      if (dest) { NT.go(dest); }
      this._g = false;
    }
  }
};

// ---------- Event bindings ----------
NT.login = async (username, password) => {
  const r = await api('/api/auth/login', { method: 'POST', body: { username, password } });
  NT.token = r.access_token;
  NT.user = r.user;
  localStorage.setItem('nt_token', NT.token);
  localStorage.setItem('nt_user', JSON.stringify(NT.user));
  NT.renderShell();
};
NT.logout = async (silent = false) => {
  if (NT.token && !silent) {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) {}
  }
  NT.token = null; NT.user = null;
  localStorage.removeItem('nt_token');
  localStorage.removeItem('nt_user');
  NT.renderShell();
};

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  try {
    await NT.login(u, p);
    NT.toast('Welcome, ' + u, 'success');
  } catch (err) {
    NT.toast('Login failed: ' + err.message, 'error');
  }
});
document.getElementById('logout-btn').addEventListener('click', () => NT.logout());
document.getElementById('search-btn').addEventListener('click', () => {
  const q = document.getElementById('global-search').value.trim();
  if (q) NT.go('entities', { q });
});
document.getElementById('global-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('search-btn').click();
});
document.getElementById('theme-btn').addEventListener('click', () => NT.theme.cycle());
document.getElementById('palette-btn').addEventListener('click', () => NT.palette.open());
document.getElementById('sb-toggle').addEventListener('click', () => NT.toggleSidebar());
document.getElementById('mobile-toggle').addEventListener('click', () => NT.toggleMobileSidebar());
document.getElementById('notif-btn').addEventListener('click', (e) => { e.stopPropagation(); NT.notifications.toggle(); });
document.addEventListener('click', (e) => {
  const np = document.getElementById('notif-panel');
  const nb = document.getElementById('notif-btn');
  if (np && nb && !np.contains(e.target) && !nb.contains(e.target)) {
    np.classList.remove('open'); NT.notifications.state.open = false;
  }
  const app = document.getElementById('app');
  const sidebar = app && app.querySelector('.sidebar');
  const mobileToggle = document.getElementById('mobile-toggle');
  if (app && app.classList.contains('mobile-open') && sidebar && !sidebar.contains(e.target) &&
      mobileToggle && !mobileToggle.contains(e.target)) {
    app.classList.remove('mobile-open');
  }
});

const palInp = document.getElementById('palette-input');
palInp.addEventListener('input', () => { NT.palette.state.query = palInp.value; NT.palette.state.active = 0; NT.palette.build(); });
palInp.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); NT.palette.move(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); NT.palette.move(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); NT.palette.activate(); }
});
['palette', 'shortcuts-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', (e) => {
    if (e.target.id === id) document.getElementById(id).classList.add('hidden');
  });
});

window.addEventListener('keydown', (e) => NT.shortcuts.handle(e));
window.addEventListener('hashchange', () => NT.render());
window.addEventListener('load', () => { NT.renderShell(); });
window.addEventListener('resize', () => { if (window.innerWidth > 900) document.getElementById('app').classList.remove('mobile-open'); });
NT.theme.apply();
