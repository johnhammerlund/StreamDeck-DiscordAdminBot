import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { botClient } from "../bot-client";
import { globalSettings } from "../global-settings";
import type { BotEvent } from "../types";

interface MuteUserSettings {
  [key: string]: string | number | boolean | null;
  userId: string;
  label: string;
}

const STATE_UNMUTED = 0;
const STATE_MUTED = 1;

@action({ UUID: "com.johnhammerlund.discordadminbot.mute-user" })
export class MuteUser extends SingletonAction<MuteUserSettings> {
  private instances = new Map<string, { action: KeyAction; settings: MuteUserSettings }>();

  constructor() {
    super();
    botClient.on("voiceStateUpdate", (evt: BotEvent) => {
      if (evt.event !== "voiceStateUpdate") return;
      for (const [, inst] of this.instances) {
        if (inst.settings.userId && inst.settings.userId === evt.userId) {
          inst.action.setState(evt.muted ? STATE_MUTED : STATE_UNMUTED);
          inst.action.setTitle(inst.settings.label || evt.displayName);
        }
      }
    });
  }

  override async onWillAppear(ev: WillAppearEvent<MuteUserSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    this.instances.set(ev.action.id, { action: ev.action, settings: ev.payload.settings });

    const { userId, label } = ev.payload.settings;
    if (!userId) return;

    const cached = botClient.voiceStateCache.get(userId);
    if (cached) {
      await ev.action.setState(cached.muted ? STATE_MUTED : STATE_UNMUTED);
      await ev.action.setTitle(label || cached.displayName);
    }
  }

  override async onWillDisappear(ev: WillDisappearEvent<MuteUserSettings>): Promise<void> {
    this.instances.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<MuteUserSettings>): Promise<void> {
    const guildId = globalSettings.guildId;
    const { userId } = ev.payload.settings;
    if (!guildId || !userId) {
      await ev.action.setTitle("Configure");
      return;
    }
    const cached = botClient.voiceStateCache.get(userId);
    botClient.send({ op: "mute", guildId, userId, mute: !(cached?.muted ?? false) });
  }
}
