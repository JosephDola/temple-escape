# Temple Escape: Last Descent — The Hunt

An offline first-person survival horror chapter, built on Temple Escape: Reawakened. Restore power, uncover the sanctuary's secrets, and reach the surface while the Hollow hunts through the temple and its ducts.

**[Download TempleEscape-v3.1.0.html](https://github.com/JosephDola/temple-escape/releases/download/v3.1.0/TempleEscape-v3.1.0.html)** · [Latest release](https://github.com/JosephDola/temple-escape/releases/latest)

Download the HTML asset and open it in a browser with WebGL 2. The file embeds the game, textures, character rigs, and animations. It opens at the title screen and plays offline. No installer, Terminal, server, Firebase, login, ChatGPT account, or hosted-site redirect is required. The source ZIP is for development; the HTML release asset is the game.

## The descent

- Nine authored areas across three elevations: Upper Temple, Burial Chambers, Sealed Archive, Flooded Lower Temple, Ritual Sanctuary, Seal Control, Underground Maintenance, Maintenance Workshop, and Escape Wing.
- A 21×21 layout envelope with 305 active floor cells, about 3.8 times the original 9×9 maze's floor area. Galleries, divided burial chambers, interconnected halls, slopes, signs, and equipment give each zone a purpose. The elevations connect continuously; these are not stacked, independently simulated floors.
- Eleven tasks: find a fuse, restore power, drain the lower temple, take the key, unlock the archive, read the log, activate two seals in either order, retrieve the artifact, enter the surface code, and escape.
- **No map and no countdown.** Follow signs and landmarks. **J** opens the task-and-notes journal and pauses the game.
- Five continuous vent routes, including a longer route with corners. Both characters must physically crawl through them. Crouching lowers the camera and entering a duct narrows the flashlight.
- Lockers, three throwable distraction stones, batteries, first-aid kits, and intermittent steam leaks. Water slows movement and makes footsteps easier to hear until drained.
- Hold E for noisy repairs and mechanisms. Unlocked doors open slowly, can be closed from either side, and delay the creature before it forces them open. The keypad leaves the world running.
- Local checkpoints at the start and after tasks. The field recorder in the Upper Temple also saves and restores health and flashlight charge. Continue returns to the Upper Temple with completed tasks and checkpoint inventory.

## The Hollow

The Quaternius creature has an actual 18-bone skeleton, walking and attack clips, and Basalt, Ash, and Oxide skins. Additional animation layers add breathing, head movement, reflective eyes, and tentacle motion. v3.1 strengthens those bounded motion layers during chase and crawl states without replacing the original skeletal clips. Catching the player triggers an animated capture scene; a gentler effect is available in Settings.

The hunter uses collision-aware routes and senses sight, footsteps, flashlight visibility, and noisy interactions. Chase navigation now recalculates more frequently than patrol, and vents have different navigation costs depending on whether the creature is pursuing, searching, investigating, or roaming. After losing sight, the Hollow searches nearby vent mouths, room centers, and surrounding cells while avoiding immediate repeats before returning to patrol. It can still try an alternate route to the opposite vent exit after witnessing repeated entries, and hidden player movement is not used to teach this behavior. Breaking sight, switching off the light, and moving quietly can lose it. A locker cannot protect you if it saw you enter.

Sound pans with the camera, attenuates with distance, and muffles through walls. Footsteps change between stone, metal, water, and ducts. Creature breathing, pursuit steps, distant vent clanging, drips, a heartbeat, and quieter intervals create tension. Sounds are synthesized locally; no streaming or voice service is needed.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look; dragging works if mouse capture is unavailable |
| Arrow keys | Forward/backward and turn |
| Shift | Sprint |
| C / Ctrl | Toggle crouch / hold crouch |
| E | Use, pick up, hide, or leave a locker |
| Hold E | Repair, operate doors/mechanisms, save, or escape |
| F | Toggle held flashlight; it recharges while off |
| J | Open/close task journal and recovered notes |
| Q | Throw a distraction stone (three per run) |
| Space | Jump |
| Esc | Pause or close the active panel |

The keypad accepts number keys, Backspace, and Enter. Touch controls are included.

## Graphics and saves

Performance is the default for older Macs and PCs. Controls include render resolution, 1K/2K/4K textures, flashlight shadows, brightness, fog, field of view, FXAA, bloom, SSAO, sharpness, grain, volume, and camera motion. Wet materials, torch flame motion, ceiling details, pipes, rubble, nearby dust, and moving flashlight shadows add atmosphere. Cinematic settings cost more GPU time. NVIDIA DLSS, ray tracing, and real-time reflected water are not implemented.

Checkpoints and preferences remain in this browser on this device. Local-file storage differs between browsers: use the same browser and file location to retain access to a save. Private browsing, clearing browser data, or moving the HTML may affect saves. Earlier crystal-run checkpoints do not migrate to this chapter.

## Develop

Node 18 or newer:

```sh
npm ci --ignore-scripts
TEMPLE_RELEASE_VERSION=3.0.0 node scripts/restore-html.mjs
TEMPLE_RELEASE_VERSION=3.0.0 node scripts/extract-assets.mjs
npm run dev
```

```sh
npm test
npm run build:html
node scripts/verify-standalone.mjs
```

`.release/v3.0.0` is retained as a checksum-verified embedded-resource source. The current release workflow restores those models and textures, runs gameplay/geometry/rig checks, builds a fresh standalone HTML from the current source, verifies the generated file and checksum, and only then publishes the new release. Pull requests run the same verification path without publishing.

Validation covers complete objective progression, locked-room access, continuous slopes, both seal orders, checkpoint recovery, actual equipment collisions, complete bidirectional vent traversal, hunter routes to every task, doors, perception memory, sound occlusion, chase repath cadence, vent weighting, and the shipped creature rig. Browser visual playtesting and Mac frame-rate measurements remain outstanding.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for asset sources and license details. Multiplayer and voice chat are reserved for a later update.
