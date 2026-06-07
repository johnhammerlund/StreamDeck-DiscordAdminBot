import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { botClient } from "../bot-client";
import type { BotEvent } from "../types";

interface HangupUserSettings {
  [key: string]: string | number | boolean | null;
  guildId: string;
  userId: string;
  label: string;
}

const STATE_DISCONNECTED = 0;
const STATE_CONNECTED = 1;

@action({ UUID: "com.johnhammerlund.discordadminbot.hangup-user" })
export class HangupUser extends SingletonAction<HangupUserSettings> {
  private instances = new Map<string, { action: KeyAction; settings: HangupUserSettings }>();

  constructor() {
    super();
    botClient.on("voiceStateUpdate", (evt: BotEvent) => {
      if (evt.event !== "voiceStateUpdate") return;
      for (const [, inst] of this.instances) {
        if (inst.settings.userId && inst.settings.userId === evt.userId) {
          const connected = evt.channelId !== null;
          inst.action.setState(connected ? STATE_CONNECTED : STATE_DISCONNECTED);
          inst.action.setTitle(inst.settings.label || evt.displayName);
        }
      }
    });
  }

  override async onWillAppear(ev: WillAppearEvent<HangupUserSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    this.instances.set(ev.action.id, { action: ev.action, settings: ev.payload.settings });

    const { userId, label } = ev.payload.settings;
    if (!userId) return;

    const cached = botClient.voiceStateCache.get(userId);
    if (cached) {
      await ev.action.setState(cached.channelId ? STATE_CONNECTED : STATE_DISCONNECTED);
      await ev.action.setTitle(label || cached.displayName);
    }
  }

  override async onWillDisappear(ev: WillDisappearEvent<HangupUserSettings>): Promise<void> {
    this.instances.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<HangupUserSettings>): Promise<void> {
    const { guildId, userId } = ev.payload.settings;
    if (!guildId || !userId) {
      await ev.action.setTitle("Configure");
      return;
    }
    botClient.send({ op: "disconnect", guildId, userId });
  }
}
