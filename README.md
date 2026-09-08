# Temple Escape: The Hollow

A first-person temple horror game. Find five crystals, avoid the creature, and reach the gate. There is no countdown.

## Download and play

Download **TempleEscape-v2.1.0.html** from [the v2.1.0 release](https://github.com/JosephDola/temple-escape/releases/tag/v2.1.0). Open the file in Chrome or Edge. All models, textures, code and sound generation are inside it, so the game runs offline. No account or ChatGPT sign-in is needed.

The game requires WebGL 2. Performance mode is the default for older computers. Choose Settings before playing or from the pause menu. If mouse capture is unavailable, drag to look or turn with the arrow keys.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow up-down | Move |
| Mouse / arrow left-right | Look / turn |
| Shift | Sprint |
| C / Ctrl | Toggle crouch / hold crouch |
| Space | Jump while standing |
| E | Recover nearby crystal |
| F | Toggle flashlight; recharge while off |
| Hold M | Show explored map |
| Esc | Pause |

Touch movement and action controls are included. Settings persist in the browser. Runs do not persist after closing or refreshing.

## The Hollow update

The creature patrols, detects sound, pursues clear sightlines and searches its last known target position. Radius-aware navigation uses regular passages and low vents. Crouch to enter a vent; the creature can follow. Capture triggers an animated encounter before the defeat screen.

A rigged creature, three skin colors, a held flashlight, textured stone, warmer lamps and positional sound replace the previous placeholder presentation. Graphics settings include resolution, 1K/2K/4K maps, shadows, fog, FOV, FXAA, bloom, SSAO, sharpness and grain. These are browser effects; the game does not implement DLSS or ray tracing.

See [the design plan](HORROR_PLAN.md), [release notes](RELEASE_NOTES.md) and [asset notices](THIRD_PARTY_NOTICES.md).

## Development

The repository keeps the source build and a checksummed, compressed copy of the standalone HTML under `.release/v2.1.0`. The restore command recreates the HTML and its resources; players download the normal HTML from Releases.

```sh
npm ci
npm run restore:assets
npm run dev
```

Build a new HTML:

```sh
npm test
npm run build:html
```

Output: `standalone/TempleEscape-v2.1.0.html`. The included SHA256SUMS.txt identifies the exact downloadable bytes. The existing Electron wrapper and packaging configuration are retained in source; native macOS/Windows installers are not part of this release.

## Validation

Automated checks cover connected mazes and vent shortcuts across 100 seeds, pursuit around corners and changing targets, wall collision, crawler entry/exit, sight through low openings, remembered targets, pickups, traps and stamina. Source syntax, model rigs/animation clips, production compilation and the embedded-resource package are checked too.

Browser playtesting and device-specific performance measurement were not performed in this release session. No exact FPS is promised.

The game's source uses the repository's MIT license. Third-party resources keep their own terms; see THIRD_PARTY_NOTICES.md.
