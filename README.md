# CyberAudio

CyberAudio is a client-side Fabric mod for **Minecraft Java Edition 1.21.11** that keeps audio and supported web-media playback inside Minecraft.

## CyberAudio 0.2.0

### Native direct-audio mode
Direct HTTP/HTTPS audio URLs continue to use CyberAudio's lightweight Java audio pipeline:

`URL -> resolver -> HTTP stream -> buffered input -> decoder -> PCM -> audio output`

Features:
- Native Minecraft player screen, default key **M**
- Direct HTTP/HTTPS audio URLs
- MP3 and OGG/Vorbis decoder providers bundled with CyberAudio
- Play, pause/resume, stop, and independent volume
- Lightweight direct-audio queue
- Persistent `config/cyberaudio.json`
- Downloaded-byte and startup-latency metrics
- Network/audio work kept off Minecraft's render thread

### YouTube and Spotify mode
CyberAudio now recognizes normal links from:
- `youtube.com`
- `youtu.be`
- `music.youtube.com`
- `open.spotify.com`
- `spotify.link`

For these links CyberAudio routes the media to the service's supported embedded web player inside Minecraft using **MCEF**. CyberAudio does not extract protected audio streams or bypass service restrictions.

Supported routing includes YouTube videos, Shorts, live-video URLs and playlists, plus Spotify tracks, albums, playlists, artists, shows and episodes.

## Optional MCEF dependency
MCEF is only needed for YouTube/Spotify web playback. Direct MP3/OGG playback works without it.

For Minecraft 1.21.11, install a compatible MCEF Fabric build alongside CyberAudio and Fabric API. If MCEF is absent, CyberAudio remains usable and shows a message when a YouTube/Spotify URL is entered instead of crashing.

The embedded service controls what it allows to play. CyberAudio does not remove ads, bypass account requirements, decrypt streams, or turn restricted content into unrestricted playback.

## Install
1. Use **Minecraft 1.21.11**.
2. Install **Fabric Loader 0.18.4 or newer**.
3. Install **Fabric API 0.141.6+1.21.11** or a compatible 1.21.11 Fabric API build.
4. Put `cyberaudio-0.2.0.jar` in `.minecraft/mods`.
5. For YouTube/Spotify support, also install a compatible **MCEF 1.21.11 Fabric** build.
6. Launch Minecraft and press **M**.

## Using it
Paste a URL into CyberAudio and press **Play URL**.

- Direct audio URL -> CyberAudio native streaming engine
- YouTube / YouTube Music -> embedded YouTube player
- Spotify -> embedded Spotify player

The **Queue Direct** button currently queues native direct-audio URLs. Web-media queue support is planned for a later release.

## Compatibility
- Minecraft 1.21.11
- Fabric Loader 0.18.4+
- Java 21
- Fabric API
- Optional MCEF for web-media playback
- No OptiFine dependency
- Does not require Sodium or Iris

## Security and media handling
CyberAudio treats URLs as untrusted input and accepts HTTP/HTTPS only. The project does not implement DRM circumvention, authentication bypasses, paywall bypasses, protected-content extraction, or service-account bypasses. Use media you are authorized to access.

## Building
The release build uses Java 21, Fabric Loom 1.17.x and Gradle 9.5.0.

```text
gradle build
```

The distributable file is:

```text
build/libs/cyberaudio-0.2.0.jar
```

## Project layout
```text
src/main/java/com/cybertron/cyberaudio/
  audio/             Native direct-audio engine
  config/            Persistent settings
  resolver/          Direct resolver + media URL routing
  util/              Performance metrics

src/client/java/com/cybertron/cyberaudio/client/
  CyberAudioClient.java
  gui/
    AudioPlayerScreen.java
    McefMediaScreen.java
```

## Current limitations
- Web-media queueing is not implemented yet.
- Seeking/progress for the native player is still planned.
- The YouTube/Spotify web player requires MCEF.
- Actual availability of a web-media item is controlled by the service and the item's owner/settings.
- Real-device FPS/CPU/memory measurements still need to be collected on representative hardware; benchmark templates are kept in `docs/` rather than fabricated results.

## Roadmap
- Unified queue for direct + web media
- Web-player mini controls
- Better metadata and thumbnails
- Native seek/progress bar
- Playlists and favorites
- Mini-player HUD
- Reconnect recovery
- Optional synchronized multiplayer playback
