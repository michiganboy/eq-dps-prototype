import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyBoard, updateHighScores } from '../src/highscores.js';

test('tracks top encounter and player personal bests', () => {
  const summary = {
    id: 'encounter-1',
    startedAt: '2026-08-13T00:00:00.000Z',
    endedAt: '2026-08-13T00:00:10.000Z',
    durationSeconds: 10,
    totalDamage: 1000,
    dps: 100,
    actors: [
      { name: 'Dredd', totalDamage: 700, dps: 70, activeDps: 100, percent: 70, crits: 2, maxHit: 300 },
      { name: 'Drazzin', totalDamage: 300, dps: 30, activeDps: 60, percent: 30, crits: 1, maxHit: 120 },
    ],
  };
  const { board, changed } = updateHighScores(emptyBoard(), { encounters: [summary] }, { sourceFile: 'eqlog_Dredd_freeport.txt' });
  assert.equal(changed, true);
  assert.equal(board.records.encounterDps[0].dps, 100);
  assert.equal(board.records.playerBest.Dredd.bestDps.dps, 70);
  assert.equal(board.records.playerBest.Dredd.bestHit.maxHit, 300);
});

test('does not duplicate the same summarized record', () => {
  const summary = {
    id: 'encounter-1', startedAt: '2026-08-13T00:00:00.000Z', endedAt: '2026-08-13T00:00:10.000Z', durationSeconds: 10, totalDamage: 1000, dps: 100, actors: []
  };
  const first = updateHighScores(emptyBoard(), { encounters: [summary] });
  const second = updateHighScores(first.board, { encounters: [summary] });
  assert.equal(second.changed, false);
  assert.equal(second.board.records.encounterDps.length, 1);
});
