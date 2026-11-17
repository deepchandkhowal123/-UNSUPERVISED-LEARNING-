/* Entity Intelligence v2 — filters, type chips, saved searches, sortable, bulk tag. */
NT.views.entities = async function (root, params) {
  const state = { page: 1, size: 25, type: params.type || '', country: '',
                  minRisk: '', maxRisk: '', q: params.q || '', sort: 'risk_score', order: 'desc',
                  requestId: 0 };
  const canManage = NT.user && NT.user.permissions.includes('manage');
  const countries = ['US', 'GB', 'AE', 'SG', 'HK', 'CY', 'SC', 'PA', 'MT', 'CH', 'DE', 'CN', 'RU', 'IN', 'BR'];

  root.innerHTML = `
    <div class="view-head"><h2>Entity Intelligence</h2>
    <p>Browse, filter and tag all tracked entities. Save reusable searches, sort columns, and bulk-update risk.</p></div>
    <div class="filters">
      <div class="search-wrap" style="max-width:240px;margin:0">
        <svg class="search-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="en-q" type="text" placeholder="Search name / ID" value="${NT.esc(state.q)}">
      </div>
      <select id="en-type"><option value="">All types</option></select>
      <select id="en-country"><option value="">All countries</option></select>
      <input id="en-min" type="number" min="0" max="100" step="0.1" aria-label="Minimum risk score (0 to 100)" placeholder="Min risk" style="width:90px">
      <input id="en-max" type="number" min="0" max="100" step="0.1" aria-label="Maximum risk score (0 to 100)" placeholder="Max risk" style="width:90px">
      <select id="en-sort">
        <option value="risk_score">Risk</option><option value="name">Name</option>
        <option value="created_at">Created</option><option value="last_seen">Last seen</option>
      </select>
      <button id="en-go" class="btn btn-primary btn-sm">${NT.svg('filter', 14)} Apply</button>
      <button id="en-reset" class="btn btn-ghost btn-sm">Reset</button>
      <button id="en-save" class="btn btn-ghost btn-sm" title="Save current search">${NT.svg('save', 14)} Save</button>
      <select id="en-saved" title="Saved searches" style="width:160px"><option value="">Saved searches…</option></select>
    </div>
    <div id="en-chips" class="chip-row mb-16"></div>
    <div id="en-bulk" class="card" style="display:none;margin-bottom:12px"></div>
    <div id="en-table">${NT.loading()}</div>`;

  const types = await NT.api('/api/entities/types/summary');
  document.getElementById('en-type').innerHTML = '<option value="">All types</option>' +
    types.map(t => `<option value="${t.type}">${NT.esc(t.type)} (${t.n})</option>`).join('');
  document.getElementById('en-country').innerHTML = '<option value="">All countries</option>' +
    countries.map(c => `<option value="${c}">${c}</option>`).join('');

  // type chips
  const chips = document.getElementById('en-chips');
  const renderChips = () => {
    chips.innerHTML = types.map(t =>
      `<span class="chip-btn ${state.type === t.type ? 'active' : ''}" data-type="${t.type}">${NT.esc(t.type)} <em style="font-style:normal;opacity:.7">${t.n}</em></span>`).join('');
    chips.querySelectorAll('.chip-btn').forEach(c => {
      c.addEventListener('click', () => {
        state.type = state.type === c.dataset.type ? '' : c.dataset.type;
        document.getElementById('en-type').value = state.type;
        state.page = 1; renderChips(); load();
      });
    });
  };
  renderChips();

  // saved searches
  const loadSaved = async () => {
    try {
      const list = await NT.savedSearches.list();
      const sel = document.getElementById('en-saved');
      sel.innerHTML = '<option value="">Saved searches…</option>' +
        list.map(s => `<option value="${s.id}" data-filters='${NT.esc(s.filters || "")}' data-query="${NT.esc(s.query || "")}">${NT.esc(s.name)}</option>`).join('');
      sel.onchange = (e) => {
        const opt = e.target.selectedOptions[0];
        if (!opt || !opt.value) return;
        try {
          const f = JSON.parse(opt.dataset.filters || '{}');
          state.q = opt.dataset.query || f.q || '';
          state.type = f.type || ''; state.country = f.country || '';
          state.minRisk = f.minRisk || ''; state.maxRisk = f.maxRisk || '';
          state.sort = f.sort || 'risk_score'; state.page = 1;
          syncInputs(); renderChips(); load();
        } catch (err) { NT.toast('Invalid saved search', 'error'); }
      };
    } catch (e) {}
  };
  loadSaved();

  const syncInputs = () => {
    document.getElementById('en-q').value = state.q;
    document.getElementById('en-type').value = state.type;
    document.getElementById('en-country').value = state.country;
    document.getElementById('en-min').value = state.minRisk;
    document.getElementById('en-max').value = state.maxRisk;
    document.getElementById('en-sort').value = state.sort;
  };

  const selected = new Set();
  const load = async () => {
    const requestId = ++state.requestId;
    const table = document.getElementById('en-table');
    if (!table) return;
    const p = new URLSearchParams();
    const filters = {
      page: state.page,
      size: state.size,
      type: state.type,
      country: state.country,
      min_risk: state.minRisk,
      max_risk: state.maxRisk,
      q: state.q,
      sort: state.sort,
      order: state.order,
    };
    Object.entries(filters).forEach(([k, v]) => { if (v !== '') p.set(k, v); });
    p.set('size', state.size);
    table.innerHTML = NT.loading();
    let data;
    try {
      data = await NT.api('/api/entities?' + p.toString());
    } catch (e) {
      if (requestId !== state.requestId || !root.contains(table)) return;
      table.innerHTML = `<div class="empty">${NT.svg('alert', 30)}<p>${NT.esc(e.message)}</p>
        <button id="en-retry" class="btn btn-sm">Retry</button></div>`;
      table.querySelector('#en-retry').addEventListener('click', load);
      return;
    }
    if (requestId !== state.requestId || !root.contains(table)) return;
    const rows = data.items;
    selected.clear();
    table.innerHTML = NT.table(
      [{ label: canManage ? `<input type="checkbox" id="en-all">` : '', render: r => canManage ? `<input type="checkbox" class="en-sel" data-id="${r.id}">` : '' },
       { label: '', render: r => NT.starHTML(r) },
       { label: 'ID', render: r => `<span class="mono">${NT.esc(r.id)}</span>` },
       { label: 'Name', render: r => `<a class="clickable" onclick="NT.go('intelligence',{id:'${r.id}'})">${NT.esc(r.name)}</a>`, key: 'name', sortable: true },
       { label: 'Type', render: r => NT.typeTag(r.type) },
       { label: 'Country', key: 'country', sortable: true },
       { label: 'Risk', render: r => `${NT.riskPill(r.risk_score)}<div class="bar tight" style="margin-top:3px"><span style="width:${Math.round(r.risk_score || 0)}%"></span></div>` },
       { label: 'Last seen', render: r => `<span class="mono">${NT.esc((r.last_seen || '').slice(0, 10))}</span>`, key: 'last_seen', sortable: true }],
      rows) + `
      ${data.pages ? `<div class="pagination">
        <button class="btn btn-sm" ${state.page <= 1 ? 'disabled' : ''} onclick="NT._enPage(${state.page - 1})">‹ Prev</button>
        <span class="mute2">Page ${state.page} of ${data.pages} · ${data.total} total</span>
        <button class="btn btn-sm" ${state.page >= data.pages ? 'disabled' : ''} onclick="NT._enPage(${state.page + 1})">Next ›</button>
      </div>` : ''}`;
    // sortable
    root.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        state.sort = key; state.order = state.sort === key && state.order === 'desc' ? 'asc' : 'desc';
        document.getElementById('en-sort').value = state.sort;
        load();
      });
    });
    // row checkboxes
    const allBox = document.getElementById('en-all');
    if (allBox) allBox.addEventListener('change', () => {
      root.querySelectorAll('.en-sel').forEach(cb => { cb.checked = allBox.checked; selected[allBox.checked ? 'add' : 'delete'](cb.dataset.id); });
      renderBulk();
    });
    root.querySelectorAll('.en-sel').forEach(cb => cb.addEventListener('change', () => {
      cb.checked ? selected.add(cb.dataset.id) : selected.delete(cb.dataset.id);
      renderBulk();
    }));
    renderBulk();
  };
  NT._enPage = (p) => { state.page = p; load(); };

  const renderBulk = () => {
    const box = document.getElementById('en-bulk');
    if (!canManage || selected.size === 0) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.innerHTML = `<div class="row between">
      <span><strong>${selected.size}</strong> selected</span>
      <div class="row">
        <input id="en-bulk-risk" type="number" min="0" max="100" placeholder="Set risk 0–100" style="width:150px">
        <button id="en-bulk-go" class="btn btn-primary btn-sm">${NT.svg('tag', 14)} Apply tag</button>
      </div></div>`;
    document.getElementById('en-bulk-go').addEventListener('click', async () => {
      const risk = parseFloat(document.getElementById('en-bulk-risk').value);
      if (isNaN(risk)) { NT.toast('Enter a risk value 0–100', 'error'); return; }
      try {
        const r = await NT.api('/api/entities/bulk/tag', { method: 'POST', body: { entity_ids: [...selected], risk_score: risk } });
        NT.toast(`Updated ${r.updated} entities`, 'success');
        load();
      } catch (e) { NT.toast(e.message, 'error'); }
    });
  };

  document.getElementById('en-go').addEventListener('click', () => {
    const minRisk = document.getElementById('en-min').value;
    const maxRisk = document.getElementById('en-max').value;
    if ([minRisk, maxRisk].some(value => value !== '' && (Number(value) < 0 || Number(value) > 100))) {
      NT.toast('Risk scores must be between 0 and 100', 'error');
      return;
    }
    if (minRisk !== '' && maxRisk !== '' && Number(minRisk) > Number(maxRisk)) {
      NT.toast('Minimum risk cannot exceed maximum risk', 'error');
      return;
    }
    state.q = document.getElementById('en-q').value.trim();
    state.type = document.getElementById('en-type').value;
    state.country = document.getElementById('en-country').value;
    state.minRisk = minRisk;
    state.maxRisk = maxRisk;
    state.sort = document.getElementById('en-sort').value;
    state.page = 1; renderChips(); load();
  });
  document.getElementById('en-reset').addEventListener('click', () => {
    Object.assign(state, { page: 1, type: '', country: '', minRisk: '', maxRisk: '', q: '', sort: 'risk_score' });
    syncInputs(); renderChips(); load();
  });
  document.getElementById('en-save').addEventListener('click', async () => {
    const name = prompt('Name this search:', state.type ? state.type + ' filter' : 'my search');
    if (!name) return;
    const filters = JSON.stringify({ type: state.type, country: state.country, minRisk: state.minRisk, maxRisk: state.maxRisk, sort: state.sort });
    try {
      await NT.savedSearches.save(name, state.q, filters);
      NT.toast('Search saved', 'success');
      loadSaved();
    } catch (e) { NT.toast(e.message, 'error'); }
  });
  document.getElementById('en-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('en-go').click(); });
  await load();
};
