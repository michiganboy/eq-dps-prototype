function secondsBetween(a, b) {
  return Math.max(0, (b.getTime() - a.getTime()) / 1000);
}

function isPlayerOrPartyDamage(event, options) {
  const playerName = options.playerName;
  const party = new Set([playerName, ...(options.party || [])]);
  return event.type === 'damage' && party.has(event.source);
}

function isCombatEvent(event) {
  return event.type === 'damage' || event.type === 'miss';
}

export function buildEncounter(events, options = {}) {
  const encounterEvents = events.filter(isCombatEvent);
  if (!encounterEvents.length) return null;
  return summarizeEvents('current', encounterEvents, options);
}

export function splitEncounters(events, options = {}) {
  const idleSeconds = options.idleSeconds ?? 10;
  const relevant = events.filter(isCombatEvent);
  const encounters = [];
  let current = [];
  for (const event of relevant) {
    if (current.length && secondsBetween(current[current.length - 1].timestamp, event.timestamp) > idleSeconds) {
      encounters.push(summarizeEvents(`encounter-${encounters.length + 1}`, current, options));
      current = [];
    }
    current.push(event);
  }
  if (current.length) encounters.push(summarizeEvents(`encounter-${encounters.length + 1}`, current, options));
  return encounters;
}

export function splitKillWindows(events, options = {}) {
  const preSeconds = options.killWindowPreSeconds ?? 30;
  const party = new Set([options.playerName, ...(options.party || [])]);
  const kills = events.filter(e => e.type === 'slain' && party.has(e.source));
  return kills.map((kill, index) => {
    const startMs = kill.timestamp.getTime() - preSeconds * 1000;
    const windowEvents = events.filter(e => e.type === 'damage' && e.timestamp.getTime() >= startMs && e.timestamp <= kill.timestamp);
    const summary = summarizeEvents(`kill-${index + 1}`, windowEvents, options);
    return { ...summary, kill: { target: kill.target, source: kill.source, timestamp: kill.timestamp, lineNumber: kill.lineNumber } };
  });
}

export function summarizeEvents(id, events, options = {}) {
  const allowedDamageSources = new Set([options.playerName, ...(options.party || [])].filter(Boolean));
  const damageEvents = events.filter(e => e.type === 'damage' && (!allowedDamageSources.size || allowedDamageSources.has(e.source)));
  const combatEvents = events.filter(isCombatEvent);
  const first = combatEvents[0] || damageEvents[0];
  const last = combatEvents[combatEvents.length - 1] || damageEvents[damageEvents.length - 1] || first;
  const startedAt = first?.timestamp ?? null;
  const endedAt = last?.timestamp ?? startedAt;
  const durationSeconds = startedAt && endedAt ? Math.max(1, secondsBetween(startedAt, endedAt)) : 1;
  const actors = new Map();
  const targets = new Set();

  for (const event of damageEvents) {
    targets.add(event.target);
    const actor = actors.get(event.source) || {
      name: event.source,
      totalDamage: 0,
      events: 0,
      crits: 0,
      ripostes: 0,
      maxHit: 0,
      firstActionAt: event.timestamp,
      lastActionAt: event.timestamp,
      damageByType: {},
      abilities: {},
    };
    actor.totalDamage += event.amount;
    actor.events += 1;
    actor.crits += event.flags?.includes('critical') ? 1 : 0;
    actor.ripostes += event.flags?.includes('riposte') ? 1 : 0;
    actor.maxHit = Math.max(actor.maxHit, event.amount);
    actor.firstActionAt = actor.firstActionAt < event.timestamp ? actor.firstActionAt : event.timestamp;
    actor.lastActionAt = actor.lastActionAt > event.timestamp ? actor.lastActionAt : event.timestamp;
    actor.damageByType[event.damageType] = (actor.damageByType[event.damageType] || 0) + event.amount;
    if (event.ability) actor.abilities[event.ability] = (actor.abilities[event.ability] || 0) + event.amount;
    actors.set(event.source, actor);
  }

  const totalDamage = [...actors.values()].reduce((sum, a) => sum + a.totalDamage, 0);
  const actorStats = [...actors.values()].map(actor => {
    const activeSeconds = Math.max(1, secondsBetween(actor.firstActionAt, actor.lastActionAt));
    return {
      ...actor,
      dps: actor.totalDamage / durationSeconds,
      activeDps: actor.totalDamage / activeSeconds,
      percent: totalDamage ? actor.totalDamage / totalDamage * 100 : 0,
    };
  }).sort((a, b) => b.totalDamage - a.totalDamage);

  return {
    id,
    startedAt,
    endedAt,
    durationSeconds,
    totalDamage,
    dps: totalDamage / durationSeconds,
    targetCount: targets.size,
    actors: actorStats,
  };
}

export function publicSummary(summary, limit = 10) {
  return {
    ...summary,
    startedAt: summary.startedAt?.toISOString(),
    endedAt: summary.endedAt?.toISOString(),
    actors: summary.actors.slice(0, limit).map(a => ({
      name: a.name,
      totalDamage: a.totalDamage,
      dps: Math.round(a.dps * 10) / 10,
      activeDps: Math.round(a.activeDps * 10) / 10,
      percent: Math.round(a.percent * 10) / 10,
      maxHit: a.maxHit,
      crits: a.crits,
      ripostes: a.ripostes,
      damageByType: a.damageByType,
    })),
  };
}
