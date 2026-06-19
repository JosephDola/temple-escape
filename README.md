# 🏛️ Temple Escape — Horror Edition

> *A first-person browser horror game. One file. No install. Just dread.*

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=flat&logo=three.js)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

---

## 🎮 Play It

Download **`TempleEscape.html`** and open it in any modern browser. No server needed, no install, no dependencies — everything is bundled into the single file.

> **Best played:** Chrome or Firefox, fullscreen, headphones on, lights off.

---

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `W A S D` | Move |
| `Mouse` | Look around |
| `Shift` | Sprint (drains stamina) |
| `Space` | Jump |
| `E` | Pick up key / Pull lever |
| `F` | Toggle flashlight |
| `M` | Toggle background music |
| `Esc` / alt-tab | Auto-pause |

---

## 🎯 Objective

1. Find all **5 color-coded keys** scattered through the procedurally generated maze
2. Bring each key to its **matching-color lever** and press `E` to pull it
3. Once all 5 levers are pulled, the **exit portal** opens
4. Your **compass** activates — follow it to the exit and escape

> ⚠️ Something is already in the maze when you arrive. It is not friendly.

---

## 👻 The Entity

The entity does **not** simply chase you. It uses three different behaviours:

- **Patrol** — wanders the halls independently from the moment it awakens (5 seconds after you start). You may turn a corner and find it standing there.
- **Visible approach** — appears down a corridor in your line of sight and slowly creeps toward you. You have time to run.
- **Stalk** — spawns behind you and *only moves while you are not looking at it*. Turn around to freeze it in place.
- **Behind jumpscare** — teleports directly behind you; your camera snaps to face it.
- **Front jumpscare** — appears right in front of you out of nowhere, then vanishes.

Jumpscares do **not** deal damage — they are pure psychological horror.

---

## ✨ Features

- **Procedurally generated maze** — 13×13 grid (169 rooms) using recursive backtracker DFS; different layout every run
- **Fully self-contained** — all audio baked in as base64; works completely offline
- **Real uploaded audio** — walking footsteps, running footsteps, breathing (fast/slow crossfade), jumpscare stinger, random spooky ambience
- **Procedural horror music** — layered drone oscillators + evolving pad + shimmer + randomised tension stabs, generated live via Web Audio API
- **Breathing system** — fast breathing while sprinting, slow recovery breathing until stamina fully restores
- **Custom-built horror entity** — fully rigged character (torso, arms, legs, head, cloak strips, glowing eyes) built entirely from Three.js primitives; walk animation driven by code, not a keyframe file
- **Color-coded key/lever puzzle** — 5 keys, 5 levers; keys shown as inventory dots in HUD
- **Rotating compass** — points to the exit once all levers are pulled
- **Pause on tab switch** — game auto-pauses if you alt-tab or lose pointer lock; audio suspends cleanly
- **Stamina system** — sprint only drains while actually moving; exhaustion locks sprint until 30% recovery
- **Spike traps** — 2 random trap rooms
- **Battery-powered flashlight** — drains over time; find batteries to recharge; flickers when low
- **5-minute timer** — red alarm when under 60 seconds

---

## 🛠️ Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| [Three.js](https://threejs.org/) | r128 | 3D rendering, scene, lighting |
| Web Audio API | native | All audio (procedural music + real samples) |
| Pointer Lock API | native | Mouse-look input |

No build step. No npm. No bundler. Pure HTML + JavaScript.

---

## 📄 License

MIT — do whatever you want with it, attribution required.

---

*Built with Three.js and a lot of Web Audio API elbow grease.*
