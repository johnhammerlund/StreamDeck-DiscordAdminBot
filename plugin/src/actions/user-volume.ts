import {
  action,
  DialAction,
  DialDownEvent,
  DialRotateEvent,
  SingletonAction,
  TouchTapEvent,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { botClient } from "../bot-client";
import { globalSettings } from "../global-settings";
import type { BotEvent, VoiceMember } from "../types";

interface UserVolumeSettings {
  [key: string]: string | number | boolean | null;
  channelId: string;
  slot: number; // 1-based
}

@action({ UUID: "com.johnhammerlund.discordadminbot.user-volume" })
export class UserVolume extends SingletonAction<UserVolumeSettings> {
  private instances = new Map<
    string,
    { action: DialAction; settings: UserVolumeSettings; currentMember: VoiceMember | null }
  >();

  constructor() {
    super();

    botClient.on("memberList", (evt: BotEvent) => {
      if (evt.event !== "memberList") return;
      for (const [, inst] of this.instances) {
        if (inst.settings.channelId === evt.channelId) {
          const slotIndex = (Number(inst.settings.slot) || 1) - 1;
          inst.currentMember = evt.members[slotIndex] ?? null;
          this.updateFeedback(inst.action, inst.currentMember);
        }
      }
    });

    botClient.on("voiceStateUpdate", (evt: BotEvent) => {
      if (evt.event !== "voiceStateUpdate") return;
      for (const [, inst] of this.instances) {
        if (inst.currentMember?.userId === evt.userId) {
          if (evt.channelId === null) {
            inst.currentMember = null;
          } else {
            inst.currentMember = {
              userId: evt.userId,
              username: evt.username,
              displayName: evt.displayName,
              avatarUrl: evt.avatarUrl,
              muted: evt.muted,
              deafened: evt.deafened,
              selfMuted: evt.selfMuted,
              selfDeafened: evt.selfDeafened,
              channelId: evt.channelId,
            };
          }
          this.updateFeedback(inst.action, inst.currentMember);
        }
      }
    });
  }

  override async onWillAppear(ev: WillAppearEvent<UserVolumeSettings>): Promise<void> {
    if (!ev.action.isDial()) return;
    const { channelId, slot } = ev.payload.settings;
    const guildId = globalSettings.guildId;

    const inst = { action: ev.action, settings: ev.payload.settings, currentMember: null as VoiceMember | null };
    this.instances.set(ev.action.id, inst);

    if (guildId && channelId) {
      botClient.send({ op: "subscribe", guildId, channelId });
      const cached = botClient.channelMemberCache.get(channelId);
      if (cached) inst.currentMember = cached[(Number(slot) || 1) - 1] ?? null;
    }

    this.updateFeedback(ev.action, inst.currentMember);
  }

  override async onWillDisappear(ev: WillDisappearEvent<UserVolumeSettings>): Promise<void> {
    const { channelId } = ev.payload.settings;
    const guildId = globalSettings.guildId;
    this.instances.delete(ev.action.id);
    if (guildId && channelId) {
      const stillWatched = [...this.instances.values()].some((i) => i.settings.channelId === channelId);
      if (!stillWatched) botClient.send({ op: "unsubscribe", guildId, channelId });
    }
  }

  override async onDialDown(ev: DialDownEvent<UserVolumeSettings>): Promise<void> {
    const inst = this.instances.get(ev.action.id);
    const guildId = globalSettings.guildId;
    if (!inst?.currentMember || !guildId) return;
    const { userId, muted } = inst.currentMember;
    botClient.send({ op: "mute", guildId, userId, mute: !muted });
  }

  override async onTouchTap(ev: TouchTapEvent<UserVolumeSettings>): Promise<void> {
    const inst = this.instances.get(ev.action.id);
    const guildId = globalSettings.guildId;
    if (!inst?.currentMember || !guildId) return;
    const { userId, deafened } = inst.currentMember;

    if (ev.payload.hold) {
      botClient.send({ op: "disconnect", guildId, userId });
    } else {
      botClient.send({ op: "deafen", guildId, userId, deafen: !deafened });
    }
  }

  override async onDialRotate(_ev: DialRotateEvent<UserVolumeSettings>): Promise<void> {
    // Reserved: per-user volume requires Discord RPC (local IPC to the Discord client).
  }

  private updateFeedback(encoder: DialAction, member: VoiceMember | null): void {
    if (!member) {
      encoder.setFeedback({ title: "— Empty —", value: "", indicator: 0 });
      return;
    }
    const statusIcon = member.muted ? "⊘" : member.selfMuted ? "○" : "●";
    const statusText = member.deafened ? "Deafened" : member.muted ? "Muted" : member.selfMuted ? "Self-muted" : "Live";
    encoder.setFeedback({
      title: member.displayName,
      value: `${statusIcon} ${statusText}`,
      indicator: member.muted || member.deafened ? 0 : 100,
    });
  }
}
