# Dungeon Crawlers DPS Prototype

Passive EverQuest Legends DPS parser prototype.

## What it does

- Reads EverQuest log text files such as `eqlog_Dredd_freeport.txt`.
- Parses damage, misses, damage shields, spell damage, DoTs, and slain lines.
- Calculates three scopes:
  - **Current encounter**: actual combat events split by idle timeout.
  - **Last kill**: rolling damage window ending at a slain line.
  - **Session**: whole parsed log/session.
- Tracks persistent high scores:
  - best encounter DPS
  - best kill DPS
  - best session damage
  - per-character personal best DPS, damage, and max hit
- Serves a browser overlay-style panel at `http://127.0.0.1:4177`.

## Important boundary rule

`Auto attack is on/off` is intentionally ignored for encounter start/stop. It is not reliable enough. Encounter boundaries are inferred from real combat events plus configurable idle timeout.

## Commands

```bash
npm test
npm run parse -- /path/to/eqlog_Dredd_freeport.txt --player Dredd --party Drazzin --idle 10
npm run serve -- /path/to/eqlog_Dredd_freeport.txt
```

Open:

```text
http://127.0.0.1:4177
```

High scores are saved locally at:

```text
/opt/data/eq-dps-prototype/data/highscores.json
```

Override the location with:

```bash
EQ_DPS_HIGHSCORES=/path/to/highscores.json npm run serve -- /path/to/eqlog_Dredd_freeport.txt
```

## Next implementation step

Convert the web panel into a native Windows passive overlay shell:

- C#/.NET WPF or WinForms on Windows
- always-on-top
- frameless
- lock/unlock dragging
- click-through when locked
- opacity control
- log-file picker
- tray/settings UI

The parser core can stay close to this model or be ported to C# for the native app.
