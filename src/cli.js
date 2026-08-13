#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseLogText } from './parser.js';
import { splitEncounters, splitKillWindows, summarizeEvents, publicSummary } from './encounters.js';
import { defaultHighScoreStore, loadHighScores, saveHighScores, updateHighScores } from './highscores.js';

function usage() {
  console.error('Usage: node src/cli.js parse <eqlog.txt> [--player Dredd] [--party Drazzin] [--idle 10] [--json] [--no-highscores]');
  process.exit(1);
}

function parseArgs(argv) {
  const args = { command: argv[2], file: argv[3], playerName: 'Dredd', party: [], idleSeconds: 10, json: false, highScores: true };
  for (let i = 4; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--player') args.playerName = argv[++i];
    else if (arg === '--party') args.party = argv[++i].split(',').filter(Boolean);
    else if (arg === '--idle') args.idleSeconds = Number(argv[++i]);
    else if (arg === '--json') args.json = true;
    else if (arg === '--no-highscores') args.highScores = false;
    else usage();
  }
  return args;
}

function fmtTime(iso) {
  return iso ? iso.slice(11, 19) : 'n/a';
}

function printTable(title, summary) {
  console.log(`\n${title}`);
  console.log(`${fmtTime(summary.startedAt)}-${fmtTime(summary.endedAt)}  ${Math.round(summary.durationSeconds)}s  ${summary.totalDamage.toLocaleString()} dmg  ${summary.dps.toFixed(1)} DPS  targets:${summary.targetCount}`);
  console.log('Name'.padEnd(24), 'Damage'.padStart(10), 'DPS'.padStart(8), 'ActDPS'.padStart(8), '%'.padStart(6), 'Max'.padStart(7), 'Crit'.padStart(5));
  for (const a of summary.actors.slice(0, 12)) {
    console.log(
      a.name.padEnd(24).slice(0, 24),
      String(a.totalDamage).padStart(10),
      a.dps.toFixed(1).padStart(8),
      a.activeDps.toFixed(1).padStart(8),
      a.percent.toFixed(1).padStart(6),
      String(a.maxHit).padStart(7),
      String(a.crits).padStart(5),
    );
  }
}

const args = parseArgs(process.argv);
if (args.command !== 'parse' || !args.file) usage();
const text = fs.readFileSync(path.resolve(args.file), 'utf8');
const events = parseLogText(text, args);
const damageEvents = events.filter(e => e.type === 'damage');
const encounters = splitEncounters(events, args).map(e => publicSummary(e));
const session = publicSummary(summarizeEvents('session', events.filter(e => e.type === 'damage' || e.type === 'miss'), args));
const kills = splitKillWindows(events, args).map(k => publicSummary(k));
const result = { file: path.resolve(args.file), eventCount: events.length, damageEventCount: damageEvents.length, session, encounters, kills: kills.slice(-10), highScores: null };
if (args.highScores) {
  const store = defaultHighScoreStore();
  const { board, changed } = updateHighScores(loadHighScores(store), { session, encounters, kills }, { sourceFile: result.file });
  if (changed) saveHighScores(board, store);
  result.highScores = { store, ...board };
}

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Parsed ${result.eventCount} combat events (${result.damageEventCount} damage events)`);
  printTable('Session', result.session);
  for (const e of result.encounters.slice(0, 5)) printTable(`Encounter ${e.id}`, e);
  if (result.highScores) {
    console.log('\nHigh scores:');
    const topEncounter = result.highScores.records.encounterDps[0];
    const topKill = result.highScores.records.killDps[0];
    const topSession = result.highScores.records.sessionDamage[0];
    if (topEncounter) console.log(`Best encounter DPS: ${topEncounter.dps.toFixed(1)} DPS | ${topEncounter.totalDamage} dmg | ${fmtTime(topEncounter.startedAt)}-${fmtTime(topEncounter.endedAt)}`);
    if (topKill) console.log(`Best kill DPS:      ${topKill.dps.toFixed(1)} DPS | ${topKill.target} | ${topKill.totalDamage} dmg`);
    if (topSession) console.log(`Best session dmg:   ${topSession.totalDamage} dmg | ${topSession.dps.toFixed(1)} DPS`);
    for (const [name, best] of Object.entries(result.highScores.records.playerBest)) {
      if (best.bestDps) console.log(`${name} personal best: ${best.bestDps.dps.toFixed(1)} DPS | max hit ${best.bestHit?.maxHit ?? 0} | best dmg ${best.bestDamage?.totalDamage ?? 0}`);
    }
  }
}
