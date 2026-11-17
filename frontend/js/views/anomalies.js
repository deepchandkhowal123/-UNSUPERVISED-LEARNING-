/* Anomaly Detection — Isolation Forest / LOF results. */
NT.views.anomalies = async function (root) {
  const state = { method: 'isolation_forest' };
  root.innerHTML = `
    <div class="view-head"><h2>Anomaly Detection</h2>
    <p>Unsupervised machine learning flags entities with unusual feature signatures — outlier degree, transaction volume and compliance flags.</p></div>
    <div class="filters">
      <label class="muted">Algorithm:</label>
      <select id="an-method">
        <option value="isolation_forest">Isolation Forest</option>
        <option value="lof">Local Outlier Factor (LOF)</option>
      </select>
      <button id="an-go" class="btn btn-primary btn-sm">Run detection</button>
      <span id="an-meta" class="mute2"></span>
    </div>
    <div id="an-result">${NT.loading()}</div>`;

  const run = async () => {
    state.method = document.getElementById('an-method').value;
    document.getElementById('an-result').innerHTML = NT.loading();
    const data = await NT.api(`/api/analytics/anomalies?method=${state.method}&limit=60`);
    if (data.error) {
      document.getElementById('an-result').innerHTML =
        `<div class="empty">${NT.esc(data.error)}</div>`;
      return;
    }
    document.getElementById('an-meta').textContent =
      `${data.method} · ${data.count} anomalies flagged`;
    document.getElementById('an-result').innerHTML = NT.table(
      [{ label: 'Score', render: r => {
          const pct = Math.min(100, r.score * 100 / 0.4);
          return `<div class="bar" style="width:70px"><span style="width:${pct}%"></span></div>`;
        } },
       { label: 'Entity', render: r => `<a class="clickable" onclick="NT.go('intelligence',{id:'${r.entity_id}'})">${NT.esc(r.name)}</a>` },
       { label: 'Type', render: r => NT.typeTag(r.type) },
       { label: 'Risk', render: r => NT.riskPill(r.risk_score) },
       { label: 'Reason', render: r => `<span class="muted">${NT.esc(r.reason)}</span>` },
       { label: 'Raw score', render: r => `<span class="mono">${r.score.toFixed(4)}</span>`, num: true }],
      data.anomalies);
  };
  document.getElementById('an-go').addEventListener('click', run);
  await run();
};
