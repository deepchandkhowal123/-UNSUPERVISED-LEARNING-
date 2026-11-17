/* Investigations — case management. */
NT.views.investigations = async function (root) {
  root.innerHTML = `
    <div class="view-head">
      <div class="row between">
        <div><h2>Investigations</h2>
        <p>Active case files. Create new investigations, track status, and attach evidence and entities.</p></div>
        <button id="inv-new" class="btn btn-primary btn-sm">+ New case</button>
      </div>
    </div>
    <div id="inv-list">${NT.loading()}</div>`;

  const load = async () => {
    const data = await NT.api('/api/investigations?size=50');
    document.getElementById('inv-list').innerHTML = NT.table(
      [{ label: 'ID', render: r => `<span class="mono">${NT.esc(r.id)}</span>` },
       { label: 'Title', render: r => `<a class="clickable" onclick="NT.openInv('${r.id}')">${NT.esc(r.title)}</a>` },
       { label: 'Status', render: r => `<span class="pill ${r.status === 'closed' ? 'low' : r.status === 'in_progress' ? 'medium' : 'neutral'}">${NT.esc(r.status)}</span>` },
       { label: 'Priority', render: r => `<span class="pill ${r.priority === 'high' ? 'high' : 'neutral'}">${NT.esc(r.priority)}</span>` },
       { label: 'Entities', render: r => (JSON.parse(r.entity_ids || '[]')).length, num: true },
       { label: 'Created', render: r => `<span class="mono">${NT.esc((r.created_at || '').slice(0, 10))}</span>` },
       { label: 'By', key: 'created_by' }],
      data.items);
  };
  NT.openInv = (id) => NT.go('evidence', { id });

  document.getElementById('inv-new').addEventListener('click', async () => {
    const title = prompt('Case title:');
    if (!title) return;
    const priority = prompt('Priority (low/medium/high):', 'medium') || 'medium';
    try {
      await NT.api('/api/investigations', { method: 'POST', body: { title, priority } });
      NT.toast('Case created', 'success');
      load();
    } catch (e) { NT.toast('Failed: ' + e.message, 'error'); }
  });
  await load();
};
