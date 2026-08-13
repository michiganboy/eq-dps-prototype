import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLogText } from './parser.js';
import { splitEncounters, splitKillWindows, summarizeEvents, publicSummary } from './encounters.js';
import { defaultHighScoreStore, loadHighScores, saveHighScores, updateHighScores } from './highscores.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const webRoot = path.join(root, 'web');
const logFile = process.argv[2] || '/opt/data/cache/documents/doc_fba727ee57e4_eqlog_Dredd_freeport.txt';
const options = { playerName: process.env.EQ_PLAYER || 'Dredd', party: (process.env.EQ_PARTY || 'Drazzin').split(',').filter(Boolean), idleSeconds: Number(process.env.EQ_IDLE || 10) };

function currentState() {
  const text = fs.readFileSync(logFile, 'utf8');
  const events = parseLogText(text, options);
  const session = publicSummary(summarizeEvents('session', events.filter(e => e.type === 'damage' || e.type === 'miss'), options));
  const encounters = splitEncounters(events, options).map(e => publicSummary(e));
  const kills = splitKillWindows(events, options).map(k => publicSummary(k));
  const store = defaultHighScoreStore();
  const { board, changed } = updateHighScores(loadHighScores(store), { session, encounters, kills }, { sourceFile: logFile });
  if (changed) saveHighScores(board, store);
  return { logFile, generatedAt: new Date().toISOString(), options, eventCount: events.length, session, currentEncounter: encounters.at(-1) || null, lastKill: kills.at(-1) || null, highScores: { store, ...board } };
}

function send(res, code, body, contentType = 'text/plain') {
  res.writeHead(code, { 'content-type': contentType, 'cache-control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/state') {
    try { send(res, 200, JSON.stringify(currentState()), 'application/json'); }
    catch (err) { send(res, 500, JSON.stringify({ error: err.message }), 'application/json'); }
    return;
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.resolve(webRoot, rel);
  if (!file.startsWith(webRoot)) return send(res, 403, 'Forbidden');
  if (!fs.existsSync(file)) return send(res, 404, 'Not found');
  const ext = path.extname(file);
  const type = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
  send(res, 200, fs.readFileSync(file), type);
});

const port = Number(process.env.PORT || 4177);
server.listen(port, '127.0.0.1', () => {
  console.log(`Dungeon Crawlers DPS prototype: http://127.0.0.1:${port}`);
  console.log(`Reading: ${logFile}`);
});
