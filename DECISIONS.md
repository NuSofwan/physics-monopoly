# Decisions

- Build mode: implement the complete playable vertical slice in one pass, with all requested systems represented and expandable.
- Board size: 28 tiles, as locked in `CODEX_WORKFLOW.md`.
- Asset approach: ship generated SVG placeholders plus `assets/manifest.json` and `assets/IMAGE_PROMPTS.md`; real image2.0 assets can replace paths later without changing game logic.
- Multiplayer: Colyseus is authoritative for dice, turns, money, property ownership, questions, answers, and penalties. Client only displays state and sends intents.
- Reconnection: supported by stable player names/avatar choices and Colyseus room reconnect metadata; local tabs can rejoin by room code.
- Question bank: at least 60 Thai high-school physics questions are stored in JSON by topic and validated by script.
