/* Community Detection — Louvain-style communities + structural items. */
NT.views.communities = async function (root) {
  root.innerHTML = `<div class="view-head"><h2>Community Detection</h2>
    <p>Densely connected clusters detected via greedy modularity maximization, plus bridge edges and articulation points that hold the network together.</p></div>
    <div id="cm-load">${NT.loading()}</div>`;
  const [comms, struct, stats] = await Promise.all([
    NT.api('/api/graph/communities'),
    NT.api('/api/graph/structural'),
    NT.api('/api/graph/stats'),
  ]);
  const commCards = comms.items.map(c => `
    <div class="card">
      <div class="row between">
        <div class="card-title">Community #${c.community_id}</div>
        ${NT.riskPill(c.avg_risk)}
      </div>
      <div class="kv-list">
        <div class="kv"><span class="k">Members</span><span>${c.size}</span></div>
        <div class="kv"><span class="k">Top hub</span><span><a class="clickable" onclick="NT.go('intelligence',{id:'${c.top_entity}'})">${NT.esc(c.top_entity)}</a></span></div>
      </div>
      <div class="mt-8">${c.members.slice(0, 12).map(m =>
        `<span class="mono mute2" style="margin-right:6px">${NT.esc(m)}</span>`).join('')}${c.size > 12 ? ' …' : ''}</div>
    </div>`).join('');

  root.innerHTML = `
    <div class="view-head"><h2>Community Detection</h2>
    <p>Densely connected clusters detected via greedy modularity maximization, plus bridge edges and articulation points that hold the network together.</p></div>
    <div class="grid grid-4 mb-16">
      ${NT.statCard(NT.svg('layers', 20), 'Communities', comms.items.length)}
      ${NT.statCard(NT.svg('grid', 20), 'Weak components', stats.components)}
      ${NT.statCard(NT.svg('shield', 20), 'Strong components', stats.scc_count)}
      ${NT.statCard(NT.svg('net', 20), 'Bridge edges', struct.bridges.length)}
    </div>
    <div class="section-title">Detected communities</div>
    <div class="grid grid-3">${commCards}</div>
    <div class="section-title">Articulation points (cut-vertices)</div>
    ${NT.table(
      [{ label: 'ID', render: r => `<span class="mono">${NT.esc(r.id)}</span>` },
       { label: 'Name', render: r => `<a class="clickable" onclick="NT.go('intelligence',{id:'${r.id}'})">${NT.esc(r.name)}</a>` },
       { label: 'Type', render: r => NT.typeTag(r.type) },
       { label: 'Degree', key: 'degree', num: true }],
      struct.articulation_points)}`;
};
