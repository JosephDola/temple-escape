# Temple Escape v3.0.0 — Last Descent

Download **TempleEscape-v3.0.0.html** from Assets and open it in a browser with WebGL 2. The game, models, animations, and textures are embedded. It opens straight to the title screen and works offline, with no Firebase, login, or ChatGPT site redirect.

## Explore, complete tasks, escape

- Expanded the Reawakened base into nine authored areas across three connected elevations, with about 3.8× the original maze's floor area.
- Added galleries, divided burial chambers, slopes, signs, machinery, flooded rooms, and a locked Escape Wing.
- Replaced crystals with eleven tasks: power, drainage, key, archive log, two ritual mechanisms, artifact, surface code, and escape.
- Removed the map entirely. J opens a task-and-notes journal. No countdown.
- Added five continuous vent routes with physical crawling and corners, a lower camera, narrower flashlight beam, and duct sounds. The creature can follow.
- Added slow door operation, closing doors behind you, lockers, throwable distractions, supplies, steam hazards, and local checkpoints. Repairs and mechanisms attract attention.

## The hunt

- The actual 18-bone Quaternius creature has three skins, skeletal walking/attack animations, and additional breathing, head, eye, and crawl effects.
- Pursuit uses the real collision geometry and elevation changes. The hunter investigates sound, remembers its last sighting, searches rooms and vents, and returns to patrol.
- Repeated vent use that it witnesses can trigger an attempt to reach the other exit. Hidden movement is not used to teach this behavior.
- Added pursuit footsteps, positional breathing and clanging, wall muffling, surface-specific footsteps, and quiet intervals.
- Catching the player triggers an animated capture scene with an optional gentler effect.

A physical flashlight follows the player's hand. Graphics presets and controls include resolution, textures, flashlight shadows, fog, FXAA, bloom, SSAO, sharpness, and grain. Water uses wet materials and subtle motion, not real-time reflections. DLSS and hardware ray tracing are not included.

**Controls:** WASD move · Mouse look · Shift sprint · C crouch · E use/hold to work · F light · J journal · Q decoy · Esc pause.

Gameplay, actual geometry/rig checks, and offline-file integrity checks passed. Browser visual playtesting and Mac performance remain unverified. Start with Performance settings on older hardware. Checkpoints are local to the browser/device; Continue returns to the Upper Temple with saved tasks.

Asset sources and licenses are attached in THIRD_PARTY_NOTICES.md. No paid runtime service or additional app subscription is required. Multiplayer and voice chat are planned for a later update.
