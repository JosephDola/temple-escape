package com.cybertron.cyberaudio.client.gui;

import com.cybertron.cyberaudio.audio.AudioManager;
import com.cybertron.cyberaudio.client.CyberAudioClient;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class AudioPlayerScreen extends Screen {
    private final Screen parent; private final AudioManager audio=CyberAudioClient.AUDIO; private EditBox urlBox;
    public AudioPlayerScreen(Screen parent){super(Component.literal("CyberAudio"));this.parent=parent;}
    @Override protected void init(){int center=width/2;int top=Math.max(28,height/2-86);urlBox=new EditBox(font,center-150,top+42,300,20,Component.literal("Audio URL"));urlBox.setMaxLength(2048);String saved=CyberAudioClient.CONFIG.config().lastUrl;if(saved!=null)urlBox.setValue(saved);addRenderableWidget(urlBox);addRenderableWidget(Button.builder(Component.literal("Play URL"),b->playUrl()).bounds(center-150,top+68,96,20).build());addRenderableWidget(Button.builder(Component.literal("Pause / Resume"),b->audio.togglePause()).bounds(center-48,top+68,120,20).build());addRenderableWidget(Button.builder(Component.literal("Stop"),b->audio.stop()).bounds(center+78,top+68,72,20).build());addRenderableWidget(Button.builder(Component.literal("Queue URL"),b->audio.enqueue(urlBox.getValue())).bounds(center-150,top+94,96,20).build());addRenderableWidget(Button.builder(Component.literal("Vol -"),b->changeVolume(-0.05f)).bounds(center-48,top+94,58,20).build());addRenderableWidget(Button.builder(Component.literal("Vol +"),b->changeVolume(0.05f)).bounds(center+16,top+94,58,20).build());addRenderableWidget(Button.builder(Component.literal("Clear Queue"),b->audio.clearQueue()).bounds(center+80,top+94,70,20).build());}
    private void playUrl(){String url=urlBox.getValue().trim();CyberAudioClient.CONFIG.config().lastUrl=url;CyberAudioClient.CONFIG.save();audio.play(url);} private void changeVolume(float d){audio.setVolume(audio.volume()+d);CyberAudioClient.CONFIG.config().volume=audio.volume();CyberAudioClient.CONFIG.save();}
    @Override public void render(GuiGraphics g,int mouseX,int mouseY,float partialTick){renderBackground(g,mouseX,mouseY,partialTick);super.render(g,mouseX,mouseY,partialTick);int center=width/2;int top=Math.max(28,height/2-86);g.drawCenteredString(font,Component.literal("CYBERAUDIO"),center,top,0x55FFFF);g.drawCenteredString(font,Component.literal(audio.currentTitle()),center,top+18,0xFFFFFF);g.drawString(font,"State: "+audio.state(),center-150,top+122,0xD0D0D0,false);g.drawString(font,"Volume: "+Math.round(audio.volume()*100)+"%",center-150,top+136,0xD0D0D0,false);g.drawString(font,"Queue: "+audio.queueSize(),center+36,top+136,0xD0D0D0,false);g.drawString(font,"Downloaded: "+formatBytes(audio.performance().downloadedBytes()),center-150,top+150,0xA0A0A0,false);g.drawString(font,"Start latency: "+audio.performance().startLatencyMs()+" ms",center+36,top+150,0xA0A0A0,false);if(!audio.lastError().isBlank())g.drawCenteredString(font,Component.literal("Error: "+audio.lastError()),center,top+166,0xFF7777);}
    private static String formatBytes(long b){if(b<1024)return b+" B";if(b<1024L*1024)return String.format("%.1f KiB",b/1024.0);return String.format("%.1f MiB",b/(1024.0*1024.0));}
    @Override public void onClose(){if(minecraft!=null)minecraft.setScreen(parent);}
}
