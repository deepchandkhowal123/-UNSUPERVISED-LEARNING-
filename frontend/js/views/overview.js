/* Analyst command-center overview. */
NT.views.overview = async function (root) {
  root.innerHTML = NT.skeleton('cards', 4) + `<div class="mt-16">${NT.skeleton('rows', 5)}</div>`;

  const [data, timeline, heat, anomalies] = await Promise.all([
    NT.api('/api/analytics/overview'),
    NT.api('/api/analytics/timeline'),
    NT.api('/api/analytics/heatmap'),
    NT.api('/api/analytics/anomalies?method=isolation_forest&limit=6'),
  ]);
  const stats = data.stats;
  const totalEntities = Number(stats.nodes) || 0;
  const number = value => new Intl.NumberFormat().format(Number(value) || 0);
  const riskColors = {
    'low (0-30)': 'var(--green)',
    'medium (30-55)': 'var(--yellow)',
    'high (55-75)': 'var(--orange)',
    'critical (75+)': 'var(--red)',
  };
  const riskRows = Object.entries(data.risk_distribution || {}).map(([label, count]) => {
    const pct = totalEntities ? (count / totalEntities) * 100 : 0;
    return `<div class="risk-row">
      <div class="risk-row-meta"><span><i class="risk-dot" style="--risk-color:${riskColors[label] || 'var(--accent)'}"></i>${NT.esc(label)}</span>
      <strong>${number(count)} <small>${pct.toFixed(1)}%</small></strong></div>
      <div class="risk-track"><span style="width:${pct}%;--risk-color:${riskColors[label] || 'var(--accent)'}"></span></div>
    </div>`;
  }).join('');

  const typeColors = {
    person: '#22d3ee', organization: '#a78bfa', company: '#a78bfa',
    account: '#818cf8', phone: '#34d399', email: '#2dd4bf',
    address: '#fbbf24', vehicle: '#fb923c', asset: '#f472b6',
  };
  const types = Object.entries(stats.type_counts || {}).sort((a, b) => b[1] - a[1]);
  const typeDonut = NT.donut(
    types.slice(0, 8).map(([label, value]) => ({
      label, value, color: typeColors[label] || '#94a3b8',
    })),
    { size: 176, thick: 18, centerValue: number(totalEntities), centerLabel: 'entities' }
  );
  const typeLegend = types.slice(0, 6).map(([type, count]) =>
    `<div class="type-legend-row"><span><i style="--type-color:${typeColors[type] || '#94a3b8'}"></i>${NT.esc(type)}</span><strong>${number(count)}</strong></div>`
  ).join('');

  const timelineItems = (timeline.items || []).filter(item => item.month).slice(-12);
  const timelineChart = timelineItems.length >= 2
    ? `${NT.lineChart([{ values: timelineItems.map(item => item.n), color: '#818cf8' }], { w: 600, h: 190, fill: true })}
       <div class="timeline-labels">${timelineItems.map(item => `<span>${NT.esc(item.month.slice(5))}</span>`).join('')}</div>`
    : NT.empty('Not enough timeline data', 'clock');

  const heatTypes = heat.types || [];
  const heatBuckets = heat.buckets || [];
  const heatMatrix = heat.matrix || {};
  const maxCell = Math.max(1, ...heatTypes.flatMap(type =>
    heatBuckets.map(bucket => Number((heatMatrix[type] || {})[bucket]) || 0)));
  const heatColors = ['#34d399', '#fbbf24', '#fb923c', '#f87171'];
  const heatRgba = (hex, alpha) => {
    const color = parseInt(hex.slice(1), 16);
    return `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;
  };
  const heatmap = `
    <div class="heatmap-scroll"><div class="heatmap" style="grid-template-columns:110px repeat(${heatBuckets.length}, minmax(56px, 1fr))">
      <div></div>${heatBuckets.map(bucket => `<div class="heat-label">${NT.esc(bucket)}</div>`).join('')}
      ${heatTypes.map(type =>
        `<div class="heat-label">${NT.esc(type)}</div>` +
        heatBuckets.map((bucket, index) => {
          const value = Number((heatMatrix[type] || {})[bucket]) || 0;
          const opacity = 0.14 + (value / maxCell) * 0.76;
          return `<div class="heat-cell" style="background:${heatRgba(heatColors[index] || '#818cf8', opacity)}" title="${NT.esc(type)} / ${NT.esc(bucket)}: ${value}">${number(value)}</div>`;
        }).join('')
      ).join('')}
    </div></div>`;

  const activityItems = [];
  for (const flow of (data.top_flows || []).slice(0, 4)) {
    activityItems.push(`<div class="signal-item">
      <span class="signal-icon flow">${NT.svg('arrow-right', 15)}</span>
      <div class="signal-copy"><div><a class="clickable" onclick="NT.go('intelligence',{id:'${NT.esc(flow.source_id)}'})">${NT.esc(flow.s_name)}</a>
      <span class="signal-arrow">→</span> <a class="clickable" onclick="NT.go('intelligence',{id:'${NT.esc(flow.target_id)}'})">${NT.esc(flow.t_name)}</a></div>
      <small>${NT.esc(flow.rel_type)} · ${NT.esc((flow.occurred_at || '').slice(0, 10))}</small></div>
      <strong class="signal-amount">${NT.money(flow.amount, flow.currency)}</strong>
    </div>`);
  }
  for (const item of (anomalies.anomalies || []).slice(0, 3)) {
    activityItems.push(`<div class="signal-item">
      <span class="signal-icon anomaly">${NT.svg('alert', 15)}</span>
      <div class="signal-copy"><div><a class="clickable" onclick="NT.go('intelligence',{id:'${NT.esc(item.entity_id)}'})">${NT.esc(item.name)}</a></div>
      <small>${NT.esc(item.reason)}</small></div>
      <span class="signal-tag">Review</span>
    </div>`);
  }

  const centralEntities = NT.table(
    [
      { label: 'Entity', render: row => `<div class="central-entity"><span class="mono">${NT.esc(row.entity_id)}</span><a class="clickable" onclick="NT.go('intelligence',{id:'${NT.esc(row.entity_id)}'})">${NT.esc(row.name)}</a></div>` },
      { label: 'Type', render: row => NT.typeTag(row.type) },
      { label: 'Connections', key: 'degree', num: true, sortable: true },
      { label: 'PageRank', key: 'pagerank', num: true, sortable: true },
      { label: 'Risk', render: row => NT.riskPill(row.risk_score) },
    ],
    data.top_entities || []
  );

  const averageRisk = Number(stats.avg_risk) || 0;
  const initialFocal = (data.top_entities || [])[0] || null;
  root.innerHTML = `
    <section class="overview-heading">
      <div>
        <div class="overview-eyebrow"><span></span> NETWORK INTELLIGENCE <i>/</i> INVESTIGATION WORKSPACE</div>
        <h1>Trace the relationships</h1>
        <p>Start with a connected entity, inspect its neighborhood, and follow the evidence.</p>
      </div>
      <div class="overview-heading-actions">
        <div class="dataset-state"><span></span><div><strong>Dataset ready</strong><small>Analysis available</small></div></div>
        <button class="btn btn-primary" onclick="NT.go('explorer')">${NT.svg('net', 16)} Explore network</button>
      </div>
    </section>

    <section class="network-workspace card">
      <header class="network-workspace-header">
        <div><span class="panel-kicker">RELATIONSHIP MAP</span><h2>Entity neighborhood</h2>
          <p>Drag to explore, scroll to zoom, and select any node to open its profile.</p></div>
        <form id="overview-graph-search" class="network-search">
          <input id="overview-entity-query" type="search" value="${NT.esc(initialFocal ? initialFocal.entity_id : '')}"
            placeholder="Search name or entity ID" aria-label="Search a focal entity">
          <select id="overview-graph-depth" aria-label="Neighborhood depth">
            <option value="1" selected>1 hop</option><option value="2">2 hops</option>
          </select>
          <button class="btn btn-primary" type="submit">${NT.svg('search', 15)} Trace</button>
        </form>
      </header>
      <div class="network-workspace-body">
        <div class="network-map-panel">
          <div class="graph-controls">
            <button id="overview-zoom-in" class="btn btn-ghost btn-sm" type="button" aria-label="Zoom in">${NT.svg('zoom-in', 14)}</button>
            <button id="overview-zoom-out" class="btn btn-ghost btn-sm" type="button" aria-label="Zoom out">${NT.svg('zoom-out', 14)}</button>
            <button id="overview-reset" class="btn btn-ghost btn-sm" type="button">${NT.svg('refresh', 14)} Reset</button>
            <button id="overview-labels" class="btn btn-ghost btn-sm" type="button" aria-pressed="false">${NT.svg('users', 14)} Labels</button>
            <span id="overview-graph-status" class="gc-info" role="status" aria-live="polite">Loading neighborhood…</span>
          </div>
          <div class="graph-wrap">
            <canvas id="overview-graph" class="graph-canvas" aria-label="Interactive relationship graph"></canvas>
            <div class="graph-hint">Drag to pan · drag a node to move · click a node to inspect</div>
          </div>
          <div id="overview-graph-legend" class="graph-legend"></div>
        </div>
        <aside id="overview-inspector" class="network-inspector" aria-live="polite">
          ${initialFocal ? `<span class="inspector-label">STARTING ENTITY</span><h3>${NT.esc(initialFocal.name)}</h3>
            <div class="inspector-id">${NT.esc(initialFocal.entity_id)}</div>` : NT.empty('No entities are available to inspect', 'intel')}
        </aside>
      </div>
    </section>

    <div class="overview-kpis">
      <article class="overview-kpi card">
        <div class="kpi-top"><span class="kpi-icon">${NT.svg('users', 18)}</span><span class="kpi-context">NETWORK</span></div>
        <div class="kpi-value">${number(stats.nodes)}</div><div class="kpi-label">Tracked entities</div>
        <div class="kpi-foot">${types.length} entity classes</div>
      </article>
      <article class="overview-kpi card">
        <div class="kpi-top"><span class="kpi-icon cyan">${NT.svg('net', 18)}</span><span class="kpi-context">LINKS</span></div>
        <div class="kpi-value">${number(stats.edges)}</div><div class="kpi-label">Relationships</div>
        <div class="kpi-foot">Across the network graph</div>
      </article>
      <article class="overview-kpi card">
        <div class="kpi-top"><span class="kpi-icon red">${NT.svg('alert', 18)}</span><span class="kpi-context">PRIORITY</span></div>
        <div class="kpi-value">${number(stats.high_risk_count)}</div><div class="kpi-label">Elevated-risk entities</div>
        <div class="kpi-foot">${totalEntities ? ((stats.high_risk_count / totalEntities) * 100).toFixed(1) : '0.0'}% score 70 or higher</div>
      </article>
      <article class="overview-kpi card">
        <div class="kpi-top"><span class="kpi-icon violet">${NT.svg('gauge', 18)}</span><span class="kpi-context">RISK INDEX</span></div>
        <div class="kpi-value">${averageRisk.toFixed(1)}<small> / 100</small></div><div class="kpi-label">Average risk score</div>
        <div class="kpi-foot"><span class="risk-inline">${NT.riskPill(averageRisk)}</span> Network-wide average</div>
      </article>
    </div>

    <div class="overview-alert">
      <span class="overview-alert-icon">${NT.svg('alert', 18)}</span>
      <div><strong>${number(stats.high_risk_count)} entities need closer review</strong>
        <small>Elevated risk is scored at 70 or above. Review model-flagged anomalies and entity context.</small></div>
      <button class="btn btn-sm" onclick="NT.go('anomalies')">Review anomalies ${NT.svg('arrow-right', 14)}</button>
    </div>

    <div class="overview-grid">
      <section class="card overview-panel">
        <div class="panel-heading"><div><span class="panel-kicker">RISK POSTURE</span><h2>Exposure by risk band</h2></div>
          <button class="text-action" onclick="NT.go('entities')">All entities ${NT.svg('arrow-right', 14)}</button></div>
        <div class="risk-rows">${riskRows || NT.empty('No risk data', 'gauge')}</div>
      </section>
      <section class="card overview-panel">
        <div class="panel-heading"><div><span class="panel-kicker">NETWORK PROFILE</span><h2>Entity composition</h2></div></div>
        <div class="type-profile"><div>${typeDonut}</div><div class="type-legend">${typeLegend}</div></div>
        <div class="network-metrics">
          <div><strong>${number(stats.components)}</strong><span>Components</span></div>
          <div><strong>${Number(stats.avg_degree || 0).toFixed(2)}</strong><span>Avg. degree</span></div>
          <div><strong>${Number(stats.density || 0).toFixed(5)}</strong><span>Graph density</span></div>
          <div><strong>${number(stats.scc_count)}</strong><span>Strongly connected</span></div>
        </div>
      </section>
    </div>

    <div class="overview-grid overview-grid-wide">
      <section class="card overview-panel">
        <div class="panel-heading"><div><span class="panel-kicker">RELATIONSHIP ACTIVITY</span><h2>Network activity</h2></div>
          <span class="panel-note">Monthly relationships · last 12 months</span></div>
        <div class="overview-chart">${timelineChart}</div>
      </section>
      <section class="card overview-panel">
        <div class="panel-heading"><div><span class="panel-kicker">ANALYST QUEUE</span><h2>Signals to review</h2></div>
          <button class="text-action" onclick="NT.go('anomalies')">Open queue ${NT.svg('arrow-right', 14)}</button></div>
        <div class="signal-list">${activityItems.join('') || NT.empty('No recent signals', 'activity')}</div>
      </section>
    </div>

    <section class="card overview-panel heatmap-panel">
      <div class="panel-heading"><div><span class="panel-kicker">RISK DISTRIBUTION</span><h2>Risk by entity class</h2></div>
      <span class="panel-note">Hover a cell to inspect counts by class and risk band</span></div>
      ${heatmap}
    </section>

    <section class="overview-central">
      <div class="panel-heading"><div><span class="panel-kicker">NETWORK STRUCTURE</span><h2>Most connected entities</h2>
        <p>Entities with the strongest network centrality.</p></div>
        <button class="btn btn-sm" onclick="NT.go('entities')">Browse entities ${NT.svg('arrow-right', 14)}</button></div>
      ${centralEntities}
    </section>`;

  const graphCanvas = document.getElementById('overview-graph');
  graphCanvas.width = Math.max(1, graphCanvas.clientWidth);
  graphCanvas.height = Math.max(1, graphCanvas.clientHeight);
  const graph = new NT.GraphCanvas(graphCanvas);
  const graphStatus = document.getElementById('overview-graph-status');
  const graphLegend = document.getElementById('overview-graph-legend');
  const inspector = document.getElementById('overview-inspector');
  const queryInput = document.getElementById('overview-entity-query');
  const depthSelect = document.getElementById('overview-graph-depth');
  let activeEntityId = initialFocal ? initialFocal.entity_id : '';
  let requestId = 0;

  const renderInspector = (center, nodes, edges) => {
    const highRisk = nodes.filter(node => node.id !== center.id && Number(node.risk_score) >= 70)
      .sort((a, b) => Number(b.risk_score) - Number(a.risk_score));
    const shownHighRisk = highRisk.slice(0, 4);
    inspector.innerHTML = `
      <span class="inspector-label">FOCAL ENTITY</span>
      <h3>${NT.esc(center.name || center.id)}</h3>
      <div class="inspector-id">${NT.esc(center.id)}</div>
      <div class="inspector-tags">${NT.typeTag(center.type || 'unknown')} ${NT.riskPill(center.risk_score)}</div>
      <div class="inspector-metrics">
        <div><strong>${nodes.length - 1}</strong><span>Nearby entities</span></div>
        <div><strong>${edges.length}</strong><span>Relationships</span></div>
        <div><strong>${highRisk.length}</strong><span>Elevated nearby</span></div>
      </div>
      <div class="inspector-section-title">HIGH-RISK CONNECTIONS (${highRisk.length})</div>
      ${shownHighRisk.length ? `<div class="inspector-connections">${shownHighRisk.map(node =>
        `<button type="button" class="inspector-connection" data-entity-id="${NT.esc(node.id)}">
          <span><strong>${NT.esc(node.name || node.id)}</strong><small>${NT.esc(node.type || 'unknown')} · ${NT.esc(node.id)}</small></span>
          ${NT.riskPill(node.risk_score)}
        </button>`).join('')}</div>` : '<p class="inspector-empty">No elevated-risk entities in this neighborhood.</p>'}
      <button id="overview-open-entity" class="btn btn-sm btn-block mt-16" type="button">
        ${NT.svg('intel', 14)} Open entity profile
      </button>`;
    inspector.querySelectorAll('[data-entity-id]').forEach(button => {
      button.addEventListener('click', () => NT.go('intelligence', { id: button.dataset.entityId }));
    });
    document.getElementById('overview-open-entity').addEventListener('click', () =>
      NT.go('intelligence', { id: center.id }));
  };

  const loadNeighborhood = async (value) => {
    const currentRequest = ++requestId;
    let entityId = value.trim();
    if (!entityId) {
      graphStatus.textContent = 'Enter an entity name or ID to trace its neighborhood.';
      return;
    }
    graphStatus.textContent = 'Tracing neighborhood…';
    try {
      if (!/^E\d+$/i.test(entityId)) {
        const result = await NT.api('/api/search?q=' + encodeURIComponent(entityId) + '&size=1');
        if (currentRequest !== requestId) return;
        if (!result.entities || !result.entities.length) {
          graphStatus.textContent = `No entity matched "${entityId}".`;
          return;
        }
        entityId = result.entities[0].id;
      } else {
        entityId = entityId.toUpperCase();
      }
      const depth = Number(depthSelect.value);
      const result = await NT.api(`/api/entities/${encodeURIComponent(entityId)}/subgraph?depth=${depth}&limit=48`);
      if (currentRequest !== requestId) return;
      if (!result.nodes || !result.nodes.length) {
        graph.setData([], []);
        graphLegend.innerHTML = '';
        inspector.innerHTML = NT.empty(`No neighborhood found for ${entityId}`, 'intel');
        graphStatus.textContent = `No neighborhood found for ${entityId}.`;
        return;
      }
      const center = result.nodes.find(node => node.id === result.center) || result.nodes[0];
      activeEntityId = center.id;
      queryInput.value = center.id;
      graph.setData(result.nodes, result.edges || []);
      graph.onSelect = id => NT.go('intelligence', { id });
      graphStatus.textContent = `${result.nodes.length} entities · ${(result.edges || []).length} relationships`;
      const types = [...new Set(result.nodes.map(node => node.type).filter(Boolean))];
      graphLegend.innerHTML = types.map(type =>
        `<span><span class="dot" style="background:${graph.colors[type] || graph.colors.default}"></span>${NT.esc(type)}</span>`
      ).join('');
      renderInspector(center, result.nodes, result.edges || []);
    } catch (error) {
      if (currentRequest !== requestId) return;
      graphStatus.textContent = `Neighborhood unavailable: ${error.message}`;
    }
  };

  document.getElementById('overview-graph-search').addEventListener('submit', event => {
    event.preventDefault();
    loadNeighborhood(queryInput.value);
  });
  document.getElementById('overview-zoom-in').addEventListener('click', () => graph.zoomBy(1.25));
  document.getElementById('overview-zoom-out').addEventListener('click', () => graph.zoomBy(1 / 1.25));
  document.getElementById('overview-reset').addEventListener('click', () => graph.resetView());
  document.getElementById('overview-labels').addEventListener('click', event => {
    graph.toggleLabels();
    event.currentTarget.setAttribute('aria-pressed', String(graph.labels));
  });
  if (activeEntityId) loadNeighborhood(activeEntityId);

  root.querySelectorAll('th.sortable').forEach(header => {
    header.addEventListener('click', () => {
      const body = root.querySelector('tbody');
      if (!body) return;
      const rows = [...body.querySelectorAll('tr')];
      const ascending = header.classList.toggle('asc');
      rows.sort((a, b) => {
        const left = a.children[header.cellIndex].textContent.trim();
        const right = b.children[header.cellIndex].textContent.trim();
        const leftNumber = Number.parseFloat(left), rightNumber = Number.parseFloat(right);
        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
          return ascending ? leftNumber - rightNumber : rightNumber - leftNumber;
        }
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
      rows.forEach(row => body.appendChild(row));
    });
  });
};
