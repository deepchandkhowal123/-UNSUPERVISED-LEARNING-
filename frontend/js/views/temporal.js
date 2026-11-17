/* Temporal Analysis — monthly activity timeline (SVG chart). */
NT.views.temporal = async function (root) {
  root.innerHTML = `<div class="view-head"><h2>Temporal Analysis</h2>
    <p>Relationship activity over time — monthly event counts and aggregate transaction volume, useful for spotting activity bursts.</p></div>
    <div id="tm-load">${NT.loading()}</div>`;
  const data = await NT.api('/api/analytics/timeline');
  const items = data.items.filter(i => i.month);
  if (!items.length) { root.querySelector('#tm-load').innerHTML = NT.empty('No temporal data'); return; }

  const W = 940, H = 260, pad = 44;
  const maxN = Math.max(...items.map(i => i.n), 1);
  const maxAmt = Math.max(...items.map(i => i.total), 1);
  const innerW = W - pad * 2, innerH = H - pad * 2;
  const bw = innerW / items.length;

  const bars = items.map((it, i) => {
    const x = pad + i * bw + bw * 0.15;
    const h = (it.n / maxN) * innerH;
    const y = pad + innerH - h;
    return `<rect x="${x}" y="${y}" width="${bw * 0.7}" height="${h}" fill="#3b82f6" rx="2">
      <title>${it.month}: ${it.n} events</title></rect>`;
  }).join('');
  const pts = items.map((it, i) => {
    const x = pad + i * bw + bw / 2;
    const y = pad + innerH - (it.total / maxAmt) * innerH;
    return `${x},${y}`;
  }).join(' ');
  const xLabels = items.filter((_, i) => i % Math.max(1, Math.floor(items.length / 8)) === 0)
    .map(it => it.month).join(' · ');

  root.querySelector('#tm-load').innerHTML = `
    <div class="grid grid-3 mb-16">
      ${NT.statCard(NT.svg('clock', 20), 'Months tracked', items.length)}
      ${NT.statCard(NT.svg('activity', 20), 'Total events', items.reduce((s, i) => s + i.n, 0))}
      ${NT.statCard(NT.svg('chart', 20), 'Total volume', NT.money(items.reduce((s, i) => s + i.total, 0)))}
    </div>
    ${NT.card('Monthly activity', `
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:940px">
        <line x1="${pad}" y1="${pad + innerH}" x2="${pad + innerW}" y2="${pad + innerH}" stroke="#2a3858"/>
        <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${pad + innerH}" stroke="#2a3858"/>
        ${bars}
        <polyline points="${pts}" fill="none" stroke="#22c55e" stroke-width="2"/>
        <text x="${pad}" y="${pad - 10}" fill="#8b97b3" font-size="11">events (bars) ▕ volume (line)</text>
        <text x="${pad}" y="${H - 12}" fill="#5c6885" font-size="10">${NT.esc(xLabels)}</text>
      </svg>`)}
    <div class="section-title">Monthly breakdown</div>
    ${NT.table(
      [{ label: 'Month', render: r => `<span class="mono">${NT.esc(r.month)}</span>` },
       { label: 'Events', key: 'n', num: true },
       { label: 'Total volume', render: r => NT.money(r.total), num: true }],
      items.slice(-18).reverse())}`;
};
