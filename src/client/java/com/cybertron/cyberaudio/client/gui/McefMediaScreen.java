package com.cybertron.cyberaudio.client.gui;

import com.cinemamod.mcef.MCEF;
import com.cinemamod.mcef.MCEFBrowser;
import com.cinemamod.mcef.example.ExampleScreen;
import com.cybertron.cyberaudio.CyberAudio;
import com.cybertron.cyberaudio.resolver.MediaUrlRouter;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.lang.reflect.Field;

/**
 * CyberAudio's optional web-media player. This class is only loaded after the
 * caller has verified that the MCEF mod is installed.
 *
 * MCEF's ExampleScreen owns the browser texture and forwards Minecraft mouse,
 * keyboard and scroll events to Chromium. CyberAudio reuses that proven screen
 * and only swaps the initial page for an official YouTube/Spotify embed URL.
 */
public final class McefMediaScreen extends ExampleScreen {
    private static final Field BROWSER_FIELD = findBrowserField();

    private final Screen parent;
    private final MediaUrlRouter.Route route;
    private boolean routed;

    public McefMediaScreen(Screen parent, MediaUrlRouter.Route route) {
        super(Component.literal("CyberAudio - " + route.label()));
        this.parent = parent;
        this.route = route;
    }

    @Override
    protected void init() {
        super.init();
        routeBrowserOnce();
    }

    private void routeBrowserOnce() {
        if (routed) return;
        routed = true;

        try {
            if (!MCEF.isInitialized()) {
                CyberAudio.LOGGER.warn("MCEF is installed but not initialized yet; web media will retry when screen is reopened");
                return;
            }

            MCEFBrowser browser = browser();
            if (browser == null) {
                CyberAudio.LOGGER.error("MCEF ExampleScreen did not create a browser");
                return;
            }

            browser.loadURL(route.playbackUrl());
            browser.setFocus(true);
            CyberAudio.LOGGER.info("Opened {} media in CyberAudio web player", route.label());
        } catch (ReflectiveOperationException | RuntimeException e) {
            CyberAudio.LOGGER.error("Unable to open CyberAudio web player", e);
        }
    }

    private MCEFBrowser browser() throws IllegalAccessException {
        return (MCEFBrowser) BROWSER_FIELD.get(this);
    }

    private static Field findBrowserField() {
        try {
            Field field = ExampleScreen.class.getDeclaredField("browser");
            field.setAccessible(true);
            return field;
        } catch (ReflectiveOperationException e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    @Override
    public void onClose() {
        if (minecraft != null) minecraft.setScreen(parent);
    }
}
