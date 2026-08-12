package com.cybertron.cyberaudio.client.gui;

import com.cybertron.cyberaudio.audio.AudioManager;
import com.cybertron.cyberaudio.client.CyberAudioClient;
import com.cybertron.cyberaudio.resolver.MediaUrlRouter;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class AudioPlayerScreen extends Screen {
    private final Screen parent;
    private final AudioManager audio = CyberAudioClient.AUDIO;
    private EditBox urlBox;
    private String statusMessage = "Paste a direct audio, YouTube, YouTube Music, or Spotify link.";
    private int statusColor = 0xA0E8FF;

    public AudioPlayerScreen(Screen parent) {
        super(Component.literal("CyberAudio"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int center = width / 2;
        int top = Math.max(24, height / 2 - 94);

        urlBox = new EditBox(font, center - 160, top + 44, 320, 20, Component.literal("Media URL"));
        urlBox.setMaxLength(2048);
        String saved = CyberAudioClient.CONFIG.config().lastUrl;
        if (saved != null) urlBox.setValue(saved);
        addRenderableWidget(urlBox);

        addRenderableWidget(Button.builder(Component.literal("Play URL"), button -> playUrl())
                .bounds(center - 160, top + 70, 100, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Pause / Resume"), button -> audio.togglePause())
                .bounds(center - 54, top + 70, 120, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Stop"), button -> audio.stop())
                .bounds(center + 72, top + 70, 88, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Queue Direct"), button -> queueUrl())
                .bounds(center - 160, top + 96, 100, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Vol -"), button -> changeVolume(-0.05f))
                .bounds(center - 54, top + 96, 58, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Vol +"), button -> changeVolume(0.05f))
                .bounds(center + 10, top + 96, 58, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Clear Queue"), button -> audio.clearQueue())
                .bounds(center + 74, top + 96, 86, 20).build());
    }

    private void playUrl() {
        String url = urlBox.getValue().trim();
        CyberAudioClient.CONFIG.config().lastUrl = url;
        CyberAudioClient.CONFIG.save();

        MediaUrlRouter.Route route = MediaUrlRouter.route(url);
        if (!route.valid()) {
            setStatus(route.error(), 0xFF7777);
            return;
        }

        if (route.kind() == MediaUrlRouter.Kind.DIRECT_AUDIO) {
            setStatus("Opening direct audio stream...", 0x77FFCC);
            audio.play(route.playbackUrl()).exceptionally(error -> null);
            return;
        }

        audio.stop();
        if (!FabricLoader.getInstance().isModLoaded("mcef")) {
            setStatus(route.label() + " playback needs the free MCEF 1.21.11 mod. Direct audio still works without it.", 0xFFD36A);
            return;
        }

        if (minecraft != null) {
            setStatus("Opening " + route.label() + " inside Minecraft...", 0x77FFCC);
            minecraft.setScreen(new McefMediaScreen(this, route));
        }
    }

    private void queueUrl() {
        MediaUrlRouter.Route route = MediaUrlRouter.route(urlBox.getValue());
        if (!route.valid()) {
            setStatus(route.error(), 0xFF7777);
            return;
        }
        if (route.webMedia()) {
            setStatus("Web-media queue support is coming next; use Play URL for YouTube/Spotify right now.", 0xFFD36A);
            return;
        }
        audio.enqueue(route.playbackUrl());
        setStatus("Added direct audio to queue.", 0x77FFCC);
    }

    private void changeVolume(float delta) {
        audio.setVolume(audio.volume() + delta);
        CyberAudioClient.CONFIG.config().volume = audio.volume();
        CyberAudioClient.CONFIG.save();
    }

    private void setStatus(String message, int color) {
        statusMessage = message == null ? "" : message;
        statusColor = color;
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        renderBackground(graphics, mouseX, mouseY, partialTick);
        super.render(graphics, mouseX, mouseY, partialTick);

        int center = width / 2;
        int top = Math.max(24, height / 2 - 94);
        graphics.drawCenteredString(font, Component.literal("CYBERAUDIO 0.2"), center, top, 0x55FFFF);
        graphics.drawCenteredString(font, Component.literal("Direct Audio + YouTube + Spotify"), center, top + 16, 0xD0D0D0);
        graphics.drawCenteredString(font, Component.literal(audio.currentTitle()), center, top + 29, 0xFFFFFF);

        graphics.drawString(font, "State: " + audio.state(), center - 160, top + 126, 0xD0D0D0, false);
        graphics.drawString(font, "Volume: " + Math.round(audio.volume() * 100) + "%", center - 160, top + 140, 0xD0D0D0, false);
        graphics.drawString(font, "Queue: " + audio.queueSize(), center + 46, top + 140, 0xD0D0D0, false);
        graphics.drawString(font, "Downloaded: " + formatBytes(audio.performance().downloadedBytes()), center - 160, top + 154, 0xA0A0A0, false);
        graphics.drawString(font, "Start latency: " + audio.performance().startLatencyMs() + " ms", center + 16, top + 154, 0xA0A0A0, false);

        if (!audio.lastError().isBlank()) {
            graphics.drawCenteredString(font, Component.literal("Audio error: " + audio.lastError()), center, top + 169, 0xFF7777);
        } else if (!statusMessage.isBlank()) {
            graphics.drawCenteredString(font, Component.literal(statusMessage), center, top + 169, statusColor);
        }
    }

    private static String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024L * 1024) return String.format("%.1f KiB", bytes / 1024.0);
        return String.format("%.1f MiB", bytes / (1024.0 * 1024.0));
    }

    @Override
    public void onClose() {
        if (minecraft != null) minecraft.setScreen(parent);
    }
}
