# Temple Escape: The Hollow — v2.1.0 plan

The release keeps the temple, five crystals and exit gate. The new direction is exploration and pursuit, with player-controlled light and quiet movement, instead of a countdown.

| Area | Release implementation |
| --- | --- |
| Delivery | One offline HTML file with all code, models and texture tiers embedded; GitHub release download |
| Hunter | Weighted A* routes, collision radius, frequent replanning, field of view, sound investigation, last-known-position search |
| Vents | Low metal shortcuts with walls, ceiling, entrance frames and crouch-only headroom; traversable by the creature |
| Creature | Quaternius Maw Gooey, existing skeleton/animations, custom crawling pose, Basalt/Ash/Oxide skins |
| Equipment | A visible physical flashlight follows the posed right hand; battery recharges while switched off |
| Horror | Animated capture cutscene, spatial footfalls/scraping, heartbeat and ambient sound; explored-area map shown on demand |
| Graphics | Warm/cool lighting, stone normal maps, damp floor patches, fog, optional bloom and SSAO; resolution/texture/shadow/FOV/FXAA/sharpness controls |
| Accessibility | Adjustable sound/brightness/motion; gentler capture option; touch controls retained |

No countdown or timeout defeat. Recover all five crystals and reach the gate to win. A creature capture starts the scare sequence and ends the run; traps use the health system.

The browser uses WebGL 2. It does not contain NVIDIA DLSS, frame generation or ray tracing. Performance is a selectable preset, not a claim of a measured frame rate on a specific Mac.

Verification covers the gameplay logic, actual rig/animation structure, JavaScript syntax, production compilation and self-contained packaging. Browser playtesting and Mac GPU performance require a real-device pass.
