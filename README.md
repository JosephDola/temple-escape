# Temple Escape — Remastered

Temple Escape is being rebuilt as a shared-core first-person horror adventure for **web** and **desktop/Steam**. Both versions use the same Three.js gameplay code so fixes and new features land everywhere at once.

## Current alpha

- Procedurally generated 9×9 temple maze
- Five crystal objective and awakened exit gate
- Guardian AI using maze-aware shortest-path pursuit
- Flashlight battery, stamina, health and spike traps
- Circular minimap, timer and objective HUD
- Procedural Web Audio ambience and sound effects (works offline)
- Graphics presets including **Legacy / Older PCs & Macs**
- Cinematic remastered menu art and teal-crystal visual direction
- Browser build via Vite
- Desktop build via Electron 37.6.0

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Look |
| Shift | Sprint |
| Space | Jump |
| E | Collect crystal |
| Esc | Pause |

## Run the web build

```bash
npm install
npm run dev
```

Production web build:

```bash
npm run build:web
```

The static site is written to `dist/`.

## Desktop / Steam build

Temple Escape uses Electron **37.6.0** for the legacy desktop target. The target floor is:

- macOS 11 Big Sur or newer, Intel x64
- Windows 10 or newer, x64

Build locally:

```bash
npm run build:mac
npm run build:win
```

Packaged files are written to `release/`.

> The unsigned GitHub Actions builds are for testing. A public macOS Steam release must be signed/notarized with the developer's Apple credentials before publishing.

## Steam architecture

Steam-specific features are intentionally isolated from gameplay. The game does **not** require the Steamworks API to run, so the browser build stays clean and the desktop build can add achievements/cloud/overlay integration later without forking the game.

Recommended Steam depots:

- Windows x64 depot
- macOS Intel x64 depot

## Project layout

```text
src/                 shared game + UI
index.html           web entry point
electron/            desktop wrapper + macOS entitlements
.github/workflows/   web / Windows / Intel Mac builds
```

## Legacy version

The old one-file prototype is preserved separately during the remaster process and is being used as a gameplay reference rather than as the new architecture.

## License

MIT.
