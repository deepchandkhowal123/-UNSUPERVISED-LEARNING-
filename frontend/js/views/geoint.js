/* GeoINT — country-level entity and risk distribution. */
NT.views.geoint = async function (root) {
  root.innerHTML = `<div class="view-head"><h2>GeoINT</h2>
    <p>Geographic distribution of tracked entities by country, with average risk and high-risk concentration per jurisdiction.</p></div>
    <div id="gi-load">${NT.loading()}</div>`;
  const data = await NT.api('/api/analytics/geo');
  const items = data.items;
  const maxEnt = Math.max(...items.map(i => i.entities), 1);
  const total = items.reduce((s, i) => s + i.entities, 0);
  const totalHigh = items.reduce((s, i) => s + i.high_risk, 0);

  const bars = items.map(it => {
    const pct = (it.entities / maxEnt) * 100;
    const riskColor = it.avg_risk >= 55 ? '#ef4444' : it.avg_risk >= 35 ? '#eab308' : '#22c55e';
    return `<tr><td><strong>${NT.esc(it.country)}</strong></td>
      <td><div class="bar" style="width:180px"><span style="width:${pct}%;background:${riskColor}"></span></div></td>
      <td class="t-num">${it.entities} (${((it.entities / total) * 100).toFixed(1)}%)</td>
      <td class="t-num">${NT.riskPill(it.avg_risk)}</td>
      <td class="t-num">${it.high_risk}</td>
      <td><button class="btn btn-sm" onclick="NT.go('entities',{country:'${it.country}'})">View →</button></td>
    </tr>`;
  }).join('');

  root.querySelector('#gi-load').innerHTML = `
    <div class="grid grid-4 mb-16">
      ${NT.statCard(NT.svg('map', 20), 'Countries', items.length)}
      ${NT.statCard(NT.svg('users', 20), 'Total entities', total)}
      ${NT.statCard(NT.svg('alert', 20), 'High-risk', totalHigh)}
      ${NT.statCard(NT.svg('gauge', 20), 'Top jurisdiction', items[0] ? items[0].country : '—')}
    </div>
    <div class="section-title">Country breakdown</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Country</th><th>Distribution</th><th class="t-num">Entities</th>
      <th class="t-num">Avg risk</th><th class="t-num">High-risk</th><th></th></tr></thead>
      <tbody>${bars}</tbody>
    </table></div>`;
};
