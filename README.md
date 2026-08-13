# EQ DPS Prototype

Passive log-only DPS parser and browser overlay prototype for EverQuest Legends combat logs.

This project reads EverQuest `eqlog_*.txt` files, parses combat events, calculates DPS summaries, and serves a lightweight overlay-style browser UI. It is intentionally conservative: it does **not** inject into the game, read memory, hook DirectX, inspect network traffic, or require MacroQuest.

## Status

Prototype / proof of concept.

The parser and web overlay are useful today for validating the data model and display concept. The long-term product direction is a native Windows passive overlay with click-through, lock/unlock positioning, opacity controls, and log-file auto-detection.

## Design goals

- **Log-only:** use EverQuest's normal `/log on` output as the only data source.
- **Low risk:** avoid game injection, memory reading, packet inspection, DirectX hooks, and automation frameworks.
- **Transparent parsing rules:** parse recognizable EQ combat lines with tests for important edge cases.
- **Useful DPS scopes:** show current encounter, last kill, whole session, and persistent high scores.
- **Overlay-friendly:** expose a small local HTTP API and browser UI that can later be wrapped in a native overlay shell.

## What it parses

Supported v1 combat patterns include:

- Player melee damage
- Party/player melee damage
- Spell/proc damage
- Damage shield attribution
- DoT damage taken lines
- Miss / avoidance lines
- Slain / kill lines

Example supported lines:

```text
You bash a shin ghoul warrior for 165 points of damage. (Critical)
You hit a shin ghoul warrior for 347 points of magic damage by Smiting Strike.
Drazzin crushes a zol ghoul knight for 92 points of damage. (Riposte)
A shin ghoul warrior is burned by YOUR flames for 11 points of non-melee damage.
Drazzin has taken 42 damage from Heat Blood by a ghoul ritualist.
You have slain a shin ghoul warrior!
A shin ghoul knight has been slain by Drazzin!
```

## Important encounter-boundary rule

`Auto attack is on/off` is intentionally ignored for encounter start and stop.

Those lines are not reliable enough because combat can start before auto attack is enabled, continue after it is disabled, or involve spells, pets, damage shields, and party members. Instead:

- An encounter starts on the first relevant combat event.
- An encounter ends after a configurable idle timeout with no relevant combat events.
- The default idle timeout is `10` seconds.

This is better for dungeon crawling and chain pulls, but it is still configurable because different groups and camps behave differently.

## DPS scopes

The prototype calculates four display scopes.

### Current Encounter

The latest encounter split by combat-event idle timeout.

Useful for normal real-time DPS overlay behavior.

### Last Kill

A rolling damage snapshot ending at the most recent slain line.

Useful when the group chain-pulls and one long encounter would otherwise merge several mobs together.

### Session

The whole parsed log/session.

Useful for total performance across a dungeon run.

### High Scores

Persistent local records saved across parser restarts.

Tracks:

- Best encounter DPS
- Best kill DPS
- Best session damage
- Per-character personal best DPS
- Per-character best total damage
- Per-character biggest max hit

By default high scores are saved to:

```text
data/highscores.json
```

That file is runtime state and is intentionally ignored by git.

You can override the high-score store location:

```bash
EQ_DPS_HIGHSCORES=/path/to/highscores.json npm run serve -- /path/to/eqlog_Dredd_freeport.txt
```

Disable high-score updates during a parse:

```bash
npm run parse -- /path/to/eqlog_Dredd_freeport.txt --no-highscores
```

## Requirements

- Node.js 20 or newer
- npm
- An EverQuest log file produced with `/log on`

No external npm dependencies are currently required.

## Installation

Clone the repo:

```bash
git clone https://github.com/michiganboy/eq-dps-prototype.git
cd eq-dps-prototype
```

Run tests:

```bash
npm test
```

## CLI usage

Parse a log file:

