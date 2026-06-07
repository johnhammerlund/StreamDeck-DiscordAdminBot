import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { botClient } from "../bot-client";
import type { BotEvent } from "../types";

interface DeafenUserSettings {
  [key: string]: string | number | boolean | null;
  guildId: string;
  userId: string;
  label: string;
}

const STATE_HEARING = 0;
const STATE_DEAFENED = 1;

@action({ UUID: "com.johnhammerlund.discordadminbot.deafen-user" })
export class DeafenUser extends SingletonAction<DeafenUserSettings> {
  private instances = new Map<string, { action: KeyAction; settings: DeafenUserSettings }>();

  constructor() {
    super();
    botClient.on("voiceStateUpdate", (evt: BotEvent) => {
      if (evt.event !== "voiceStateUpdate") return;
      for (const [, inst] of this.instances) {
        if (inst.settings.userId && inst.settings.userId === evt.userId) {
          inst.action.setState(evt.deafened ? STATE_DEAFENED : STATE_HEARING);
          inst.action.setTitle(inst.settings.label || evt.displayName);
        }
      }
    });
  }

  override async onWillAppear(ev: WillAppearEvent<DeafenUserSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    this.instances.set(ev.action.id, { action: ev.action, settings: ev.payload.settings });

    const { userId, label } = ev.payload.settings;
    if (!userId) return;

    const cached = botClient.voiceStateCache.get(userId);
    if (cached) {
      await ev.action.setState(cached.deafened ? STATE_DEAFENED : STATE_HEARING);
      await ev.action.setTitle(label || cached.displayName);
    }
  }

  override async onWillDisappear(ev: WillDisappearEvent<DeafenUserSettings>): Promise<void> {
    this.instances.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<DeafenUserSettings>): Promise<void> {
    const { guildId, userId } = ev.payload.settings;
    if (!guildId || !userId) {
      await ev.action.setTitle("Configure");
      return;
    }
    const cached = botClient.voiceStateCache.get(userId);
    botClient.send({ op: "deafen", guildId, userId, deafen: !(cached?.deafened ?? false) });
  }
}
