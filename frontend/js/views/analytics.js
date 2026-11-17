/* AI Analytics v2 — centrality leaderboard, link prediction, risk factors chart, clusters donut. */
NT.views.analytics = async function (root) {
  root.innerHTML = `<div class="view-head"><h2>AI Analytics</h2>
    <p>Graph-theoretic centrality scores, machine-learning link predictions, risk-factor analysis and entity clustering.</p></div>
    <div id="an-load">${NT.loading()}</div>`;
  const [cent, links, clusters, factors] = await Promise.all([
    NT.api('/api/graph/centrality?limit=30'),
    NT.api('/api/analytics/link-prediction?limit=20'),
    NT.api('/api/analytics/clusters?k=8'),
    NT.api('/api/analytics/risk-factors'),
  ]);

  // risk factors bar chart (avg_risk by type)
  const facColors = ['#3b82f6', '#06b6d4', '#a855f7', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b97b3'];
  const facData = (factors.items || []).map((f, i) => ({ label: f.type, value: Math.round(f.avg_risk), color: facColors[i % facColors.length] }));
  const facChart = facData.length ? NT.barChart(facData, { w: 440, h: 180 }) : NT.empty('No data', 'chart');

  // cluster size donut
  const clusterDonut = NT.donut(
    (clusters.clusters || []).map((c, i) => ({ label: 'C' + c.cluster_id, value: c.size, color: facColors[i % facColors.length] })),
    { size: 150, thick: 16, legend: true, centerValue: clusters.k, centerLabel: 'clusters' });

  root.innerHTML = `
    <div class="view-head"><h2>AI Analytics</h2>
    <p>Graph-theoretic centrality scores, machine-learning link predictions, risk-factor analysis and entity clustering.</p></div>
    <div class="section-title">Risk factors by entity type <span class="count">avg risk &amp; high-risk share</span></div>
    <div class="grid grid-2">
      ${NT.card('Average risk by type', facChart)}
      ${NT.card('Risk-factor breakdown', NT.table(
        [{ label: 'Type', render: r => NT.typeTag(r.type) },
         { label: 'Count', key: 'count', num: true, sortable: true },
         { label: 'Avg degree', key: 'avg_degree', num: true, sortable: true },
         { label: 'Avg risk', render: r => `<div class="bar tight"><span style="width:${Math.round(r.avg_risk)}%"></span></div> <span class="mono">${r.avg_risk}</span>` },
         { label: 'High-risk %', render: r => `${r.high_risk_pct}%` }],
        factors.items || []))}
    </div>
    <div class="section-title">Centrality leaderboard <span class="count">top ${cent.items.length} by PageRank</span></div>
    ${NT.table(
      [{ label: 'Entity', render: r => `<a class="clickable" onclick="NT.go('intelligence',{id:'${r.entity_id}'})">${NT.esc(r.name)}</a>` },
       { label: 'Type', render: r => NT.typeTag(r.type) },
       { label: 'PageRank', key: 'pagerank', num: true, sortable: true },
       { label: 'Betweenness', key: 'betweenness', num: true, sortable: true },
       { label: 'Eigenvector', key: 'eigenvector', num: true, sortable: true },
       { label: 'Degree', key: 'degree', num: true, sortable: true },
       { label: 'Risk', render: r => NT.riskPill(r.risk_score) }],
      cent.items)}
    <div class="section-title">Link prediction — likely hidden connections from ${NT.esc(links.focal_name || links.focal)}</div>
    ${NT.table(
      [{ label: 'Source', render: r => `<a class="clickable" onclick="NT.go('intelligence',{id:'${r.source_id}'})">${NT.esc(r.s_name)}</a>` },
       { label: 'Target', render: r => `<a class="clickable" onclick="NT.go('intelligence',{id:'${r.target_id}'})">${NT.esc(r.t_name)}</a>` },
       { label: 'Jaccard', key: 'jaccard', num: true },
       { label: 'Adamic-Adar', key: 'adamic_adar', num: true },
       { label: 'Pref. attach.', key: 'preferential', num: true },
       { label: 'Combined', render: r => `<div class="bar tight"><span style="width:${Math.min(100, r.score * 20)}%"></span></div>`, num: true }],
      links.predictions)}
    <div class="section-title">Entity clustering <span class="count">KMeans, k=${clusters.k}</span></div>
    <div class="grid grid-2">
      ${NT.card('Cluster size distribution', clusterDonut)}
      ${NT.card('Cluster details', (clusters.clusters || []).map(c => `
        <div class="kv"><span class="k">Cluster ${c.cluster_id} · ${NT.typeTag(c.dominant_type)}</span>
          <span>${c.size} entities · avg ${c.avg_risk} risk ${NT.riskPill(c.avg_risk)}</span></div>`).join('') || NT.empty())}
    </div>`;

  // sortable headers
  root.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const tbody = th.closest('table').querySelector('tbody');
      const rows = [...tbody.querySelectorAll('tr')];
      const asc = th.classList.toggle('asc');
      rows.sort((a, b) => {
        const av = a.children[th.cellIndex].textContent.trim();
        const bv = b.children[th.cellIndex].textContent.trim();
        const an = parseFloat(av), bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      rows.forEach(r => tbody.appendChild(r));
    });
  });
};
