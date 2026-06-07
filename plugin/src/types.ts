// Mirror of bot/src/types.ts — keep in sync with the WS protocol

export interface VoiceMember {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  muted: boolean;
  deafened: boolean;
  selfMuted: boolean;
  selfDeafened: boolean;
  channelId: string;
}

export type PluginCommand =
  | { op: "subscribe"; guildId: string; channelId: string }
  | { op: "unsubscribe"; guildId: string; channelId: string }
  | { op: "mute"; guildId: string; userId: string; mute: boolean }
  | { op: "deafen"; guildId: string; userId: string; deafen: boolean }
  | { op: "disconnect"; guildId: string; userId: string }
  | { op: "getMembers"; guildId: string; channelId: string };

export type BotEvent =
  | { event: "ready"; botTag: string }
  | { event: "memberList"; guildId: string; channelId: string; members: VoiceMember[] }
  | { event: "voiceStateUpdate"; guildId: string; userId: string; username: string; displayName: string; avatarUrl: string | null; muted: boolean; deafened: boolean; selfMuted: boolean; selfDeafened: boolean; channelId: string | null }
  | { event: "ack"; op: string; success: boolean; error?: string }
  | { event: "error"; code: string; message: string };
