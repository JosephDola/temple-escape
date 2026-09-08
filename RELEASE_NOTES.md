# Temple Escape v2.1.0 — The Hollow

Download **TempleEscape-v2.1.0.html** from the release assets, then open it in Chrome or Edge. Everything needed by the game is embedded. No account, ChatGPT sign-in, web hosting, Terminal, install or runtime internet connection is required.

- Removed the countdown and timeout defeat.
- Replaced pursuit with weighted A* routes, radius-aware collision, frequent replanning and sound/last-seen investigation.
- Added low vents you can crouch through. The creature can enter and crawl after you.
- Added a Quaternius creature with a working skeleton, idle/move/attack animations and three selectable skins.
- Added a visible flashlight aligned with the right-hand grip.
- Added an animated capture sequence, footsteps, metal scraping, heartbeat and ambient sound.
- Added an explored-area map, shown while holding M, with an optional always-visible setting.
- Expanded graphics settings: rendering resolution, 1K/2K/4K textures, shadows, fog, FOV, FXAA, bloom, SSAO, sharpness and film grain.

**Controls:** WASD move · Mouse look · Shift sprint · C toggle crouch / Ctrl hold crouch · Space jump · E collect · F light · Hold M map · Esc pause.

Start with **Performance** on an older Mac. Settings are remembered in the current browser; closing or refreshing ends the current run. WebGL 2 is required. This version uses browser rendering effects, not NVIDIA DLSS.

**Validation:** maze connectivity and vent generation over 100 seeds, wall-safe pursuit/turning, target changes, crawler entry/exit, sight obstruction, collision sweeping, stamina, pickups and perception checks; production compilation and self-contained HTML checks. Browser playtesting and device-specific frame-rate measurements were not performed.

Creature source and asset terms are documented in THIRD_PARTY_NOTICES.md and embedded in the HTML. Earlier releases are preserved.
