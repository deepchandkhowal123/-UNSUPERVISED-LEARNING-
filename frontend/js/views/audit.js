/* Audit Logs — immutable action trail. */
NT.views.audit = async function (root) {
  root.innerHTML = `<div class="view-head"><h2>Audit Logs</h2>
    <p>Chronological trail of every authenticated action — searches, edits, report generation, case changes.</p></div>
    <div id="au-load">${NT.loading()}</div>`;
  const data = await NT.api('/api/system/audit?limit=200');
  document.getElementById('au-load').innerHTML = NT.table(
    [{ label: 'Time', render: r => `<span class="mono">${NT.esc((r.ts || '').slice(0, 19).replace('T', ' '))}</span>` },
     { label: 'User', render: r => `<strong>${NT.esc(r.username || '—')}</strong> <span class="mute2">${NT.esc(r.role || '')}</span>` },
     { label: 'Action', render: r => `<span class="pill neutral">${NT.esc(r.action)}</span>` },
     { label: 'Target', render: r => `<span class="mono">${NT.esc(r.target || '—')}</span>` },
     { label: 'Details', render: r => `<span class="muted">${NT.esc((r.details || '').slice(0, 80))}${(r.details || '').length > 80 ? '…' : ''}</span>` }],
    data.items);
};
