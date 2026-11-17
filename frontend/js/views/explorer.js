/* Network Explorer v2 — interactive force-directed graph with zoom/pan/drag + controls. */
NT.views.explorer = async function (root, params) {
  root.innerHTML = `
    <div class="view-head"><h2>Network Explorer</h2>
    <p>Interactive force-directed visualization. Scroll to zoom, drag the background to pan, drag a node to reposition, click a node to inspect it.</p></div>
    <div class="filters">
      <label class="muted">Focal entity:</label>
      <input id="ex-entity" type="text" placeholder="E00001 or name" style="min-width:240px;width:240px" value="${NT.esc(params.id || 'E00001')}">
      <label class="muted">Depth:</label>
      <select id="ex-depth"><option value="1">1 hop</option><option value="2" selected>2 hops</option><option value="3">3 hops</option></select>
      <label class="muted">Limit:</label>
      <select id="ex-limit"><option value="80">80</option><option value="120" selected>120</option><option value="200">200</option></select>
      <button id="ex-go" class="btn btn-primary btn-sm">${NT.svg('play', 14)} Render</button>
    </div>
    <div class="graph-controls">
      <button id="ex-zin" class="btn btn-ghost btn-sm" title="Zoom in">${NT.svg('zoom-in', 14)} Zoom in</button>
      <button id="ex-zout" class="btn btn-ghost btn-sm" title="Zoom out">${NT.svg('zoom-out', 14)} Zoom out</button>
      <button id="ex-reset" class="btn btn-ghost btn-sm" title="Reset view">${NT.svg('refresh', 14)} Reset</button>
      <button id="ex-labels" class="btn btn-ghost btn-sm" title="Toggle labels">${NT.svg('users', 14)} Labels</button>
      <span id="ex-info" class="gc-info"></span>
    </div>
    <div class="graph-wrap">
      <canvas id="ex-canvas" class="graph-canvas"></canvas>
      <div class="graph-hint">scroll = zoom · drag bg = pan · drag node = move · click = inspect</div>
    </div>
    <div class="graph-legend" id="ex-legend"></div>`;

  const cv = document.getElementById('ex-canvas');
  let gc = null;
  const render = async () => {
    let eid = document.getElementById('ex-entity').value.trim();
    const depth = +document.getElementById('ex-depth').value;
    const limit = +document.getElementById('ex-limit').value;
    if (eid && !/^E\d+$/i.test(eid)) {
      try {
        const res = await NT.api('/api/search?q=' + encodeURIComponent(eid) + '&size=1');
        if (res.entities && res.entities.length) eid = res.entities[0].id;
        else { document.getElementById('ex-info').textContent = 'No match for "' + eid + '"'; return; }
      } catch (e) { document.getElementById('ex-info').textContent = e.message; return; }
    }
    document.getElementById('ex-entity').value = eid;
    let data;
    try { data = await NT.api(`/api/entities/${eid}/subgraph?depth=${depth}&limit=${limit}`); }
    catch (e) { document.getElementById('ex-info').textContent = 'Error: ' + e.message; return; }
    cv.width = cv.clientWidth; cv.height = cv.clientHeight;
    gc = new NT.GraphCanvas(cv);
    document.getElementById('ex-info').textContent = `${data.nodes.length} nodes · ${data.edges.length} edges · zoom ${Math.round(gc.scale * 100)}%`;
    const types = [...new Set(data.nodes.map(n => n.type))];
    document.getElementById('ex-legend').innerHTML = types.map(t =>
      `<span><span class="dot" style="background:${gc.colors[t] || gc.colors.default}"></span>${NT.esc(t)}</span>`).join('');
    gc.setData(data.nodes, data.edges);
    gc.onSelect = (id) => NT.go('intelligence', { id });
  };
  document.getElementById('ex-go').addEventListener('click', render);
  document.getElementById('ex-entity').addEventListener('keydown', (e) => { if (e.key === 'Enter') render(); });
  document.getElementById('ex-zin').addEventListener('click', () => { gc && gc.zoomBy(1.25); });
  document.getElementById('ex-zout').addEventListener('click', () => { gc && gc.zoomBy(1 / 1.25); });
  document.getElementById('ex-reset').addEventListener('click', () => { gc && gc.resetView(); });
  document.getElementById('ex-labels').addEventListener('click', () => { gc && gc.toggleLabels(); });
  try { await render(); }
  catch (e) { document.getElementById('ex-info').textContent = 'Error: ' + e.message; }
};
