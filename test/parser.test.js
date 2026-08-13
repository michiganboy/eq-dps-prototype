import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLogLine, parseLogText } from '../src/parser.js';
import { splitEncounters, splitKillWindows } from '../src/encounters.js';

const options = { playerName: 'Dredd', party: ['Drazzin'], idleSeconds: 10 };

test('parses player melee critical damage', () => {
  const ev = parseLogLine('[Thu Aug 13 00:22:50 2026] You bash a shin ghoul warrior for 165 points of damage. (Critical)', 1, options);
  assert.equal(ev.type, 'damage');
  assert.equal(ev.source, 'Dredd');
  assert.equal(ev.target, 'a shin ghoul warrior');
  assert.equal(ev.amount, 165);
  assert.equal(ev.damageType, 'melee');
  assert.deepEqual(ev.flags, ['critical']);
});

test('parses spell damage by named ability', () => {
  const ev = parseLogLine('[Thu Aug 13 00:22:50 2026] You hit a shin ghoul warrior for 347 points of magic damage by Smiting Strike.', 1, options);
  assert.equal(ev.source, 'Dredd');
  assert.equal(ev.damageType, 'spell');
  assert.equal(ev.ability, 'Smiting Strike');
});

test('parses party damage shield attribution', () => {
  const ev = parseLogLine("[Thu Aug 13 00:22:47 2026] A shin ghoul warrior is pierced by Drazzin's thorns for 14 points of non-melee damage.", 1, options);
  assert.equal(ev.source, 'Drazzin');
  assert.equal(ev.damageType, 'damage_shield');
});

test('does not use auto attack lines as combat events', () => {
  const text = [
    '[Thu Aug 13 00:00:00 2026] Auto attack is on.',
    '[Thu Aug 13 00:00:01 2026] Auto attack is off.',
  ].join('\n');
  assert.equal(parseLogText(text, options).length, 0);
});

test('splits encounters by actual combat idle time, not auto attack', () => {
  const text = [
    '[Thu Aug 13 00:00:00 2026] Auto attack is on.',
    '[Thu Aug 13 00:00:01 2026] You slash a bat for 10 points of damage.',
    '[Thu Aug 13 00:00:02 2026] Auto attack is off.',
    '[Thu Aug 13 00:00:20 2026] You slash a snake for 20 points of damage.',
  ].join('\n');
  const encounters = splitEncounters(parseLogText(text, options), options);
  assert.equal(encounters.length, 2);
});

test('creates kill windows from slain lines separately from encounters', () => {
  const text = [
    '[Thu Aug 13 00:00:01 2026] You slash a bat for 10 points of damage.',
    '[Thu Aug 13 00:00:02 2026] You have slain a bat!',
  ].join('\n');
  const kills = splitKillWindows(parseLogText(text, options), options);
  assert.equal(kills.length, 1);
  assert.equal(kills[0].kill.target, 'a bat');
});
