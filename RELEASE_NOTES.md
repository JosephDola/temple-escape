# Temple Escape v3.1.0 — The Hunt

Download **TempleEscape-v3.1.0.html** from Assets and open it in a browser with WebGL 2. The game, models, animations, and textures are embedded in one file. It opens straight to the title screen and works offline, with no Firebase, login, ChatGPT site redirect, installer, or server.

## Hunter refinement

- Chase navigation now recalculates routes more aggressively than patrol or search, so sudden turns and changed player routes are handled sooner without teleporting through geometry.
- The Hollow now values vents differently depending on its state: pursuit favors useful duct shortcuts, local search considers vent mouths more often, and normal patrol avoids overusing them.
- Lost-sight searches are more deliberate. The hunter alternates between nearby vent mouths, room centers, and surrounding cells instead of repeatedly picking the same search point.
- Chase crawl speed is now distinct from patrol crawl speed, making duct pursuit feel intentional while the player still keeps the faster full sprint in open halls.
- The creature rig has stronger bounded chase/crawl motion, including more responsive tentacle movement, breathing sway, face tracking, and eye-reflection pulsing. Procedural offsets still restore cleanly between animation frames.

## Last Descent remains intact

- Nine authored areas across three connected elevations with no map and no countdown.
- Eleven escape tasks, physical vents, slow doors, lockers, decoys, supplies, steam hazards, flooded movement, checkpoints, and a held flashlight.
- The actual 18-bone Quaternius creature, three skins, skeletal animation clips, positional creature audio, wall muffling, and capture sequence remain part of the offline build.
- Vent prediction still only uses witnessed behavior; hidden player movement is not used to teach the hunter exits.
- Multiplayer and voice chat remain future work while the single-player horror loop is refined.

## Build and validation

The release pipeline now rebuilds a fresh standalone HTML from the current source instead of treating the previous 20 MB file as the final code. Existing embedded v3.0 resources are checksum-verified, restored for the build, then re-embedded with the v3.1 source. Pull requests run gameplay/geometry/rig checks and standalone-file verification before merge; the main branch publishes the verified single-file release.

**Controls:** WASD move · Mouse look · Shift sprint · C crouch · E use/hold to work · F light · J journal · Q decoy · Esc pause.

Browser visual playtesting and Mac frame-rate measurements are still the remaining manual checks. Start with Performance settings on older hardware. Asset sources and licenses remain in THIRD_PARTY_NOTICES.md.
