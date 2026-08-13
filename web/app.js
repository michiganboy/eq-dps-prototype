let scope = 'currentEncounter';
const labels = { currentEncounter: 'Current', lastKill: 'Last Kill', session: 'Session', highScores: 'High Scores' };

document.getElementById('scopeCurrent').onclick = () => { scope = 'currentEncounter'; refresh(); };
document.getElementById('scopeKill').onclick = () => { scope = 'lastKill'; refresh(); };
document.getElementById('scopeSession').onclick = () => { scope = 'session'; refresh(); };
document.getElementById('scopeHigh').onclick = () => { scope = 'highScores'; refresh(); };

function n(value) { return Math.round(value || 0).toLocaleString(); }
function dps(value) { return Number(value || 0).toFixed(1); }
function dur(value) { return `${Math.round(value || 0)}s`; }
function time(value) { return value ? value.slice(11, 19) : 'n/a'; }

async function refresh() {
  const state = await fetch('/api/state').then(r => r.json());
  if (scope === 'highScores') {
    renderHighScores(state);
    return;
  }
  const summary = state[scope];
  document.getElementById('scope').textContent = labels[scope];
  document.getElementById('meta').textContent = `${state.options.playerName} + ${state.options.party.join(', ')} | ${state.eventCount} events | ${new Date(state.generatedAt).toLocaleTimeString()}`;
  if (!summary) {
    document.getElementById('total').textContent = '0';
    document.getElementById('dps').textContent = '0.0';
    document.getElementById('duration').textContent = '0s';
    document.getElementById('rows').innerHTML = '<tr><td class="empty" colspan="5">No combat parsed yet</td></tr>';
    return;
  }
  document.getElementById('total').textContent = n(summary.totalDamage);
  document.getElementById('dps').textContent = dps(summary.dps);
  document.getElementById('duration').textContent = dur(summary.durationSeconds);
  const suffix = scope === 'lastKill' && summary.kill ? ` | killed ${summary.kill.target}` : '';
  document.getElementById('meta').textContent += ` | ${time(summary.startedAt)}-${time(summary.endedAt)}${suffix}`;
  document.getElementById('rows').innerHTML = summary.actors.slice(0, 8).map(a => `
    <tr>
      <td>${escapeHtml(a.name)}</td>
      <td>${n(a.totalDamage)}</td>
      <td>${dps(a.dps)}</td>
      <td>${dps(a.percent)}</td>
      <td>${n(a.maxHit)}</td>
    </tr>
  `).join('') || '<tr><td class="empty" colspan="5">No damage in this scope</td></tr>';
}

function renderHighScores(state) {
  const board = state.highScores?.records;
  const bestEncounter = board?.encounterDps?.[0];
  const bestKill = board?.killDps?.[0];
  const bestSession = board?.sessionDamage?.[0];
  document.getElementById('scope').textContent = labels.highScores;
  document.getElementById('meta').textContent = `Stored in ${state.highScores?.store || 'memory'} | updated ${state.highScores?.updatedAt ? new Date(state.highScores.updatedAt).toLocaleTimeString() : 'n/a'}`;
  document.getElementById('total').textContent = bestSession ? n(bestSession.totalDamage) : '0';
  document.getElementById('dps').textContent = bestEncounter ? dps(bestEncounter.dps) : '0.0';
  document.getElementById('duration').textContent = bestKill ? dps(bestKill.dps) : '0.0';

  const rows = [];
  if (bestEncounter) rows.push(`<tr><td>Best Encounter</td><td>${n(bestEncounter.totalDamage)}</td><td>${dps(bestEncounter.dps)}</td><td>${bestEncounter.topActors?.[0]?.name || '-'}</td><td>${time(bestEncounter.endedAt)}</td></tr>`);
  if (bestKill) rows.push(`<tr><td>Best Kill: ${escapeHtml(bestKill.target || '-')}</td><td>${n(bestKill.totalDamage)}</td><td>${dps(bestKill.dps)}</td><td>${bestKill.topActors?.[0]?.name || '-'}</td><td>${time(bestKill.endedAt)}</td></tr>`);
  for (const [name, best] of Object.entries(board?.playerBest || {})) {
    rows.push(`<tr><td>${escapeHtml(name)} PB DPS</td><td>${n(best.bestDps?.totalDamage)}</td><td>${dps(best.bestDps?.dps)}</td><td>Max ${n(best.bestHit?.maxHit)}</td><td>${time(best.bestDps?.endedAt)}</td></tr>`);
  }
  document.getElementById('rows').innerHTML = rows.join('') || '<tr><td class="empty" colspan="5">No high scores yet</td></tr>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

refresh();
setInterval(refresh, 2000);
