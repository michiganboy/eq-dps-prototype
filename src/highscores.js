import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_STORE = path.resolve(process.cwd(), 'data/highscores.json');

export function defaultHighScoreStore() {
  return process.env.EQ_DPS_HIGHSCORES || DEFAULT_STORE;
}

export function loadHighScores(file = defaultHighScoreStore()) {
  if (!fs.existsSync(file)) return emptyBoard();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return normalizeBoard(parsed);
  } catch {
    return emptyBoard();
  }
}

export function saveHighScores(board, file = defaultHighScoreStore()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(normalizeBoard(board), null, 2));
}

export function emptyBoard() {
  return {
    version: 1,
    updatedAt: null,
    records: {
      encounterDps: [],
      killDps: [],
      sessionDamage: [],
      playerBest: {},
    },
  };
}

export function normalizeBoard(board) {
  const clean = emptyBoard();
  clean.version = board?.version || 1;
  clean.updatedAt = board?.updatedAt || null;
  clean.records.encounterDps = Array.isArray(board?.records?.encounterDps) ? board.records.encounterDps : [];
  clean.records.killDps = Array.isArray(board?.records?.killDps) ? board.records.killDps : [];
  clean.records.sessionDamage = Array.isArray(board?.records?.sessionDamage) ? board.records.sessionDamage : [];
  clean.records.playerBest = board?.records?.playerBest && typeof board.records.playerBest === 'object' ? board.records.playerBest : {};
  return clean;
}

export function updateHighScores(board, summaries, options = {}) {
  const limit = options.limit ?? 10;
  const sourceFile = options.sourceFile || null;
  const updated = normalizeBoard(board);
  const now = new Date().toISOString();
  let changed = false;

  for (const encounter of summaries.encounters || []) {
    changed = addRecord(updated.records.encounterDps, recordFromSummary(encounter, 'encounter', sourceFile), limit, 'dps') || changed;
  }

  for (const kill of summaries.kills || []) {
    changed = addRecord(updated.records.killDps, recordFromSummary(kill, 'kill', sourceFile), limit, 'dps') || changed;
  }

  if (summaries.session) {
    changed = addRecord(updated.records.sessionDamage, recordFromSummary(summaries.session, 'session', sourceFile), limit, 'totalDamage') || changed;
  }

  for (const summary of [summaries.session, ...(summaries.encounters || []), ...(summaries.kills || [])].filter(Boolean)) {
    for (const actor of summary.actors || []) {
      const current = updated.records.playerBest[actor.name] || { bestDps: null, bestDamage: null, bestHit: null };
      const bestDps = actor.dps > (current.bestDps?.dps ?? -1) ? actorRecord(actor, summary, 'dps', sourceFile) : current.bestDps;
      const bestDamage = actor.totalDamage > (current.bestDamage?.totalDamage ?? -1) ? actorRecord(actor, summary, 'damage', sourceFile) : current.bestDamage;
      const bestHit = actor.maxHit > (current.bestHit?.maxHit ?? -1) ? actorRecord(actor, summary, 'hit', sourceFile) : current.bestHit;
      if (bestDps !== current.bestDps || bestDamage !== current.bestDamage || bestHit !== current.bestHit) changed = true;
      updated.records.playerBest[actor.name] = { bestDps, bestDamage, bestHit };
    }
  }

  if (changed) updated.updatedAt = now;
  return { board: updated, changed };
}

function recordFromSummary(summary, scope, sourceFile) {
  return {
    id: stableId(scope, summary),
    scope,
    target: summary.kill?.target || null,
    totalDamage: summary.totalDamage,
    dps: round1(summary.dps),
    durationSeconds: Math.round(summary.durationSeconds),
    startedAt: toIso(summary.startedAt),
    endedAt: toIso(summary.endedAt),
    sourceFile,
    topActors: (summary.actors || []).slice(0, 5).map(a => ({ name: a.name, totalDamage: a.totalDamage, dps: round1(a.dps), percent: round1(a.percent), crits: a.crits, maxHit: a.maxHit })),
  };
}

function actorRecord(actor, summary, metric, sourceFile) {
  return {
    metric,
    scope: summary.kill ? 'kill' : summary.id === 'session' ? 'session' : 'encounter',
    target: summary.kill?.target || null,
    name: actor.name,
    totalDamage: actor.totalDamage,
    dps: round1(actor.dps),
    activeDps: round1(actor.activeDps),
    maxHit: actor.maxHit,
    crits: actor.crits,
    startedAt: toIso(summary.startedAt),
    endedAt: toIso(summary.endedAt),
    sourceFile,
  };
}

function addRecord(records, candidate, limit, sortKey) {
  if (!candidate || !Number.isFinite(candidate[sortKey])) return false;
  if (records.some(r => r.id === candidate.id)) return false;
  records.push(candidate);
  records.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
  records.splice(limit);
  return true;
}

function stableId(scope, summary) {
  return [scope, toIso(summary.startedAt), toIso(summary.endedAt), summary.kill?.target || '', summary.totalDamage].join('|');
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function round1(value) {
  return Math.round((value || 0) * 10) / 10;
}
