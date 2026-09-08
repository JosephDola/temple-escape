# Last Descent: escape chapter and next steps

Keep the Reawakened engine and improve it system by system. The current chapter is a single-player escape game. Multiplayer and voice chat remain future work.

| System | Implemented in v3.0.0 |
| --- | --- |
| Level architecture | 305 active cells inside a 21×21 envelope; nine distinct areas, galleries and burial partitions, interconnected halls, three elevations linked by continuous slopes |
| Navigation | Environmental signs and landmarks; no map; a task-and-notes journal on J |
| Objectives | Fuse → generator → drainage → key → archive → log → two seals in either order → ritual artifact → surface code → escape |
| World changes | Power increases lighting and starts steam leaks; drainage removes water and exposes the key; seals release the artifact cage; doors and escape route unlock |
| Hunter | Real collision-aware routes, sight and sound, short chase continuation, last-known position, local searches including vents, patrol, witnessed-vent prediction |
| Creature | Quaternius mesh with 18-bone rig, walking and attack clips, three skins, breathing, head movement, eye reflections and crawl pose overlays |
| Vents | Five continuous routes, including a seven-edge route with corners; lowered camera and narrow flashlight; creature can physically follow |
| Interaction | Hold-to-work mechanics, keypad that leaves time running, slow doors that can close behind the player, enemy forcing unlocked doors, lockers and distraction stones |
| Survival | Flashlight recharge and flicker, surface-dependent footsteps, slower/noisier flooded movement, supplies, steam hazards, task checkpoints and a rest/save recorder |
| Atmosphere | Positional synthesized sound with distance attenuation and wall muffling, creature breathing, vent clangs, quiet periods, torch motion, wet materials, dust, fog and optional postprocessing |
| Delivery | Offline HTML on GitHub Releases; title screen without login or Firebase |

The goal is to reach the surface. The first fuse location and surface code vary by seed; major rooms and progression are authored so directions remain meaningful. The two seal tasks allow a limited choice of order. This is not a fully randomized campaign.

Elevations are connected zones, not overlapping stacked floors. Water uses a wet shaded surface and subtle motion, not live mirror reflections. Fog is depth fog; no true volumetric lighting, hardware ray tracing, or DLSS is claimed. The existing creature rig is adapted, not authored from scratch.

Doors synchronize the physical collider and route graph while opening. Closing stops when a character occupies the doorway; the creature can force a previously unlocked door after a delay. Hiding works after sight is broken. Sound and witnessed observations inform the hunter; hidden player movement does not update learned vent exits.

Performance mode keeps postprocessing and shadow costs low. Static decorations are batched by material and region. Release gates cover complete objectives, locked areas, actual geometry and floors, bidirectional vent routes, doors, hearing, memory, checkpoints, and the actual rig. Browser visual playtesting and hardware FPS measurements remain outstanding.

GitHub is the connected source and release app. Additional asset-generation plugins were checked; none was necessary and confirmed free for this update. No new app account or paid runtime dependency was added.

Next: playtest chase fairness and performance, refine room dressing and animation, then design multiplayer state ownership and opt-in voice controls before adding a network service.
