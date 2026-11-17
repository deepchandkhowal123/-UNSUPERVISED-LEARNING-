/* Compare Entities — side-by-side profile + metrics. */
NT.views.compare = async function (root, params) {
  const initial = (params.ids || '').split(',').filter(Boolean);
  const state = { a: initial[0] || '', b: initial[1] || '' };

  root.innerHTML = `
    <div class="view-head"><h2>Compare Entities</h2>
    <p>Side-by-side comparison of two entities — risk, connectivity, transaction volume and compliance flags.</p></div>
    <div class="filters">
      <label class="muted">Entity A:</label>
      <input id="cmp-a" type="text" placeholder="E00001 or name" style="min-width:220px" value="${NT.esc(state.a)}">
      <label class="muted">Entity B:</label>
      <input id="cmp-b" type="text" placeholder="E00002 or name" style="min-width:220px" value="${NT.esc(state.b)}">
      <button id="cmp-go" class="btn btn-primary btn-sm">Compare</button>
    </div>
    <div id="cmp-out"></div>`;

  const resolve = async (val) => {
    if (!val) return null;
    if (/^E\d+$/i.test(val)) return val;
    try {
      const res = await NT.api('/api/search?q=' + encodeURIComponent(val));
      return res.entities && res.entities.length ? res.entities[0].id : null;
    } catch (e) { return null; }
  };

  const run = async () => {
    state.a = document.getElementById('cmp-a').value.trim();
    state.b = document.getElementById('cmp-b').value.trim();
    const out = document.getElementById('cmp-out');
    if (!state.a || !state.b) { out.innerHTML = NT.empty('Enter two entity IDs or names to compare.'); return; }
    out.innerHTML = NT.loading();
    const [aid, bid] = await Promise.all([resolve(state.a), resolve(state.b)]);
    if (!aid || !bid) { out.innerHTML = NT.empty('Could not resolve one of the entities. Use IDs like E00001.'); return; }
    document.getElementById('cmp-a').value = aid;
    document.getElementById('cmp-b').value = bid;
    const [a, b] = await Promise.all([
      Promise.all([NT.api('/api/entities/' + aid), NT.api(`/api/entities/${aid}/neighbors?limit=200`)]),
      Promise.all([NT.api('/api/entities/' + bid), NT.api(`/api/entities/${bid}/neighbors?limit=200`)]),
    ]);
    const mk = (ent, nbrs) => ({
      ent, nbrs,
      inDeg: nbrs.neighbors.filter(n => n.direction === 'in').length,
      outDeg: nbrs.neighbors.filter(n => n.direction === 'out').length,
      total: nbrs.neighbors.length,
      volume: nbrs.neighbors.reduce((s, n) => s + (n.amount || 0), 0),
      flags: (ent.metadata && ent.metadata.flags) || [],
    });
    const A = mk(a[0], a[1]), B = mk(b[0], b[1]);
    const win = (av, bv, higherBetter = true) => {
      if (av === bv) return '';
      const aWins = higherBetter ? av > bv : av < bv;
      return aWins ? 'winner' : '';
    };
    const metric = (label, av, bv, fmt = (x) => x, higherBetter = true) => `
      <div class="metric-row">
        <span class="mk">${NT.esc(label)}</span>
        <span class="${win(typeof av === 'number' ? av : 0, typeof bv === 'number' ? bv : 0, higherBetter)}">${fmt(av)}</span>
      </div>`;
    out.innerHTML = `
      <div class="compare-grid">
        <div class="compare-col">
          <div class="ch">${NT.esc(A.ent.name)} ${NT.starHTML(A.ent)} ${NT.typeTag(A.ent.type)}</div>
          <div class="cb">
            ${metric('Risk score', A.ent.risk_score, B.ent.risk_score, v => v.toFixed(1))}
            ${metric('Inbound links', A.inDeg, B.inDeg)}
            ${metric('Outbound links', A.outDeg, B.outDeg)}
            ${metric('Total connections', A.total, B.total)}
            ${metric('Transaction volume', A.volume, B.volume, v => NT.money(v))}
            ${metric('Compliance flags', A.flags.length, B.flags.length)}
          </div>
        </div>
        <div class="compare-col">
          <div class="ch">${NT.esc(B.ent.name)} ${NT.starHTML(B.ent)} ${NT.typeTag(B.ent.type)}</div>
          <div class="cb">
            ${metric('Risk score', B.ent.risk_score, A.ent.risk_score, v => v.toFixed(1))}
            ${metric('Inbound links', B.inDeg, A.inDeg)}
            ${metric('Outbound links', B.outDeg, A.outDeg)}
            ${metric('Total connections', B.total, A.total)}
            ${metric('Transaction volume', B.volume, A.volume, v => NT.money(v))}
            ${metric('Compliance flags', B.flags.length, A.flags.length)}
          </div>
        </div>
      </div>
      <div class="section-title">Side-by-side profile</div>
      <div class="grid grid-2">
        ${NT.card('Entity A', `<dl class="detail-grid">
          <dt>ID</dt><dd class="mono">${NT.esc(A.ent.id)}</dd>
          <dt>Country</dt><dd>${NT.esc(A.ent.country)} · ${NT.esc(A.ent.region)}</dd>
          <dt>Last seen</dt><dd class="mono">${NT.esc((A.ent.last_seen || '').slice(0,10))}</dd>
          <dt>Flags</dt><dd>${A.flags.length ? A.flags.map(f=>`<span class="pill high">${NT.esc(f)}</span>`).join(' ') : '<span class="mute2">none</span>'}</dd>
        </dl>`)}
        ${NT.card('Entity B', `<dl class="detail-grid">
          <dt>ID</dt><dd class="mono">${NT.esc(B.ent.id)}</dd>
          <dt>Country</dt><dd>${NT.esc(B.ent.country)} · ${NT.esc(B.ent.region)}</dd>
          <dt>Last seen</dt><dd class="mono">${NT.esc((B.ent.last_seen || '').slice(0,10))}</dd>
          <dt>Flags</dt><dd>${B.flags.length ? B.flags.map(f=>`<span class="pill high">${NT.esc(f)}</span>`).join(' ') : '<span class="mute2">none</span>'}</dd>
        </dl>`)}
      </div>
      <div class="mt-16">
        <button class="btn btn-sm" onclick="NT.go('explorer',{id:'${A.ent.id}'})">A in explorer</button>
        <button class="btn btn-sm" onclick="NT.go('explorer',{id:'${B.ent.id}'})">B in explorer</button>
      </div>`;
    NT.bindStars(out);
  };

  document.getElementById('cmp-go').addEventListener('click', run);
  ['cmp-a', 'cmp-b'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  });
  if (state.a && state.b) run();
};
