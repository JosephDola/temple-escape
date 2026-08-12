# CyberAudio

CyberAudio is a client-side Fabric mod for Minecraft Java Edition 1.21.11 that plays direct HTTP/HTTPS audio streams without leaving the game.

## v0.1.0 features
- Native Minecraft player screen (default **M**)
- Direct HTTP/HTTPS audio URL resolver
- Streaming playback through Java Sound
- MP3 and OGG/Vorbis decoder service providers bundled into the mod
- Play, pause/resume and stop
- Independent CyberAudio volume
- Lightweight URL queue
- Persistent `config/cyberaudio.json`
- Downloaded-byte and startup-latency metrics
- No network or decoder work on Minecraft's render thread

## Security and media policy
CyberAudio accepts only HTTP and HTTPS URLs. It does not bypass DRM, authentication, paywalls, or protected media systems. Use media you are authorized to access.

## Install
1. Install Fabric Loader 0.19.3+ for Minecraft 1.21.11.
2. Install Fabric API 0.141.6+1.21.11.
3. Put `cyberaudio-0.1.0.jar` in `.minecraft/mods`.
4. Launch Minecraft and press **M**.

## Architecture
`URL -> resolver -> HTTP stream -> buffered input -> Java Sound decoder -> PCM -> SourceDataLine`

## Building
CI builds with Java 21 and Gradle 9.1.0: `gradle build`. The distributable jar is `build/libs/cyberaudio-0.1.0.jar`.

## Roadmap
Playlists, seek/progress, thumbnails/metadata providers, reconnect recovery, mini-player HUD, and optional server synchronization.
