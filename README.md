# 🏛️ Temple Escape — The Descent

> *A first-person browser horror game built to feel like a desktop horror title: dynamic pursuit, vent crawling, a physical flashlight, procedural temple layouts, and no countdown clock.*

## 🎮 Play

Download **`TempleEscape.html`** and open it in Chrome, Edge, or Firefox.

> Best played fullscreen with headphones. The game is a single HTML file; Three.js r140 is loaded from jsDelivr when the file starts.

## 🆕 v2.0 — The Descent

This is a full rebuild of the old Temple Escape loop rather than another small v1.x patch.

### Enemy AI + rig

- Code-rigged 3D entity with articulated head, jaw, torso, arms, legs, hands/feet and cloak.
- Separate standing/walking and low-profile **vent crawl** poses.
- A* navigation over the generated temple graph.
- Patrol, investigate, hunt and search behavior.
- Tracks the player's last seen and last heard locations.
- Sprinting is much louder than crouching.
- The flashlight can expose the player at long range.
- The enemy can choose vent shortcuts and **follow the player into vents** without teleporting.
- Close-range capture triggers a camera-space jumpscare sequence.

### Player + horror presentation

- First-person arms and a visible handheld flashlight model.
- Flashlight beam is physically attached to the camera/viewmodel and has battery drain/flicker.
- Walk/sprint head bob and viewmodel sway.
- Crouch/vent camera height and muffled movement behavior.
- Procedural horror ambience, footsteps, vent clangs, seal sounds, whispers and jumpscare stinger using Web Audio.
- Fog, dynamic torch flicker, shadows, procedural stone/floor/metal materials, rubble and dust particles.
- Film-grain and vignette presentation.

### Level + objective redesign

- No five-minute timer.
- Procedurally generated 9×9 temple with extra navigation loops.
- Five physical vent routes integrated into the AI navigation graph.
- Restore **3 ancient seal mechanisms** and reach the descent gate.
- Vents are traversal options, not safe zones.

### Graphics settings

- Low / Medium / High / Ultra presets.
- Render scale control.
- FOV and mouse sensitivity controls.
- Optional head bob and film grain.
- Shadow and particle density scale with the selected preset.
- Settings persist in local storage.

## 🕹️ Controls

| Key | Action |
|---|---|
| `W A S D` | Move |
| `Mouse` | Look |
| `Shift` | Sprint |
| `Ctrl` / `C` | Crouch / crawl |
| `F` | Flashlight |
| `E` | Interact / restore seals / enter vents / use exit |
| `Space` | Jump when not crouched/in a vent |
| `Esc` | Pause / release mouse |

## 🛠️ Tech

- HTML5 + JavaScript
- Three.js r140
- Web Audio API
- Pointer Lock API
- Canvas-generated procedural materials
- No npm or build step required to play

## 📄 License

MIT. See `LICENSE`.
