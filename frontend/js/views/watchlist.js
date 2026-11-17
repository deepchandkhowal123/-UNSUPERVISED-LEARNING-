/* Watchlist — bookmarked entities (localStorage). */
NT.views.watchlist = async function (root) {
  const render = () => {
    const list = NT.watchlist.all();
    root.innerHTML = `
      <div class="view-head"><h2>Watchlist <span class="count">(${list.length})</span></h2>
      <p>Entities you are tracking. Bookmarked from entity detail pages or the entity table — stored locally in your browser.</p></div>
      ${list.length === 0 ? NT.empty('No bookmarked entities yet. Open an entity and click the ★ star, or press B on an entity detail page.') : `
      <div class="row between mb-16">
        <span class="muted">${list.length} tracked ${list.length === 1 ? 'entity' : 'entities'}</span>
        <button id="wl-clear" class="btn btn-ghost btn-sm">Clear all</button>
      </div>
      ${NT.table(
        [{ label: '', render: r => `<span class="star on" data-star="${NT.esc(r.id)}">★</span>` },
         { label: 'ID', render: r => `<span class="mono">${NT.esc(r.id)}</span>` },
         { label: 'Name', render: r => `<a class="clickable" onclick="NT.go('intelligence',{id:'${r.id}'})">${NT.esc(r.name)}</a>` },
         { label: 'Type', render: r => NT.typeTag(r.type) },
         { label: 'Country', key: 'country' },
         { label: 'Risk', render: r => NT.riskPill(r.risk_score) },
         { label: 'Added', render: r => `<span class="mono">${NT.esc((r.added_at || '').slice(0, 10))}</span>` },
         { label: '', render: r => `<button class="btn btn-sm" onclick="NT.go('intelligence',{id:'${r.id}'})">Open</button>` }],
        list)}
      <div class="mt-16">
        <button class="btn btn-primary btn-sm" onclick="NT.go('compare',{ids:'${list.slice(0,2).map(e=>e.id).join(',')}')">Compare top 2 →</button>
      </div>`}`;
    const clearBtn = document.getElementById('wl-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (confirm('Clear the entire watchlist?')) {
        localStorage.removeItem('nt_watchlist');
        NT.refreshWatchBadge();
        render();
        NT.toast('Watchlist cleared', 'info');
      }
    });
    NT.bindStars(root);
  };
  render();
};
