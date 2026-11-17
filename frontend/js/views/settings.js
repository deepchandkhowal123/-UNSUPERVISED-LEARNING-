/* Settings — system info, regenerate data, account info. */
NT.views.settings = async function (root) {
  root.innerHTML = `<div class="view-head"><h2>Settings</h2>
    <p>System information, data management and current session details.</p></div>
    <div id="st-load">${NT.loading()}</div>`;
  const status = await NT.api('/api/system/status');

  root.innerHTML = `
    <div class="view-head"><h2>Settings</h2>
    <p>System information, data management and current session details.</p></div>
    <div class="grid grid-2">
      ${NT.card('System', `
        <dl class="detail-grid">
          <dt>Application</dt><dd>${NT.esc(status.app)} v${NT.esc(status.version)}</dd>
          <dt>Entities</dt><dd>${status.entities}</dd>
          <dt>Relationships</dt><dd>${status.relationships}</dd>
          <dt>Backend</dt><dd>FastAPI + Uvicorn</dd>
          <dt>Database</dt><dd>SQLite (networktrace.db)</dd>
          <dt>Graph engine</dt><dd>NetworkX</dd>
          <dt>ML engine</dt><dd>scikit-learn</dd>
        </dl>`)}
      ${NT.card('Current session', `
        <dl class="detail-grid">
          <dt>Username</dt><dd><strong>${NT.esc(status.user)}</strong></dd>
          <dt>Role</dt><dd>${NT.esc(status.role)}</dd>
          <dt>Display name</dt><dd>${NT.esc(NT.user.display_name)}</dd>
          <dt>Permissions</dt><dd>${NT.user.permissions.map(p => `<span class="pill neutral">${NT.esc(p)}</span>`).join(' ')}</dd>
        </dl>`)}
      ${NT.card('Appearance', `
        <p class="muted mb-16">Choose a color theme. <code>Auto</code> follows your operating system setting.</p>
        <div class="row" id="theme-opts">
          <button class="btn btn-sm" data-theme="dark">🌙 Dark</button>
          <button class="btn btn-sm" data-theme="light">☀ Light</button>
          <button class="btn btn-sm" data-theme="auto">◐ Auto</button>
        </div>`)}
      ${NT.card('Data management', `
        <p class="muted mb-16">Regenerate the synthetic dataset. This clears and rebuilds all entities and relationships, and rebuilds the graph cache. Requires <code>manage</code> permission.</p>
        <button id="st-regen" class="btn btn-primary btn-sm">Regenerate dataset</button>`)}
      ${NT.card('Demo accounts', `
        <div class="kv-list">
          <div class="kv"><span class="k">admin / admin</span><span>full access</span></div>
          <div class="kv"><span class="k">manager / manager</span><span>manage + reports</span></div>
          <div class="kv"><span class="k">investigator / investigator</span><span>cases + evidence</span></div>
          <div class="kv"><span class="k">analyst / analyst</span><span>read + search</span></div>
          <div class="kv"><span class="k">viewer / viewer</span><span>read-only</span></div>
        </div>`)}
    </div>`;

  // theme selector
  const cur = NT.theme.current();
  document.querySelectorAll('#theme-opts button').forEach(b => {
    if (b.getAttribute('data-theme') === cur) b.classList.add('btn-primary');
    b.addEventListener('click', () => {
      NT.theme.set(b.getAttribute('data-theme'));
      document.querySelectorAll('#theme-opts button').forEach(x => x.classList.remove('btn-primary'));
      b.classList.add('btn-primary');
    });
  });

  document.getElementById('st-regen').addEventListener('click', async () => {
    if (!confirm('Regenerate the entire dataset? This cannot be undone.')) return;
    try {
      document.getElementById('st-regen').disabled = true;
      document.getElementById('st-regen').textContent = 'Regenerating…';
      const r = await NT.api('/api/system/regenerate', { method: 'POST' });
      NT.toast(`Done: ${r.entities} entities, ${r.relationships} rels`, 'success');
      NT.refreshStatus();
      NT.render();
    } catch (e) { NT.toast(e.message, 'error'); }
  });
};