```bash
npm run parse -- /path/to/eqlog_Dredd_freeport.txt --player Dredd --party Drazzin --idle 10
```

JSON output:

```bash
npm run parse -- /path/to/eqlog_Dredd_freeport.txt --player Dredd --party Drazzin --idle 10 --json
```

Options:

```text
--player <name>       Local player name. Defaults to Dredd.
--party <name>        Add a party member to player/party DPS totals. Can be repeated.
--idle <seconds>      Encounter idle timeout. Defaults to 10.
--json                Print full JSON instead of human-readable summary.
--no-highscores       Do not update persistent high-score records.
```

Example output:

```text
Parsed 2995 combat events (1746 damage events)

Session
00:22:36-00:26:04  208s  68,187 dmg  327.8 DPS  targets:22
Name                         Damage      DPS   ActDPS      %     Max  Crit
Dredd                         50438    242.5    242.5   74.0     494    33
Drazzin                       17749     85.3     92.9   26.0     224    17

High scores:
Best encounter DPS: 327.8 DPS | 68187 dmg | 00:22:36-00:26:04
Best kill DPS:      542.4 DPS | a wan ghoul knight | 16273 dmg
Best session dmg:   68187 dmg | 327.8 DPS
Dredd personal best: 423.5 DPS | max hit 494 | best dmg 50438
Drazzin personal best: 208.5 DPS | max hit 224 | best dmg 17749
```

## Web overlay prototype

Start the local server:

```bash
npm run serve -- /path/to/eqlog_Dredd_freeport.txt
```

Open:

```text
http://127.0.0.1:4177
```

The browser UI includes these tabs:

- Current
- Last Kill
- Session
- High Scores

The server reads the log file and returns current parsed state from:

```text
GET /api/state
```

Static overlay assets live in:

```text
web/
```

## Repository layout

```text
.
├── LICENSE
├── README.md
├── package.json
├── src
│   ├── cli.js          # CLI parser entry point
│   ├── encounters.js   # Encounter/session/kill summarization
│   ├── highscores.js   # Persistent high-score board
│   ├── parser.js       # EQ log parsing rules
│   └── server.js       # Local HTTP server/API/static web UI
├── test
│   ├── highscores.test.js
│   └── parser.test.js
└── web
    ├── app.js
    ├── index.html
    └── style.css
```

## Data and privacy

The project is designed to avoid committing private runtime data.

Ignored by default:

- `data/highscores.json`
- `eqlog_*.txt`
- `*.log`
- `.env`
- `node_modules/`

If you use real player names, guild chat logs, private tells, or server logs for testing, keep those files local and out of git.

## Development

Run tests:

```bash
npm test
```

The current tests cover:

- player melee critical damage
- spell/proc damage
- party damage shield attribution
- ignoring auto-attack lines as combat events
- encounter splitting by combat idle timeout
- kill windows from slain lines
- high-score update behavior
- high-score duplicate prevention

## Limitations

- This is not yet a native Windows overlay.
- Browser overlay behavior depends on how you display the browser window.
- Fullscreen exclusive games may appear above normal overlays; borderless/windowed mode is the safer target.
- Parser coverage is based on known sample lines and should be expanded as more log examples are collected.
- Encounter splitting is heuristic by necessity because the log does not provide reliable explicit encounter start/end markers.

## Roadmap

Likely next steps:

1. Add live tail mode for continuously growing log files.
2. Add config file support for player name, party list, idle timeout, and high-score storage.
3. Add more parser fixtures from real dungeon/camp logs.
4. Add export/import/reset commands for high scores.
5. Build a native Windows overlay shell:
   - always-on-top
   - frameless
   - transparent background
   - lock/unlock dragging
   - click-through when locked
   - opacity slider
   - tray/settings UI
   - log-file picker and auto-detect
6. Consider porting parser core to C# if the final overlay is WPF/WinUI.

## License

MIT. See [LICENSE](LICENSE).
