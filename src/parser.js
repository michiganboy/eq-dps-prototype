const HEADER = /^\[(?<stamp>[^\]]+)\] (?<message>.*)$/;
const VERBS = 'hit|hits|slash|slashes|crush|crushes|pierce|pierces|kick|kicks|bash|bashes|cleave|cleaves|smite|smites|strike|strikes|claw|claws|bite|bites|punch|punches|backstab|backstabs|maul|mauls';

const DAMAGE_PATTERNS = [
  {
    kind: 'spell',
    re: /^You hit (?<target>.+?) for (?<amount>\d+) points? of (?<school>\w+) damage by (?<ability>.+?)\.(?<suffix> \(.*\))?$/,
    map: (g, playerName) => ({ source: playerName, target: g.target, amount: Number(g.amount), damageType: 'spell', ability: g.ability, flags: flags(g.suffix) }),
  },
  {
    kind: 'spell',
    re: /^(?<source>.+?) hit (?<target>.+?) for (?<amount>\d+) points? of (?<school>\w+) damage by (?<ability>.+?)\.(?<suffix> \(.*\))?$/,
    map: (g, playerName) => ({ source: normalize(g.source, playerName), target: normalize(g.target, playerName), amount: Number(g.amount), damageType: 'spell', ability: g.ability, flags: flags(g.suffix) }),
  },
  {
    kind: 'dot',
    re: /^You have taken (?<amount>\d+) damage from (?<ability>.+?) by (?<source>.+?)\.$/,
    map: (g, playerName) => ({ source: normalize(g.source, playerName), target: playerName, amount: Number(g.amount), damageType: 'dot', ability: g.ability, flags: [] }),
  },
  {
    kind: 'dot',
    re: /^(?<target>.+?) has taken (?<amount>\d+) damage from (?<ability>.+?) by (?<source>.+?)\.$/,
    map: (g, playerName) => ({ source: normalize(g.source, playerName), target: normalize(g.target, playerName), amount: Number(g.amount), damageType: 'dot', ability: g.ability, flags: [] }),
  },
  {
    kind: 'damage_shield',
    re: /^(?<target>.+?) is burned by YOUR flames for (?<amount>\d+) points? of non-melee damage\.$/,
    map: (g, playerName) => ({ source: playerName, target: g.target, amount: Number(g.amount), damageType: 'damage_shield', ability: 'YOUR flames', flags: [] }),
  },
  {
    kind: 'damage_shield',
    re: /^(?<target>.+?) is pierced by (?<source>.+?)'s thorns for (?<amount>\d+) points? of non-melee damage\.$/,
    map: (g, playerName) => ({ source: normalize(g.source, playerName), target: g.target, amount: Number(g.amount), damageType: 'damage_shield', ability: 'thorns', flags: [] }),
  },
  {
    kind: 'melee',
    re: new RegExp(`^You (?<ability>${VERBS}) (?<target>.+?) for (?<amount>\\d+) points? of damage\\.(?<suffix> \\(.*\\))?$`),
    map: (g, playerName) => ({ source: playerName, target: g.target, amount: Number(g.amount), damageType: 'melee', ability: g.ability, flags: flags(g.suffix) }),
  },
  {
    kind: 'melee',
    re: new RegExp(`^(?<source>.+?) (?<ability>${VERBS}) (?<target>.+?) for (?<amount>\\d+) points? of damage\\.(?<suffix> \\(.*\\))?$`),
    map: (g, playerName) => ({ source: normalize(g.source, playerName), target: normalize(g.target, playerName), amount: Number(g.amount), damageType: 'melee', ability: g.ability, flags: flags(g.suffix) }),
  },
];

const MISS_PATTERNS = [
  /^You try to (?<ability>\w+) (?<target>.+?), but (?<result>.+?)!/, 
  /^(?<source>.+?) tries to (?<ability>\w+) (?<target>.+?), but (?<result>.+?)!/, 
];

const SLAIN_PATTERNS = [
  /^You have slain (?<target>.+?)!$/,
  /^(?<target>.+?) has been slain by (?<source>.+?)!$/,
];

function flags(suffix = '') {
  const text = suffix || '';
  const out = [];
  if (/Critical/i.test(text)) out.push('critical');
  if (/Riposte/i.test(text)) out.push('riposte');
  return out;
}

function normalize(value, playerName) {
  if (value === 'You' || value === 'YOU' || value === 'you') return playerName;
  return value;
}

export function parseTimestamp(stamp) {
  const m = /^(?<dow>\w+) (?<mon>\w+)\s+(?<day>\d+) (?<time>\d\d:\d\d:\d\d) (?<year>\d{4})$/.exec(stamp);
  if (!m) throw new Error(`Unsupported timestamp: ${stamp}`);
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const [hh, mm, ss] = m.groups.time.split(':').map(Number);
  return new Date(Date.UTC(Number(m.groups.year), months[m.groups.mon], Number(m.groups.day), hh, mm, ss));
}

export function parseLogLine(line, lineNumber, options = {}) {
  const playerName = options.playerName || 'You';
  const header = HEADER.exec(line);
  if (!header) return null;
  const timestamp = parseTimestamp(header.groups.stamp);
  const message = header.groups.message;

  for (const pattern of DAMAGE_PATTERNS) {
    const m = pattern.re.exec(message);
    if (!m) continue;
    const event = pattern.map(m.groups, playerName);
    return { type: 'damage', timestamp, lineNumber, raw: message, ...event };
  }

  for (const re of MISS_PATTERNS) {
    const m = re.exec(message);
    if (!m) continue;
    return { type: 'miss', timestamp, lineNumber, raw: message, source: normalize(m.groups.source || 'You', playerName), target: normalize(m.groups.target, playerName), ability: m.groups.ability, result: m.groups.result };
  }

  for (const re of SLAIN_PATTERNS) {
    const m = re.exec(message);
    if (!m) continue;
    return { type: 'slain', timestamp, lineNumber, raw: message, target: m.groups.target, source: normalize(m.groups.source || 'You', playerName) };
  }

  return null;
}

export function parseLogText(text, options = {}) {
  return text.split(/\r?\n/).map((line, i) => parseLogLine(line, i + 1, options)).filter(Boolean);
}
