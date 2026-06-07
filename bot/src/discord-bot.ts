import { Client, GatewayIntentBits, GuildMember, VoiceState } from "discord.js";
import { EventEmitter } from "events";
import type { VoiceMember } from "./types.js";

export class DiscordBot extends EventEmitter {
  private client: Client;

  constructor(token: string) {
    super();
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
      ],
    });

    this.client.once("ready", (c) => {
      console.log(`[bot] Logged in as ${c.user.tag}`);
      this.emit("ready", c.user.tag);
    });

    this.client.on("voiceStateUpdate", (oldState, newState) => {
      const member = newState.member ?? oldState.member;
      if (!member) return;
      this.emit(
        "voiceStateUpdate",
        newState.guild.id,
        this.toVoiceMember(member, newState),
        oldState.channelId ?? null
      );
    });

    this.client.login(token).catch((err) => {
      console.error("[bot] Login failed:", err);
      process.exit(1);
    });
  }

  async serverMute(guildId: string, userId: string, mute: boolean): Promise<void> {
    const member = await this.fetchMember(guildId, userId);
    await member.voice.setMute(mute, "Stream Deck admin action");
  }

  async serverDeafen(guildId: string, userId: string, deafen: boolean): Promise<void> {
    const member = await this.fetchMember(guildId, userId);
    await member.voice.setDeaf(deafen, "Stream Deck admin action");
  }

  async disconnectUser(guildId: string, userId: string): Promise<void> {
    const member = await this.fetchMember(guildId, userId);
    await member.voice.disconnect("Stream Deck admin action");
  }

  getVoiceChannelMembers(guildId: string, channelId: string): VoiceMember[] {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return [];
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isVoiceBased()) return [];
    return channel.members
      .filter((m): m is GuildMember => !m.user.bot)
      .map((m) => this.toVoiceMember(m, m.voice));
  }

  getVoiceState(guildId: string, userId: string): VoiceMember | null {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return null;
    const member = guild.members.cache.get(userId);
    if (!member) return null;
    if (!member.voice.channelId) return null;
    return this.toVoiceMember(member, member.voice);
  }

  private async fetchMember(guildId: string, userId: string): Promise<GuildMember> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) throw new Error(`Guild ${guildId} not found`);
    return guild.members.fetch(userId);
  }

  private toVoiceMember(member: GuildMember, voice: VoiceState): VoiceMember {
    return {
      userId: member.id,
      username: member.user.username,
      displayName: member.displayName,
      avatarUrl: member.displayAvatarURL({ size: 64 }) ?? null,
      muted: voice.serverMute ?? false,
      deafened: voice.serverDeaf ?? false,
      selfMuted: voice.selfMute ?? false,
      selfDeafened: voice.selfDeaf ?? false,
      channelId: voice.channelId ?? "",
    };
  }
}
