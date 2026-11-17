/* Evidence — case detail with evidence list + add form. */
NT.views.evidence = async function (root, params) {
  if (!params.id) {
    root.innerHTML = `<div class="view-head"><h2>Evidence</h2>
      <p>Select an investigation from the Investigations tab to manage its evidence.</p></div>
      <button class="btn btn-primary btn-sm" onclick="NT.go('investigations')">Go to Investigations →</button>`;
    return;
  }
  root.innerHTML = NT.loading();
  const inv = await NT.api('/api/investigations/' + params.id);
  const ents = inv.entity_ids || [];

  root.innerHTML = `
    <div class="view-head">
      <div class="row between">
        <div><h2>${NT.esc(inv.title)}</h2>
        <p><span class="mono">${NT.esc(inv.id)}</span> · ${NT.esc(inv.status)} · ${NT.esc(inv.priority)} priority</p></div>
        <div class="row">
          <select id="ev-status">
            <option value="open">open</option><option value="in_progress">in_progress</option>
            <option value="closed">closed</option><option value="archived">archived</option>
          </select>
          <button id="ev-setstatus" class="btn btn-sm">Update status</button>
        </div>
      </div>
    </div>
    <div class="grid grid-2">
      ${NT.card('Case details', `
        <dl class="detail-grid">
          <dt>Description</dt><dd>${NT.esc(inv.description || '—')}</dd>
          <dt>Created by</dt><dd>${NT.esc(inv.created_by)}</dd>
          <dt>Created</dt><dd class="mono">${NT.esc((inv.created_at || '').slice(0, 10))}</dd>
          <dt>Updated</dt><dd class="mono">${NT.esc((inv.updated_at || '').slice(0, 10))}</dd>
          <dt>Entities</dt><dd>${ents.length ? ents.map(e => `<a class="clickable mono" onclick="NT.go('intelligence',{id:'${e}'})">${NT.esc(e)}</a>`).join(' ') : '<span class="mute2">none</span>'}</dd>
        </dl>`)}
      ${NT.card('Add evidence', `
        <div class="col">
          <select id="ev-kind"><option value="note">Note</option><option value="document">Document ref</option><option value="screenshot">Screenshot ref</option><option value="statement">Statement</option></select>
          <input id="ev-entity" type="text" placeholder="Entity ID (optional)">
          <textarea id="ev-content" rows="4" placeholder="Evidence content..."></textarea>
          <button id="ev-add" class="btn btn-primary btn-sm">Attach evidence</button>
        </div>`)}
    </div>
    <div class="section-title">Evidence log (${inv.evidence.length})</div>
    <div id="ev-list">${inv.evidence.length ? inv.evidence.map(e => `
      <div class="card mb-16">
        <div class="row between">
          <div><span class="pill neutral">${NT.esc(e.kind)}</span>
          ${e.entity_id ? `<a class="clickable mono" onclick="NT.go('intelligence',{id:'${e.entity_id}'})"> ${NT.esc(e.entity_id)}</a>` : ''}</div>
          <span class="mute2 mono">${NT.esc((e.created_at || '').slice(0, 19).replace('T', ' '))} · ${NT.esc(e.created_by)}</span>
        </div>
        <div class="mt-8">${NT.esc(e.content)}</div>
      </div>`).join('') : NT.empty('No evidence yet')}</div>`;

  document.getElementById('ev-status').value = inv.status;
  document.getElementById('ev-setstatus').addEventListener('click', async () => {
    const st = document.getElementById('ev-status').value;
    try { await NT.api(`/api/investigations/${inv.id}/status?status=${st}`, { method: 'PATCH' });
      NT.toast('Status updated', 'success'); NT.render(); }
    catch (e) { NT.toast(e.message, 'error'); }
  });
  document.getElementById('ev-add').addEventListener('click', async () => {
    const body = { investigation_id: inv.id, kind: document.getElementById('ev-kind').value,
      entity_id: document.getElementById('ev-entity').value.trim() || null,
      content: document.getElementById('ev-content').value };
    if (!body.content) { NT.toast('Content required', 'error'); return; }
    try { await NT.api('/api/investigations/evidence', { method: 'POST', body });
      NT.toast('Evidence attached', 'success'); NT.render(); }
    catch (e) { NT.toast(e.message, 'error'); }
  });
};
