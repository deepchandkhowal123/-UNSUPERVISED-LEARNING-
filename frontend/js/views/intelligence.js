/* Entity Intelligence detail v2 — profile, risk gauge, mini-graph, timeline, notes, relationships. */
NT.views.intelligence = async function (root, params) {
  const id = params.id;
  if (!id) { root.innerHTML = NT.empty('No entity selected', 'intel'); return; }
  root.innerHTML = NT.loading();
  const [ent, nbrs, sub, tl] = await Promise.all([
    NT.api('/api/entities/' + id),
    NT.api(`/api/entities/${id}/neighbors?limit=80`),
    NT.api(`/api/entities/${id}/subgraph?depth=1&limit=40`),
    NT.api(`/api/entities/${id}/timeline`).catch(() => ({ items: [] })),
  ]);
  const canInvestigate = NT.user && NT.user.permissions.includes('investigate');
  const flags = (ent.metadata && ent.metadata.flags) || [];
  const meta = ent.metadata || {};
  const e = ent;
  const tlItems = (tl.items || []).filter(i => i.month).slice(-12);
  const tlChart = tlItems.length >= 2
    ? NT.lineChart([{ values: tlItems.map(i => i.count), color: '#3b82f6', label: 'events' }], { w: 420, h: 150 })
    : NT.empty('No timeline data', 'clock');

  root.innerHTML = `
    <div class="view-head">
      <div class="row between">
        <div><h2>${NT.esc(e.name)} ${NT.starHTML(e)}</h2>
        <p>${NT.typeTag(e.type)} <span class="mono mute2">${NT.esc(e.id)}</span></p></div>
        <div class="btn-row">
          <button class="btn btn-sm" onclick="NT.go('compare',{ids:'${e.id}'})">${NT.svg('compare', 14)} Compare</button>
          <button class="btn btn-sm" onclick="NT.go('explorer',{id:'${e.id}'})">${NT.svg('external', 14)} Explorer</button>
          ${canInvestigate ? `<button id="recalc-btn" class="btn btn-sm">${NT.svg('refresh', 14)} Recalc risk</button>` : ''}
          <button class="btn btn-sm" onclick="history.back()">${NT.svg('arrow-left', 14)} Back</button>
        </div>
      </div>
    </div>
    <div class="grid grid-2">
      ${NT.card('Profile', `
        <dl class="detail-grid">
          <dt>Type</dt><dd>${NT.typeTag(e.type)}</dd>
          <dt>Subtype</dt><dd>${NT.esc(e.subtype || '—')}</dd>
          <dt>Country</dt><dd>${NT.esc(e.country || '—')} · ${NT.esc(e.region || '')}</dd>
          <dt>Created</dt><dd class="mono">${NT.esc((e.created_at || '').slice(0, 10))}</dd>
          <dt>Last seen</dt><dd class="mono">${NT.esc((e.last_seen || '').slice(0, 10))}</dd>
          <dt>Source</dt><dd>${NT.esc(meta.source || '—')}</dd>
          <dt>Flags</dt><dd>${flags.length ? flags.map(f => `<span class="pill high">${NT.esc(f)}</span>`).join(' ') : '<span class="mute2">none</span>'}</dd>
        </dl>`)}
      ${NT.card('Risk assessment', `
        <div class="row" style="align-items:flex-start;gap:20px">
          ${NT.gauge(e.risk_score, { size: 130, label: 'current risk score' })}
          <div class="kv-list flex-1">
            <div class="kv"><span class="k">Score</span><span>${NT.riskPill(e.risk_score)}</span></div>
            <div class="kv"><span class="k">Band</span><span>${e.risk_score >= 75 ? 'Critical' : e.risk_score >= 55 ? 'High' : e.risk_score >= 30 ? 'Medium' : 'Low'}</span></div>
            <div class="kv"><span class="k">Total links</span><span>${nbrs.neighbors.length}</span></div>
            <div class="kv"><span class="k">Volume</span><span>${NT.money(nbrs.neighbors.reduce((s, n) => s + (n.amount || 0), 0))}</span></div>
          </div>
        </div>`)}
    </div>
    <div class="grid grid-2 mt-16">
      ${NT.card('Connections summary', `
        <div class="kv-list">
          <div class="kv"><span class="k">Outbound</span><span>${nbrs.neighbors.filter(n => n.direction === 'out').length}</span></div>
          <div class="kv"><span class="k">Inbound</span><span>${nbrs.neighbors.filter(n => n.direction === 'in').length}</span></div>
          <div class="kv"><span class="k">Distinct types</span><span>${new Set(nbrs.neighbors.map(n => n.type)).size}</span></div>
          <div class="kv"><span class="k">High-risk neighbours</span><span>${nbrs.neighbors.filter(n => (n.risk_score || 0) >= 70).length}</span></div>
        </div>
        <button class="btn btn-sm btn-block mt-16" onclick="NT.go('explorer',{id:'${e.id}'})">${NT.svg('net', 14)} Visualize neighborhood</button>`)}
      ${NT.card('Neighborhood', `
        <canvas id="ent-mini" class="graph-canvas" style="height:200px"></canvas>`)}
    </div>
    <div class="section-title">Activity timeline <span class="count">last ${tlItems.length} months</span></div>
    ${tlChart}
    <div class="section-title">Linked entities <span class="count">${nbrs.neighbors.length}</span></div>
    <div id="rel-chips" class="chip-row mb-16"></div>
    <div id="rel-table"></div>
    <div class="section-title">Analyst notes</div>
    <div id="notes-area">${NT.loading()}</div>`;

  // mini graph
  const cv = document.getElementById('ent-mini');
  cv.width = cv.clientWidth; cv.height = cv.clientHeight;
  const gc = new NT.GraphCanvas(cv);
  gc.setData(sub.nodes || [{ id: e.id, name: e.name, type: e.type, risk_score: e.risk_score }], sub.edges || []);
  gc.onSelect = (nid) => { if (nid !== id) NT.go('intelligence', { id: nid }); };

  // relationships table with dir filter
  let dirFilter = 'all';
  const chips = document.getElementById('rel-chips');
  const relTbl = document.getElementById('rel-table');
  const renderRel = () => {
    const rows = nbrs.neighbors.filter(n => dirFilter === 'all' || n.direction === dirFilter);
    relTbl.innerHTML = NT.table(
      [{ label: 'Direction', render: r => r.direction === 'out' ? '<span class="pill info">→ out</span>' : '<span class="pill neutral">← in</span>' },
       { label: 'Entity', render: r => `<a class="clickable" onclick="NT.go('intelligence',{id:'${r.id}'})">${NT.esc(r.name)}</a>` },
       { label: 'Type', render: r => NT.typeTag(r.type) },
       { label: 'Relationship', key: 'rel_type' },
       { label: 'Amount', render: r => NT.money(r.amount), num: true },
       { label: 'Risk', render: r => NT.riskPill(r.risk_score) }],
      rows);
  };
  const renderChips = () => {
    chips.innerHTML = [['all', 'All', nbrs.neighbors.length], ['out', 'Outbound', nbrs.neighbors.filter(n => n.direction === 'out').length],
      ['in', 'Inbound', nbrs.neighbors.filter(n => n.direction === 'in').length]].map(([d, l, c]) =>
      `<span class="chip-btn ${dirFilter === d ? 'active' : ''}" data-dir="${d}">${l} (${c})</span>`).join('');
    chips.querySelectorAll('.chip-btn').forEach(c => c.addEventListener('click', () => {
      dirFilter = c.dataset.dir; renderChips(); renderRel();
    }));
  };
  renderChips(); renderRel();

  // recalc risk
  const rb = document.getElementById('recalc-btn');
  if (rb) rb.addEventListener('click', async () => {
    if (!confirm('Recompute risk from graph degree + anomaly signals?')) return;
    try {
      const r = await NT.api(`/api/entities/${id}/recalc-risk`, { method: 'POST' });
      NT.toast(`Risk updated: ${r.old} → ${r.new}`, 'success');
      NT.render();
    } catch (err) { NT.toast(err.message, 'error'); }
  });

  // notes
  const renderNotes = async () => {
    const area = document.getElementById('notes-area');
    try {
      const data = await NT.api(`/api/entities/${id}/notes`);
      const list = (data.items || []).map(n =>
        `<div class="note-item">
           <div class="note-meta"><span>${NT.esc(n.author)}</span>
             <span><span class="mono">${NT.esc((n.created_at || '').slice(0, 19).replace('T', ' '))}</span>
             <button class="icon-btn" style="width:22px;height:22px" data-note="${n.id}" title="Delete">${NT.svg('trash', 13)}</button></span></div>
           <div class="note-body">${NT.esc(n.content)}</div>
         </div>`).join('');
      area.innerHTML = (list || `<div class="mute2" style="padding:8px">No notes yet.</div>`) + `
        <div class="note-form">
          <textarea id="note-text" placeholder="Add an analyst note…"></textarea>
          <button id="note-add" class="btn btn-primary btn-sm" style="align-self:flex-start">${NT.svg('plus', 14)} Add</button>
        </div>`;
      document.getElementById('note-add').addEventListener('click', async () => {
        const txt = document.getElementById('note-text').value.trim();
        if (!txt) return;
        try {
          await NT.api(`/api/entities/${id}/notes`, { method: 'POST', body: { entity_id: id, content: txt } });
          NT.toast('Note added', 'success'); renderNotes();
        } catch (err) { NT.toast(err.message, 'error'); }
      });
      area.querySelectorAll('[data-note]').forEach(b => b.addEventListener('click', async () => {
        try {
          await NT.api('/api/entities/notes/' + b.dataset.note, { method: 'DELETE' });
          NT.toast('Note deleted', 'info'); renderNotes();
        } catch (err) { NT.toast(err.message, 'error'); }
      }));
    } catch (err) { area.innerHTML = `<div class="mute2">Could not load notes: ${NT.esc(err.message)}</div>`; }
  };
  renderNotes();
};
